(() => {
  'use strict';

  // Recognition thresholds and optional aiming heuristics live here for review.
  const OCR_CONFIDENCE_THRESHOLD = 60;
  const OBJECT_CONFIDENCE_THRESHOLD = 0.6;
  const MAX_OBJECT_RESULTS = 3;
  const SIGN_FRAME_COUNT = 3;
  const SIGN_CAPTURE_SPAN_MS = 1500;
  const MAX_CAPTURE_WIDTH = 960;
  const AIMING_DARK_LUMA_THRESHOLD = 45;
  const AIMING_BLUR_EDGE_VARIANCE_THRESHOLD = 85;
  const AIMING_FRAME_EDGE_MARGIN_RATIO = 0.03;
  const AIMING_EDGE_WORD_MIN_COUNT = 2;
  const AIMING_EDGE_WORD_MIN_RATIO = 0.3;
  const AIMING_MESSAGE_COOLDOWN_MS = 4000;
  const CAMERA_PREVIEW_TIMEOUT_MS = 10000;

  const OCR_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  const TFJS_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
  const COCO_SSD_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js';
  const RECOGNITION_LOAD_ERROR = 'Could not load the recognition files. Check your internet connection.';
  const RUNS_STORAGE_KEY = 'naviable_eval_runs';
  const FEEDBACK_STORAGE_KEY = 'naviable_eval_feedback';

  const byId = (id) => document.getElementById(id);
  const statusRegion = byId('status-message');
  const cameraStatus = byId('camera-status');
  const cameraStateInline = document.querySelector('.camera-state-inline');
  const cameraCard = byId('camera-card');
  const video = byId('camera-preview');
  const cameraPlaceholder = byId('camera-placeholder');
  const cameraError = byId('camera-error');
  const startCameraButton = byId('start-camera');
  const stopCameraButton = byId('stop-camera');
  const emergencyButton = byId('emergency-stop');
  const signGuide = byId('sign-guide');
  const readSignButton = byId('read-sign');
  const repeatSignButton = byId('repeat-sign');
  const stopSignSpeechButton = byId('stop-sign-speech');
  const signResult = byId('sign-result');
  const signMetrics = byId('sign-metrics');
  const signRating = byId('sign-rating');
  const aimingHelp = byId('aiming-help');
  const objectModelState = byId('object-model-state');
  const describeObjectsButton = byId('describe-objects');
  const objectActions = describeObjectsButton.parentElement;
  const repeatObjectsButton = document.createElement('button');
  repeatObjectsButton.id = 'repeat-objects';
  repeatObjectsButton.className = 'button secondary-button';
  repeatObjectsButton.type = 'button';
  repeatObjectsButton.textContent = 'Repeat';
  repeatObjectsButton.disabled = true;
  const stopObjectsSpeechButton = document.createElement('button');
  stopObjectsSpeechButton.id = 'stop-objects-speech';
  stopObjectsSpeechButton.className = 'button secondary-button';
  stopObjectsSpeechButton.type = 'button';
  stopObjectsSpeechButton.textContent = 'Stop speech';
  stopObjectsSpeechButton.disabled = true;
  objectActions.append(repeatObjectsButton, stopObjectsSpeechButton);
  const objectResult = byId('object-result');
  const objectMetrics = byId('object-metrics');
  const objectRating = byId('object-rating');
  const saveTestLog = byId('save-test-log');
  const feedbackForm = byId('feedback-form');
  const submitFeedbackButton = byId('submit-feedback');

  const tabs = [
    { id: 'sign', link: byId('tab-sign'), panel: byId('panel-sign') },
    { id: 'objects', link: byId('tab-objects'), panel: byId('panel-objects') },
    { id: 'eval', link: byId('tab-eval'), panel: byId('panel-eval') },
    { id: 'about', link: byId('tab-about'), panel: byId('panel-about') },
  ];

  let activeTabId = null;
  let cameraStream = null;
  let cameraRequestId = 0;
  let cameraStartPromise = null;
  let cancelPreviewWait = null;
  let operationId = 0;
  let signScanning = false;
  let objectScanning = false;
  let ocrWorker = null;
  let ocrWorkerPromise = null;
  let objectModel = null;
  let objectModelPromise = null;
  let lastSpokenText = '';
  let lastAimingMessageAt = -Infinity;
  let speechGeneration = 0;
  let nextRecordId = 1;
  const pendingSpeechResolvers = new Set();
  const sessionRuns = [];
  let savedRuns = [];
  const sessionFeedback = [];
  let savedFeedback = [];

  function announce(message) {
    if (statusRegion) statusRegion.textContent = message;
  }

  function setCameraState(isOn) {
    const state = isOn ? 'on' : 'off';
    cameraStatus.textContent = `Camera: ${state}`;
    cameraStateInline.textContent = state;
    cameraPlaceholder.hidden = isOn;
    stopCameraButton.disabled = !isOn && !cameraStartPromise;
    startCameraButton.disabled = isOn || Boolean(cameraStartPromise);
    startCameraButton.textContent = cameraStartPromise && !isOn ? 'Starting camera…' : 'Start camera';
  }

  function clearCameraError() {
    cameraError.textContent = '';
    cameraError.hidden = true;
  }

  function showCameraError(message) {
    cameraError.textContent = message;
    cameraError.hidden = false;
    announce(message);
  }

  function getCameraErrorMessage(error) {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      return 'Camera access requires HTTPS or localhost.';
    }
    switch (error?.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Camera permission was denied. Allow camera access in your browser settings.';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No camera was found on this device.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'The camera is busy or could not be opened. Close other apps using it and try again.';
      case 'OverconstrainedError':
        return 'No camera matches the requested facing mode. Try again with the available camera.';
      case 'SecurityError':
        return 'Camera access requires HTTPS or localhost.';
      default:
        return 'The camera could not be started. Check camera access and try again.';
    }
  }

  function stopTracks(stream) {
    if (!stream) return;
    for (const track of stream.getTracks()) {
      try { track.stop(); } catch { /* A track can already be stopped. */ }
    }
  }

  function waitForVideoReady() {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      let finished = false;
      const finish = (ready) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('canplay', onReady);
        cancelPreviewWait = null;
        resolve(ready);
      };
      const onReady = () => {
        if (video.videoWidth > 0) finish(true);
      };
      const timer = window.setTimeout(() => finish(false), CAMERA_PREVIEW_TIMEOUT_MS);
      cancelPreviewWait = () => finish(false);
      video.addEventListener('loadeddata', onReady);
      video.addEventListener('canplay', onReady);
      onReady();
    });
  }

  async function startCamera() {
    if (cameraStream?.active) return true;
    if (cameraStartPromise) return cameraStartPromise;
    const requestId = ++cameraRequestId;
    clearCameraError();
    let startPromise;
    startPromise = (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error('InsecureContext');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        });
        if (requestId !== cameraRequestId) {
          stopTracks(stream);
          return false;
        }
        cameraStream = stream;
        video.srcObject = stream;
        cameraPlaceholder.hidden = true;
        await video.play();
        const ready = await waitForVideoReady();
        if (!ready || requestId !== cameraRequestId) {
          if (requestId === cameraRequestId) throw new Error('PreviewUnavailable');
          return false;
        }
        setCameraState(true);
        announce('Camera: on. Camera preview is active on this device.');
        return true;
      } catch (error) {
        if (requestId !== cameraRequestId) return false;
        const message = error?.message === 'InsecureContext'
          ? 'Camera access requires HTTPS or localhost.'
          : error?.message === 'PreviewUnavailable'
            ? 'The camera started but its preview was unavailable. Try again.'
            : getCameraErrorMessage(error);
        const stream = cameraStream;
        cameraStream = null;
        stopTracks(stream);
        video.pause();
        video.srcObject = null;
        setCameraState(false);
        showCameraError(message);
        return false;
      } finally {
        if (cameraStartPromise === startPromise) {
          cameraStartPromise = null;
          setCameraState(Boolean(cameraStream?.active));
        }
      }
    })();
    cameraStartPromise = startPromise;
    setCameraState(false);
    return startPromise;
  }

  function stopCamera() {
    cameraRequestId += 1;
    cameraStartPromise = null;
    if (cancelPreviewWait) cancelPreviewWait();
    const stream = cameraStream;
    cameraStream = null;
    stopTracks(stream);
    const attachedStream = video.srcObject;
    if (attachedStream && attachedStream !== stream) stopTracks(attachedStream);
    video.pause();
    video.srcObject = null;
    cameraPlaceholder.hidden = false;
    setCameraState(false);
  }

  function stopSpeech(shouldAnnounce = false) {
    speechGeneration += 1;
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch { /* Speech may already be idle. */ }
    }
    for (const resolve of Array.from(pendingSpeechResolvers)) resolve(null);
    if (shouldAnnounce) announce('Speech stopped.');
  }

  function getEnglishVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    return voices.find((voice) => /^en([_-]|$)/i.test(voice.lang)) ?? null;
  }

  async function findEnglishVoice() {
    let voice = getEnglishVoice();
    if (voice || !('speechSynthesis' in window)) return voice;
    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        window.speechSynthesis.removeEventListener('voiceschanged', finish);
        resolve();
      };
      const timer = window.setTimeout(finish, 600);
      window.speechSynthesis.addEventListener('voiceschanged', finish, { once: true });
    });
    voice = getEnglishVoice();
    return voice;
  }

  async function speakText(text) {
    const generation = speechGeneration;
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      announce('Speech synthesis is not available in this browser.');
      return null;
    }
    const voice = await findEnglishVoice();
    if (generation !== speechGeneration) return null;
    if (!voice) {
      announce('No suitable English speech voice is available on this device.');
      return null;
    }
    return new Promise((resolve) => {
      let finished = false;
      let started = false;
      const finish = (value) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        pendingSpeechResolvers.delete(cancelPending);
        resolve(value);
      };
      const cancelPending = () => finish(null);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voice.lang || 'en';
      utterance.voice = voice;
      utterance.onstart = () => {
        started = true;
        finish(performance.now());
      };
      utterance.onerror = () => {
        if (!started && generation === speechGeneration) announce('Speech could not be started on this device.');
        finish(null);
      };
      pendingSpeechResolvers.add(cancelPending);
      const timer = window.setTimeout(() => finish(null), 8000);
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        announce('Speech could not be started on this device.');
        finish(null);
      }
    });
  }

  function cancelCurrentWork() {
    operationId += 1;
    signScanning = false;
    objectScanning = false;
    signGuide.hidden = true;
    readSignButton.disabled = !ocrWorker;
    describeObjectsButton.disabled = !objectModel;
    stopSpeech(false);
  }

  function emergencyStop() {
    cancelCurrentWork();
    stopCamera();
    announce('Emergency stop activated. Camera off and speech cancelled.');
  }

  const libraryPromises = new Map();

  function loadScriptOnce(name, url, readyCheck) {
    if (readyCheck()) return Promise.resolve();
    if (libraryPromises.has(name)) return libraryPromises.get(name);
    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-addon-library="${name}"]`);
      if (existing) existing.remove();
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.addonLibrary = name;
      script.onload = () => readyCheck() ? resolve() : reject(new Error(`Missing global for ${name}`));
      script.onerror = () => reject(new Error(`Could not load ${name}`));
      document.head.append(script);
    });
    libraryPromises.set(name, promise);
    return promise.catch((error) => {
      libraryPromises.delete(name);
      document.querySelector(`script[data-addon-library="${name}"]`)?.remove();
      throw error;
    });
  }

  async function ensureOcrWorker() {
    if (ocrWorker) return ocrWorker;
    if (ocrWorkerPromise) return ocrWorkerPromise;
    readSignButton.disabled = true;
    announce('Loading English text recognition files…');
    ocrWorkerPromise = (async () => {
      try {
        await loadScriptOnce('tesseract', OCR_SCRIPT_URL, () => Boolean(window.Tesseract?.createWorker));
        const worker = await window.Tesseract.createWorker('eng', 1, {
          logger: (progress) => {
            if (activeTabId === 'sign' && progress?.status) announce(`Loading text recognition: ${progress.status}.`);
          },
        });
        ocrWorker = worker;
        readSignButton.disabled = false;
        announce('Text recognition is ready. The camera stays off until you press a camera button.');
        return worker;
      } catch {
        ocrWorker = null;
        readSignButton.disabled = true;
        clearSignOutput();
        announce(RECOGNITION_LOAD_ERROR);
        throw new Error(RECOGNITION_LOAD_ERROR);
      } finally {
        ocrWorkerPromise = null;
      }
    })();
    return ocrWorkerPromise;
  }

  async function ensureObjectModel() {
    if (objectModel) return objectModel;
    if (objectModelPromise) return objectModelPromise;
    describeObjectsButton.disabled = true;
    objectModelState.textContent = 'Loading model...';
    announce('Loading model...');
    objectModelPromise = (async () => {
      try {
        await loadScriptOnce('tfjs', TFJS_SCRIPT_URL, () => Boolean(window.tf));
        await loadScriptOnce('coco-ssd', COCO_SSD_SCRIPT_URL, () => Boolean(window.cocoSsd?.load));
        const model = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
        objectModel = model;
        describeObjectsButton.disabled = false;
        objectModelState.textContent = 'Model ready. The camera stays off until you press a camera button.';
        announce('Object recognition model is ready.');
        return model;
      } catch {
        objectModel = null;
        describeObjectsButton.disabled = true;
        objectModelState.textContent = RECOGNITION_LOAD_ERROR;
        clearObjectOutput();
        announce(RECOGNITION_LOAD_ERROR);
        throw new Error(RECOGNITION_LOAD_ERROR);
      } finally {
        objectModelPromise = null;
      }
    })();
    return objectModelPromise;
  }

  function captureCanvas() {
    if (!video.videoWidth || !video.videoHeight) throw new Error('Camera preview is not ready.');
    const scale = Math.min(1, MAX_CAPTURE_WIDTH / video.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Could not prepare a camera frame.');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function delay(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function inspectFrame(canvas) {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
    let luminanceTotal = 0;
    let luminanceCount = 0;
    const luminanceAt = (x, y) => {
      const index = (y * width + x) * 4;
      return 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
    };
    const laplacianValues = [];
    const step = Math.max(1, Math.floor(Math.min(width, height) / 240));
    for (let y = step; y < height - step; y += step) {
      for (let x = step; x < width - step; x += step) {
        const center = luminanceAt(x, y);
        luminanceTotal += center;
        luminanceCount += 1;
        laplacianValues.push(
          luminanceAt(x - step, y) + luminanceAt(x + step, y) +
          luminanceAt(x, y - step) + luminanceAt(x, y + step) - 4 * center,
        );
      }
    }
    const average = luminanceCount ? luminanceTotal / luminanceCount : 0;
    const laplacianAverage = laplacianValues.length
      ? laplacianValues.reduce((sum, value) => sum + value, 0) / laplacianValues.length
      : 0;
    const edgeVariance = laplacianValues.length
      ? laplacianValues.reduce((sum, value) => sum + ((value - laplacianAverage) ** 2), 0) / laplacianValues.length
      : 0;
    return { averageLuminance: average, edgeVariance };
  }

  function maybeSpeakAimingHint(message) {
    const now = performance.now();
    if (now - lastAimingMessageAt < AIMING_MESSAGE_COOLDOWN_MS) return;
    lastAimingMessageAt = now;
    announce(message);
    void speakText(message);
  }

  function collectWords(data) {
    if (Array.isArray(data?.words)) return data.words;
    const words = [];
    for (const block of data?.blocks ?? []) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const line of paragraph.lines ?? []) words.push(...(line.words ?? []));
      }
    }
    return words;
  }

  function checkTextEdges(words, width, height) {
    const usableWords = words.filter((word) => word?.bbox && word.text?.trim());
    if (!usableWords.length) return;
    const left = usableWords.filter((word) => word.bbox.x0 <= width * AIMING_FRAME_EDGE_MARGIN_RATIO).length;
    const right = usableWords.filter((word) => word.bbox.x1 >= width * (1 - AIMING_FRAME_EDGE_MARGIN_RATIO)).length;
    const top = usableWords.filter((word) => word.bbox.y0 <= height * AIMING_FRAME_EDGE_MARGIN_RATIO).length;
    const bottom = usableWords.filter((word) => word.bbox.y1 >= height * (1 - AIMING_FRAME_EDGE_MARGIN_RATIO)).length;
    const sides = [
      { count: left, message: 'Text continues beyond the left edge. Try moving the phone left.' },
      { count: right, message: 'Text continues beyond the right edge. Try moving the phone right.' },
      { count: top, message: 'Text continues beyond the top edge. Try moving the phone up.' },
      { count: bottom, message: 'Text continues beyond the bottom edge. Try moving the phone down.' },
    ].sort((a, b) => b.count - a.count);
    const strongest = sides[0];
    if (strongest.count >= AIMING_EDGE_WORD_MIN_COUNT &&
      strongest.count / usableWords.length >= AIMING_EDGE_WORD_MIN_RATIO) {
      maybeSpeakAimingHint(strongest.message);
    }
  }

  function measureAiming(canvas) {
    const quality = inspectFrame(canvas);
    if (quality.averageLuminance < AIMING_DARK_LUMA_THRESHOLD) {
      maybeSpeakAimingHint('It is too dark. Find more light.');
    } else if (quality.edgeVariance < AIMING_BLUR_EDGE_VARIANCE_THRESHOLD) {
      maybeSpeakAimingHint('The picture is blurry. Hold the phone steady.');
    }
  }

  function clearSignOutput() {
    signResult.textContent = '';
    signMetrics.textContent = 'Response time: Not measured yet';
    signRating.hidden = true;
    repeatSignButton.disabled = true;
    stopSignSpeechButton.disabled = true;
    lastSpokenText = '';
  }

  function clearObjectOutput() {
    objectResult.textContent = '';
    objectMetrics.textContent = 'Detection time: Not measured yet. Response time: Not measured yet';
    objectRating.hidden = true;
    repeatObjectsButton.disabled = true;
    stopObjectsSpeechButton.disabled = true;
    lastSpokenText = '';
  }

  function newRunRecord(type, responseTimeMs, spokenText, confidence, detectionTimeMs = null) {
    return {
      id: `${Date.now()}-${nextRecordId++}`,
      type,
      timestamp: new Date().toISOString(),
      responseTimeMs: Number.isFinite(responseTimeMs) ? Math.round(responseTimeMs) : null,
      detectionTimeMs: Number.isFinite(detectionTimeMs) ? Math.round(detectionTimeMs) : null,
      spokenText,
      confidence: Number.isFinite(confidence) ? confidence : null,
      rating: null,
    };
  }

  function addRunRecord(record) {
    sessionRuns.push(record);
    if (saveTestLog.checked) {
      savedRuns.push({ ...record });
      if (!safeWriteJson(RUNS_STORAGE_KEY, savedRuns)) {
        announce('This scan is in the current session log, but browser storage is unavailable.');
      }
    }
    renderSummary();
    return record.id;
  }

  async function readSign() {
    if (!ocrWorker || signScanning) return;
    clearSignOutput();
    signScanning = true;
    readSignButton.disabled = true;
    const runStartedAt = performance.now();
    const currentOperation = ++operationId;
    const frames = [];
    let runningOcr = false;
    signGuide.hidden = false;
    try {
      const cameraReady = await startCamera();
      if (!cameraReady || currentOperation !== operationId) return;
      await speakText('Hold steady');
      for (let index = 0; index < SIGN_FRAME_COUNT; index += 1) {
        if (currentOperation !== operationId) return;
        if (index > 0) await delay(SIGN_CAPTURE_SPAN_MS / (SIGN_FRAME_COUNT - 1));
        if (currentOperation !== operationId) return;
        const frame = captureCanvas();
        frames.push(frame);
        if (aimingHelp.checked) measureAiming(frame);
      }

      const results = [];
      for (const frame of frames) {
        if (currentOperation !== operationId) return;
        runningOcr = true;
        const recognition = await ocrWorker.recognize(frame, {}, { blocks: true });
        const data = recognition?.data ?? {};
        const rawConfidence = Number(data.confidence);
        const confidence = Number.isFinite(rawConfidence) ? rawConfidence : 0;
        const words = collectWords(data);
        if (aimingHelp.checked) checkTextEdges(words, frame.width, frame.height);
        results.push({ text: String(data.text ?? '').trim(), confidence, words });
      }
      if (currentOperation !== operationId) return;

      results.sort((a, b) => b.confidence - a.confidence);
      const best = results[0] ?? { text: '', confidence: 0 };
      const spokenText = !best.text || best.confidence < OCR_CONFIDENCE_THRESHOLD
        ? 'I am not sure. Please scan again.'
        : best.text;
      stopCamera();
      signResult.textContent = spokenText;
      lastSpokenText = spokenText;
      repeatSignButton.disabled = false;
      stopSignSpeechButton.disabled = false;
      announce('Sign scan complete.');
      const speechStartedAt = await speakText(spokenText);
      if (currentOperation !== operationId) return;
      const responseTime = speechStartedAt === null ? null : speechStartedAt - runStartedAt;
      signMetrics.textContent = `Response time: ${responseTime === null ? 'Not measured yet' : `${Math.round(responseTime)} ms`}`;
      const recordId = addRunRecord(newRunRecord('sign', responseTime, spokenText, best.confidence));
      signRating.dataset.runId = recordId;
      signRating.dataset.runType = 'sign';
      signRating.hidden = false;
    } catch (error) {
      if (currentOperation === operationId && error?.message !== RECOGNITION_LOAD_ERROR) {
        clearSignOutput();
        if (runningOcr) {
          announce(RECOGNITION_LOAD_ERROR);
        } else {
          announce('The sign scan could not be completed. Try again.');
        }
      }
    } finally {
      for (const frame of frames) { frame.width = 0; frame.height = 0; }
      if (currentOperation === operationId) {
        stopCamera();
        signGuide.hidden = true;
        signScanning = false;
        readSignButton.disabled = !ocrWorker;
      }
    }
  }

  function getPosition(centerX, width) {
    const normalizedX = centerX / width;
    if (normalizedX < 1 / 3) return 'left';
    if (normalizedX < 2 / 3) return 'centre';
    return 'right';
  }

  async function describeObjects() {
    if (!objectModel || objectScanning) return;
    clearObjectOutput();
    objectScanning = true;
    describeObjectsButton.disabled = true;
    const runStartedAt = performance.now();
    const currentOperation = ++operationId;
    try {
      const cameraReady = await startCamera();
      if (!cameraReady || currentOperation !== operationId) return;
      const frame = captureCanvas();
      const inferenceStartedAt = performance.now();
      const rawPredictions = await objectModel.detect(frame, 20, OBJECT_CONFIDENCE_THRESHOLD);
      const detectionTime = performance.now() - inferenceStartedAt;
      if (currentOperation !== operationId) {
        frame.width = 0;
        frame.height = 0;
        return;
      }
      const predictions = rawPredictions
        .filter((item) => Number(item.score) >= OBJECT_CONFIDENCE_THRESHOLD)
        .sort((a, b) => Number(b.score) - Number(a.score))
        .slice(0, MAX_OBJECT_RESULTS)
        .map((item) => {
          const centerX = Number(item.bbox[0]) + Number(item.bbox[2]) / 2;
          const position = getPosition(centerX, frame.width);
          const location = position === 'centre' ? 'in the centre' : `on the ${position}`;
          return {
            phrase: `${String(item.class)}, ${location} of the camera view`,
            score: Number(item.score),
          };
        });
      frame.width = 0;
      frame.height = 0;
      stopCamera();

      const spokenText = predictions.length
        ? predictions.map((item) => item.phrase).join('; ')
        : 'I am not sure. Please scan again.';
      const confidence = predictions.length ? predictions[0].score : null;
      objectResult.textContent = spokenText;
      lastSpokenText = spokenText;
      repeatObjectsButton.disabled = false;
      stopObjectsSpeechButton.disabled = false;
      announce('Object scan complete.');
      const speechStartedAt = await speakText(spokenText);
      if (currentOperation !== operationId) return;
      const responseTime = speechStartedAt === null ? null : speechStartedAt - runStartedAt;
      objectMetrics.textContent = `Detection time: ${Math.round(detectionTime)} ms. Response time: ${responseTime === null ? 'Not measured yet' : `${Math.round(responseTime)} ms`}`;
      const recordId = addRunRecord(newRunRecord('objects', responseTime, spokenText, confidence, detectionTime));
      objectRating.dataset.runId = recordId;
      objectRating.dataset.runType = 'objects';
      objectRating.hidden = false;
    } catch (error) {
      if (currentOperation === operationId && error?.message !== RECOGNITION_LOAD_ERROR) {
        objectResult.textContent = '';
        objectRating.hidden = true;
        announce('The object scan could not be completed. Try again.');
      }
    } finally {
      if (currentOperation === operationId) {
        stopCamera();
        objectScanning = false;
        describeObjectsButton.disabled = !objectModel;
      }
    }
  }

  function readStorageArray(key) {
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return { ok: true, value: Array.isArray(parsed) ? parsed : [] };
    } catch {
      return { ok: false, value: [] };
    }
  }

  function safeWriteJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function safeRemoveItem(key) {
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  function normalizeRun(record) {
    if (!record || (record.type !== 'sign' && record.type !== 'objects')) return null;
    return {
      id: String(record.id ?? ''),
      type: record.type,
      timestamp: String(record.timestamp ?? ''),
      responseTimeMs: Number.isFinite(record.responseTimeMs) ? record.responseTimeMs : null,
      detectionTimeMs: Number.isFinite(record.detectionTimeMs) ? record.detectionTimeMs : null,
      spokenText: String(record.spokenText ?? ''),
      confidence: Number.isFinite(record.confidence) ? record.confidence : null,
      rating: ['correct', 'wrong', 'skip'].includes(record.rating) ? record.rating : null,
    };
  }

  function allEvaluationRuns() {
    const combined = [...savedRuns, ...sessionRuns];
    const seen = new Set();
    return combined.filter((record) => {
      if (!record.id || seen.has(record.id)) return false;
      seen.add(record.id);
      return true;
    });
  }

  function renderSummary() {
    const runs = allEvaluationRuns();
    const renderRate = (type, element) => {
      const graded = runs.filter((run) => run.type === type && ['correct', 'wrong'].includes(run.rating));
      const correct = graded.filter((run) => run.rating === 'correct').length;
      element.textContent = graded.length ? `${correct} of ${graded.length}` : 'Not measured yet';
    };
    renderRate('sign', byId('summary-sign'));
    renderRate('objects', byId('summary-objects'));
    const times = runs.map((run) => run.responseTimeMs).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
    if (!times.length) {
      byId('summary-median').textContent = 'Not measured yet';
    } else {
      const middle = Math.floor(times.length / 2);
      const median = times.length % 2 ? times[middle] : (times[middle - 1] + times[middle]) / 2;
      byId('summary-median').textContent = `${Math.round(median)} ms`;
    }
  }

  function setRating(type, rating) {
    const box = type === 'sign' ? signRating : objectRating;
    const runId = box.dataset.runId;
    if (!runId) return;
    const sessionRecord = sessionRuns.find((record) => record.id === runId);
    if (sessionRecord) sessionRecord.rating = rating;
    const savedRecord = savedRuns.find((record) => record.id === runId);
    if (savedRecord) savedRecord.rating = rating;
    if (saveTestLog.checked && savedRecord && !safeWriteJson(RUNS_STORAGE_KEY, savedRuns)) {
      announce('The rating is in the current session log, but browser storage is unavailable.');
    } else {
      announce(`Result marked ${rating}.`);
    }
    box.querySelectorAll('[data-rating]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.rating === rating));
    });
    renderSummary();
  }

  function loadSavedEvaluation() {
    const runsResult = readStorageArray(RUNS_STORAGE_KEY);
    const feedbackResult = readStorageArray(FEEDBACK_STORAGE_KEY);
    if (!runsResult.ok || !feedbackResult.ok) {
      announce('Browser storage is unavailable. Evaluation data will stay in this page session only.');
    }
    savedRuns = runsResult.value.map(normalizeRun).filter(Boolean);
    savedFeedback = feedbackResult.value.filter((item) => item && typeof item === 'object');
    renderSummary();
  }

  function quoteCsv(value) {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  }

  function exportCsv() {
    const headers = [
      'row_type', 'type', 'timestamp', 'response_time_ms', 'detection_time_ms', 'spoken_text', 'confidence', 'rating',
      'could_start_without_help', 'could_repeat_and_stop_speech', 'got_information_needed', 'comment',
    ];
    const rows = [headers];
    for (const run of allEvaluationRuns()) {
      rows.push(['scan', run.type, run.timestamp, run.responseTimeMs, run.detectionTimeMs, run.spokenText, run.confidence, run.rating, '', '', '', '']);
    }
    for (const feedback of [...savedFeedback, ...sessionFeedback]) {
      rows.push(['feedback', '', feedback.timestamp, '', '', '', '', '', feedback.couldStart, feedback.couldRepeatStop, feedback.gotInformation, feedback.comment]);
    }
    const csv = rows.map((row) => row.map(quoteCsv).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'naviable-evaluation.csv';
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('CSV export created from the evaluation log and feedback.');
  }

  function clearEvaluationLog() {
    const runsRemoved = safeRemoveItem(RUNS_STORAGE_KEY);
    const feedbackRemoved = safeRemoveItem(FEEDBACK_STORAGE_KEY);
    if (!runsRemoved || !feedbackRemoved) {
      announce('Could not clear all saved evaluation data from this browser.');
      return;
    }
    sessionRuns.length = 0;
    savedRuns = [];
    sessionFeedback.length = 0;
    savedFeedback = [];
    signRating.hidden = true;
    objectRating.hidden = true;
    renderSummary();
    announce('Evaluation log and feedback cleared from this device.');
  }

  function handleFeedbackSubmit(event) {
    event.preventDefault();
    if (!saveTestLog.checked) {
      announce('Turn on Save test log on this device before saving feedback.');
      return;
    }
    if (!feedbackForm.reportValidity()) return;
    const feedback = {
      timestamp: new Date().toISOString(),
      couldStart: byId('feedback-start').value,
      couldRepeatStop: byId('feedback-repeat').value,
      gotInformation: byId('feedback-information').value,
      comment: byId('feedback-comment').value.trim(),
    };
    const candidate = [...savedFeedback, feedback];
    if (!safeWriteJson(FEEDBACK_STORAGE_KEY, candidate)) {
      sessionFeedback.push(feedback);
      announce('Feedback is in the current session only because browser storage is unavailable.');
      feedbackForm.reset();
      return;
    }
    savedFeedback = candidate;
    feedbackForm.reset();
    syncFeedbackSubmit();
    announce('Feedback saved on this device.');
  }

  function syncFeedbackSubmit() {
    submitFeedbackButton.disabled = !saveTestLog.checked;
  }

  function activateTab(tabId, initial = false) {
    const selected = tabs.some((tab) => tab.id === tabId) ? tabId : 'about';
    if (!initial && activeTabId && activeTabId !== selected) {
      cancelCurrentWork();
      stopCamera();
    }
    activeTabId = selected;
    for (const tab of tabs) {
      const isActive = tab.id === selected;
      tab.link.setAttribute('aria-selected', String(isActive));
      tab.link.tabIndex = isActive ? 0 : -1;
      tab.panel.hidden = !isActive;
    }
    cameraCard.hidden = selected !== 'sign' && selected !== 'objects';
    if (selected === 'sign') void ensureOcrWorker().catch(() => {});
    if (selected === 'objects') void ensureObjectModel().catch(() => {});
    if (selected === 'eval') renderSummary();
  }

  function tabIdFromHash() {
    const id = window.location.hash.slice(1);
    return tabs.some((tab) => tab.id === id) ? id : 'about';
  }

  function handleTabKeydown(event, currentIndex) {
    let nextIndex = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const target = tabs[nextIndex];
    window.location.hash = target.id;
    target.link.focus();
  }

  tabs.forEach((tab, index) => {
    tab.link.addEventListener('keydown', (event) => handleTabKeydown(event, index));
    tab.link.addEventListener('click', () => {
      if (activeTabId === tab.id) {
        if (tab.id === 'sign') void ensureOcrWorker().catch(() => {});
        if (tab.id === 'objects') void ensureObjectModel().catch(() => {});
      }
    });
  });

  window.addEventListener('hashchange', () => activateTab(tabIdFromHash()));
  window.addEventListener('pagehide', () => {
    cancelCurrentWork();
    stopCamera();
  });
  window.addEventListener('beforeunload', stopCamera);

  startCameraButton.addEventListener('click', () => { void startCamera(); });
  stopCameraButton.addEventListener('click', () => {
    cancelCurrentWork();
    stopCamera();
    announce('Camera stopped.');
  });
  emergencyButton.addEventListener('click', emergencyStop);
  readSignButton.addEventListener('click', () => { void readSign(); });
  describeObjectsButton.addEventListener('click', () => { void describeObjects(); });
  repeatSignButton.addEventListener('click', () => {
    if (lastSpokenText) void speakText(lastSpokenText);
  });
  stopSignSpeechButton.addEventListener('click', () => stopSpeech(true));
  repeatObjectsButton.addEventListener('click', () => {
    if (lastSpokenText) void speakText(lastSpokenText);
  });
  stopObjectsSpeechButton.addEventListener('click', () => stopSpeech(true));
  document.querySelectorAll('[data-rating]').forEach((button) => {
    button.addEventListener('click', () => setRating(button.dataset.ratingType, button.dataset.rating));
  });
  saveTestLog.addEventListener('change', () => {
    if (saveTestLog.checked) loadSavedEvaluation();
    syncFeedbackSubmit();
  });
  byId('export-csv').addEventListener('click', exportCsv);
  byId('clear-log').addEventListener('click', clearEvaluationLog);
  feedbackForm.addEventListener('submit', handleFeedbackSubmit);

  const initialTab = tabIdFromHash();
  if (!window.location.hash || !tabs.some((tab) => tab.id === window.location.hash.slice(1))) {
    window.history.replaceState(null, '', `#${initialTab}`);
  }
  activateTab(initialTab, true);
  setCameraState(false);
  syncFeedbackSubmit();
  renderSummary();
})();
