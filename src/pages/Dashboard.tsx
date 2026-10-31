import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera as CameraIcon, CameraOff, Volume2, VolumeX, Eye, Loader2,
  AlertCircle, AudioLines, Settings2, SlidersHorizontal,
  RefreshCw, SwitchCamera, Activity, CheckCircle2, XCircle, Info,
  Banknote, X, Users
} from 'lucide-react'
import {
  loadModel, detectObjects, getModelStatus, isModelLoaded,
  onModelStatusChange, getConfig, updateConfig, COCO_CLASSES,
  type Detection, type ModelStatus,
} from '../services/objectDetection'
import { speak, stopSpeaking } from '../services/speechService'
import TestLog from '../integration/TestLog'
import { setCameraStatus } from '../services/modelManager'
import { naviOn, setLatestDetections } from '../services/naviEventBus'
import {
  connectBLESensor, disconnectBLESensor, getSensorDistance, isBLESupported,
  getSensorRangeTrend,
  initProximityEngine, isBLESensorConnected, processDetectionsForProximity, setAlertsEnabled,
  setVibrationEnabled, setVoiceAlertsEnabled, unlockAudioContext, updateProximityConfig,
} from '../services/proximityEngine'
import {
  analyzeSceneObjects, describeScene, getScanRegion, keepDetectionsInScanArea,
  resetSceneAnalysis, type ScanAreaMode, type SceneObject, type SpeechLanguage,
} from '../services/sceneAnalysis'
import { VoiceManager, type AudioOperatingMode } from '../services/VoiceAnnouncementManager'
import { PersonTracker } from '../services/PersonAnnouncementTracker'
import { RoadIntelligence } from '../services/roadIntelligence'
import {
  recognizeBanknote, loadCurrencyModel, type CurrencyRecognitionResult,
} from '../services/currencyDetection'
import { NaviToolRouter } from '../assistant/NaviToolRouter'
import { NaviLiveSession } from '../assistant/NaviLiveSession'

const KnownPersonLiveAssist = lazy(() => import('../components/KnownPersonLiveAssist'))

// ─── Helper for readyState text ───
function getReadyStateDescription(state: number): string {
  switch (state) {
    case 0: return '0 (HAVE_NOTHING)'
    case 1: return '1 (HAVE_METADATA)'
    case 2: return '2 (HAVE_CURRENT_DATA)'
    case 3: return '3 (HAVE_FUTURE_DATA)'
    case 4: return '4 (HAVE_ENOUGH_DATA)'
    default: return `${state} (UNKNOWN)`
  }
}

export default function Dashboard() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const detectionSessionRef = useRef(0)
  const lastDetectionTime = useRef(0)
  const lastModelRetryAtRef = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)
  const isStartingRef = useRef(false)

  // Camera & Detection state
  const [cameraActive, setCameraActive] = useState(false)
  const [isStartingCamera, setIsStartingCamera] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle')
  const [detections, setDetections] = useState<Detection[]>([])
  const [sceneObjects, setSceneObjects] = useState<SceneObject[]>([])
  const [scanAreaMode, setScanAreaMode] = useState<ScanAreaMode>('focused')
  const [speechLanguage, setSpeechLanguage] = useState<SpeechLanguage>('hi')
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [sensorConnected, setSensorConnected] = useState(isBLESensorConnected())
  const [sensorDistance, setSensorDistance] = useState<number | null>(getSensorDistance())
  const [sensorRangeTrend, setSensorRangeTrend] = useState(getSensorRangeTrend())
  const sensorAlertStateRef = useRef<{
    band: 'unknown' | 'far' | 'nearby' | 'close' | 'critical'
    trend: ReturnType<typeof getSensorRangeTrend>
    lastAnnouncedAt: number
  }>({ band: 'unknown', trend: 'UNKNOWN', lastAnnouncedAt: 0 })
  const [sensorConnecting, setSensorConnecting] = useState(false)
  const [audioMode, setAudioMode] = useState<AudioOperatingMode>(VoiceManager.getMode())
  const [fps, setFps] = useState(0)
  const [inferenceMs, setInferenceMs] = useState(0)
  const [isDetecting, setIsDetecting] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [confidence, setConfidence] = useState(getConfig().confidenceThreshold)
  const [detectionInterval, setDetectionInterval] = useState(100)

  // Detailed Debug State (Requirement D)
  const [debugInfo, setDebugInfo] = useState({
    permissionStatus: 'unknown',
    streamStatus: 'inactive',
    trackCount: 0,
    trackLabel: '',
    readyState: 0,
    readyStateText: '0 (HAVE_NOTHING)',
    videoWidth: 0,
    videoHeight: 0,
    errorMessage: '',
    apiAvailable: typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia,
  })

  // Auto-read Indian Currency state in Vision tab (Defaults to ON for instant recognition)
  const [autoReadCurrency, setAutoReadCurrency] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('naviable_auto_currency') !== 'false'
    }
    return true
  })
  const [isVisionCurrencyScanning, setIsVisionCurrencyScanning] = useState(false)
  const [knownPersonAssistEnabled, setKnownPersonAssistEnabled] = useState(false)
  const [knownPersonStatus, setKnownPersonStatus] = useState('Saved-family matching is off.')
  const [visionCurrencyToast, setVisionCurrencyToast] = useState<{
    denomination: string
    amount: number
    confidence: number
    note_design: string
    message: string
    recognized: boolean
    timestamp: number
  } | null>(null)
  const lastCurrencyCheckTime = useRef(0)
  const isCurrencyScanningRef = useRef(false)
  const objectDetectionBusyRef = useRef(false)
  const lastAnnouncedCurrencyDenom = useRef<string | null>(null)
  const lastCurrencyAnnouncementTime = useRef(0)
  const lastCurrencyStatusKey = useRef<string | null>(null)
  const lastCurrencyStatusTime = useRef(0)

  const reportKnownPersonStatus = useCallback((status: string) => {
    setKnownPersonStatus(status)
  }, [])
  const canRunKnownPersonAnalysis = useCallback(() =>
    !objectDetectionBusyRef.current && !isCurrencyScanningRef.current,
  [])

  const handleCameraInterrupted = useCallback((stream: MediaStream, message: string) => {
    if (streamRef.current !== stream) return

    detectionSessionRef.current += 1
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    streamRef.current = null
    isStartingRef.current = false
    setIsStartingCamera(false)
    if (videoRef.current?.srcObject === stream) videoRef.current.srcObject = null
    setCameraActive(false)
    setCameraError(message)
    setCameraStatus('inactive')
    setDetections([])
    setSceneObjects([])
    setLatestDetections([])
    resetSceneAnalysis()
    PersonTracker.reset()
    RoadIntelligence.reset()
    setDebugInfo((prev) => ({
      ...prev,
      streamStatus: 'error',
      trackCount: 0,
      trackLabel: '',
      readyState: 0,
      readyStateText: getReadyStateDescription(0),
      videoWidth: 0,
      videoHeight: 0,
      errorMessage: message,
    }))
  }, [])

  // Pre-load dedicated currency model in background
  useEffect(() => {
    loadCurrencyModel().catch(() => {})
  }, [])

  // Subscribe to model status changes
  useEffect(() => {
    setModelStatus(getModelStatus())
    return onModelStatusChange(setModelStatus)
  }, [])

  // Retry model loading after a temporary offline failure. Camera inference is
  // local once the model is ready, but the first model download needs a network.
  const ensureObjectModelReady = useCallback((force = false) => {
    if (isModelLoaded() || getModelStatus() === 'loading') return
    if (!force && typeof navigator !== 'undefined' && !navigator.onLine) return

    const now = Date.now()
    if (!force && now - lastModelRetryAtRef.current < 2500) return
    lastModelRetryAtRef.current = now
    loadModel().catch((error) => {
      console.warn('[ObjectDetection] Model load will be retried when the connection returns:', error)
    })
  }, [])

  // Load model on mount and retry after connectivity or browser-tab restoration.
  useEffect(() => {
    if (modelStatus === 'idle') {
      ensureObjectModelReady(true)
    }
  }, [modelStatus, ensureObjectModelReady])

  useEffect(() => {
    const recoverAfterReturn = () => {
      if (document.visibilityState !== 'visible') return
      ensureObjectModelReady()

      if (!cameraActive) return
      const stream = streamRef.current
      const track = stream?.getVideoTracks()[0]
      const video = videoRef.current
      if (!stream || !track || track.readyState !== 'live' || !video || video.srcObject !== stream) {
        if (stream) handleCameraInterrupted(stream, 'Camera feed stopped while Navi was in the background. Tap Retry Camera to reconnect.')
        else {
          detectionSessionRef.current += 1
          if (animationRef.current) cancelAnimationFrame(animationRef.current)
          setCameraActive(false)
          setCameraError('Camera feed needs to be restarted. Tap Retry Camera to reconnect.')
          setCameraStatus('inactive')
          setDebugInfo((prev) => ({
            ...prev,
            streamStatus: 'error',
            trackCount: 0,
            trackLabel: '',
            readyState: 0,
            readyStateText: getReadyStateDescription(0),
            videoWidth: 0,
            videoHeight: 0,
            errorMessage: 'Camera feed needs to be restarted after returning to Navi.',
          }))
        }
        return
      }

      if (video.paused) {
        video.play().catch(() => {
          handleCameraInterrupted(stream, 'Camera playback paused when Navi returned. Tap Retry Camera to reconnect.')
        })
      }
    }
    const handleOnline = () => ensureObjectModelReady()

    window.addEventListener('online', handleOnline)
    window.addEventListener('pageshow', recoverAfterReturn)
    document.addEventListener('visibilitychange', recoverAfterReturn)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('pageshow', recoverAfterReturn)
      document.removeEventListener('visibilitychange', recoverAfterReturn)
    }
  }, [cameraActive, ensureObjectModelReady, handleCameraInterrupted])

  // Update permission status via Permissions API
  const updatePermissionStatus = useCallback(async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const res = await navigator.permissions.query({ name: 'camera' as any })
        setDebugInfo(prev => ({ ...prev, permissionStatus: res.state }))
        res.onchange = () => {
          setDebugInfo(prev => ({ ...prev, permissionStatus: res.state }))
        }
      }
    } catch {
      // Permissions API for camera not supported in all browsers
    }
  }, [])

  // Enumerate available video input devices
  const updateAvailableCameras = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(d => d.kind === 'videoinput')
      setAvailableCameras(videoDevices)
      if (!selectedCameraId && videoDevices.length > 0) {
        // Before permission, browsers hide labels and device ordering is not a
        // reliable front/rear indicator. Leave the choice empty so getUserMedia
        // can honor facingMode: environment instead of locking camera 0.
        const activeDeviceId = streamRef.current?.getVideoTracks()[0]?.getSettings().deviceId
        const rearCamera = videoDevices.find(device => /back|rear|environment|world/i.test(device.label))
        const preferredDeviceId = activeDeviceId || rearCamera?.deviceId
        if (preferredDeviceId) setSelectedCameraId(preferredDeviceId)
      }
    } catch (err: any) {
      console.warn('[Camera] Failed to enumerate devices:', err.message)
    }
  }, [selectedCameraId])

  // Initial checks on mount
  useEffect(() => {
    updatePermissionStatus()
    updateAvailableCameras()
  }, [updatePermissionStatus, updateAvailableCameras])

  // Draw one selected focus area and only the objects the user asked Navi to watch.
  const drawDetections = useCallback((dets: Detection[]) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video || video.videoWidth === 0 || video.videoHeight === 0) return

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const region = getScanRegion(scanAreaMode)
    ctx.save()
    ctx.setLineDash([12, 8])
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.72)'
    ctx.lineWidth = Math.max(2, canvas.width * 0.002)
    ctx.strokeRect(
      region.left * canvas.width,
      region.top * canvas.height,
      region.width * canvas.width,
      region.height * canvas.height,
    )
    ctx.restore()

    dets.forEach((d) => {
      const [x, y, w, h] = d.bbox
      const color = d.position === 'LEFT' ? '#00e5ff' : d.position === 'RIGHT' ? '#7c3aed' : '#22c55e'

      // Bounding box
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.setLineDash([])
      ctx.strokeRect(x, y, w, h)

      // Corner accents
      const corner = Math.min(w, h) * 0.15
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x, y + corner); ctx.lineTo(x, y); ctx.lineTo(x + corner, y)
      ctx.moveTo(x + w - corner, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + corner)
      ctx.moveTo(x, y + h - corner); ctx.lineTo(x, y + h); ctx.lineTo(x + corner, y + h)
      ctx.moveTo(x + w - corner, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - corner)
      ctx.stroke()

      // Label background
      const label = `${d.class} ${Math.round(d.score * 100)}% [${d.position}]`
      ctx.font = 'bold 13px Inter, system-ui, sans-serif'
      const textW = ctx.measureText(label).width
      const labelY = y > 28 ? y - 28 : y + 4
      ctx.fillStyle = color
      ctx.globalAlpha = 0.88
      ctx.beginPath()
      ctx.roundRect(x, labelY, textW + 14, 22, 4)
      ctx.fill()
      ctx.globalAlpha = 1

      // Label text
      ctx.fillStyle = '#0a0e1a'
      ctx.textBaseline = 'top'
      ctx.fillText(label, x + 7, labelY + 4)
    })
  }, [scanAreaMode])

  // Detection loop
  const detectLoop = useCallback(async (session: number) => {
    if (session !== detectionSessionRef.current) return
    const scheduleNext = () => {
      if (session !== detectionSessionRef.current) return
      animationRef.current = requestAnimationFrame(() => { void detectLoop(session) })
    }
    const video = videoRef.current
    if (!cameraActive || !video || video.readyState < 2 || video.videoWidth === 0) {
      scheduleNext()
      return
    }

    const now = performance.now()
    if (now - lastDetectionTime.current > detectionInterval) {
      const start = performance.now()
      objectDetectionBusyRef.current = true
      try {
        const allResults = await detectObjects(video)
        if (session !== detectionSessionRef.current) return
        const results = keepDetectionsInScanArea(
          allResults,
          video.videoWidth,
          video.videoHeight,
          scanAreaMode,
        )
        const objects = analyzeSceneObjects(results, video.videoWidth, video.videoHeight)
        const prioritizedDetections = objects.map((object) => object.detection)
        const elapsed = performance.now() - start

        setDetections(prioritizedDetections)
        setSceneObjects(objects)
        setLatestDetections(prioritizedDetections) // Publish focused results to voice commands.
        drawDetections(prioritizedDetections)
        setInferenceMs(Math.round(elapsed))
        setFps(Math.round(1000 / Math.max(elapsed, 1)))
        processDetectionsForProximity(prioritizedDetections, video.videoWidth, video.videoHeight)
        setSensorDistance(getSensorDistance())

        // Process empty frames too, so trackers can clear stale targets after
        // someone or something leaves the selected scan area.
        PersonTracker.processFrame(results, video.videoWidth, video.videoHeight, {
          generalNarrationEnabled: audioEnabled,
          language: speechLanguage,
        })

        // Narrate detected objects (including non-road objects) in the chosen language.
        RoadIntelligence.processFrame(results, video.videoWidth, video.videoHeight, {
          generalNarrationEnabled: audioEnabled,
          language: speechLanguage,
        })

        // Auto-read Indian Currency when enabled (Throttled to every 1800ms)
        // Dedicated two-stage currency classifier runs independently without interrupting proximity warnings
        if (autoReadCurrency && now - lastCurrencyCheckTime.current > 1800 && !isCurrencyScanningRef.current) {
          lastCurrencyCheckTime.current = now
          isCurrencyScanningRef.current = true
          recognizeBanknote(video, { autoSpeak: false, language: speechLanguage })
            .then(res => {
              isCurrencyScanningRef.current = false
              if (session !== detectionSessionRef.current) return
              if (
                res &&
                res.isConfident &&
                res.state === 'DENOMINATION_RECOGNISED' &&
                res.amount > 0 &&
                res.denomination !== 'NEGATIVE'
              ) {
                const timeSinceLast = now - lastCurrencyAnnouncementTime.current
                const isNewNote = lastAnnouncedCurrencyDenom.current !== res.denomination
                if (isNewNote || timeSinceLast > 5000) {
                  lastCurrencyAnnouncementTime.current = now
                  lastAnnouncedCurrencyDenom.current = res.denomination
                  lastCurrencyStatusKey.current = null
                  // Announce with MEDIUM priority (will NEVER interrupt HIGH priority proximity collision warnings)
                  VoiceManager.announce(res.spokenFeedback, 'MEDIUM', { lang: speechLanguage, domain: 'currency' })
                  setVisionCurrencyToast({
                    denomination: res.displayName,
                    amount: res.amount,
                    confidence: res.confidence,
                    note_design: res.note_design,
                    message: res.spokenFeedback,
                    recognized: true,
                    timestamp: Date.now(),
                  })
                  setTimeout(() => {
                    setVisionCurrencyToast(prev => (prev && Date.now() - prev.timestamp >= 4000 ? null : prev))
                  }, 4500)
                }
              } else if (res?.banknotePresence && !res.isConfident) {
                const statusKey = `${res.state}:${res.rejectionReason || res.uncertainReason || 'uncertain'}`
                const statusTime = Date.now()
                if (statusKey !== lastCurrencyStatusKey.current || statusTime - lastCurrencyStatusTime.current > 8000) {
                  lastCurrencyStatusKey.current = statusKey
                  lastCurrencyStatusTime.current = statusTime
                  VoiceManager.announce(res.spokenFeedback, 'MEDIUM', {
                    lang: speechLanguage,
                    cooldownMs: 8000,
                    domain: 'currency',
                  })
                  setVisionCurrencyToast({
                    denomination: 'Not confirmed',
                    amount: 0,
                    confidence: res.confidence,
                    note_design: res.note_design,
                    message: res.rejectionReason || res.spokenFeedback,
                    recognized: false,
                    timestamp: statusTime,
                  })
                }
              }
            })
            .catch(() => {
              isCurrencyScanningRef.current = false
            })
        }
      } catch {
        // skip frame on error
      } finally {
        objectDetectionBusyRef.current = false
      }
      lastDetectionTime.current = now
    }

    scheduleNext()
  }, [cameraActive, drawDetections, detectionInterval, scanAreaMode, audioEnabled, autoReadCurrency, speechLanguage])

  // Start/stop detection loop
  useEffect(() => {
    if (cameraActive && modelStatus === 'ready') {
      const session = ++detectionSessionRef.current
      setIsDetecting(true)
      animationRef.current = requestAnimationFrame(() => { void detectLoop(session) })
    } else {
      setIsDetecting(false)
    }
    return () => {
      detectionSessionRef.current += 1
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [cameraActive, modelStatus, detectLoop])

  // Update config when confidence changes
  useEffect(() => {
    updateConfig({ confidenceThreshold: confidence })
  }, [confidence])

  useEffect(() => {
    setAlertsEnabled(audioEnabled)
    setVibrationEnabled(audioEnabled)
    setVoiceAlertsEnabled(audioEnabled)
    updateProximityConfig({ language: speechLanguage })
  }, [audioEnabled, speechLanguage])

  useEffect(() => {
    VoiceManager.setLanguage(speechLanguage)
  }, [speechLanguage])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const connected = isBLESensorConnected()
      const distance = getSensorDistance()
      const trend = getSensorRangeTrend()
      setSensorConnected(connected)
      setSensorDistance(distance)
      setSensorRangeTrend(trend)

      if (!connected || distance === null) {
        sensorAlertStateRef.current.band = 'unknown'
        sensorAlertStateRef.current.trend = 'UNKNOWN'
        sensorAlertStateRef.current.lastAnnouncedAt = 0
        return
      }

      const band = distance <= 50 ? 'critical' : distance <= 120 ? 'close' : distance <= 250 ? 'nearby' : 'far'
      const riskRank = { unknown: 0, far: 0, nearby: 1, close: 2, critical: 3 } as const
      const previous = sensorAlertStateRef.current
      const enteredCloserBand = riskRank[band] > riskRank[previous.band]
      const approachStarted = trend === 'APPROACHING' && previous.trend !== 'APPROACHING' && band !== 'far'
      const recessionStarted = trend === 'RECEDING' && previous.trend !== 'RECEDING' && band !== 'far'
      const isUrgent = band === 'critical'
      const cooldownElapsed = Date.now() - previous.lastAnnouncedAt >= 6500

      if (
        (enteredCloserBand || approachStarted || recessionStarted) &&
        (cooldownElapsed || (isUrgent && enteredCloserBand))
      ) {
        const distanceText = speechLanguage === 'hi'
          ? `${Math.round(distance)} सेंटीमीटर`
          : `${Math.round(distance)} centimetres`
        const trendText = trend === 'APPROACHING'
          ? speechLanguage === 'hi' ? 'दूरी घट रही है।' : 'The reading is decreasing.'
          : trend === 'RECEDING'
            ? speechLanguage === 'hi' ? 'दूरी बढ़ रही है।' : 'The reading is increasing.'
            : ''
        const message = speechLanguage === 'hi'
          ? `दूरी सेंसर की किरण के सामने कुछ लगभग ${distanceText} दूर है। ${trendText ? `${trendText} ` : ''}सेंसर वस्तु का नाम नहीं पहचानता।`
          : `The distance sensor detects something about ${distanceText} away in its beam. ${trendText ? `${trendText} ` : ''}It does not identify the object.`
        const spoken = VoiceManager.announce(message, isUrgent ? 'HIGH' : 'MEDIUM', {
          lang: speechLanguage,
          cooldownMs: 6500,
          domain: 'proximity',
          force: isUrgent,
        })
        if (spoken) previous.lastAnnouncedAt = Date.now()
      }

      previous.band = band
      previous.trend = trend
    }, 400)
    return () => window.clearInterval(timer)
  }, [speechLanguage])

  // ─── A. CAMERA INITIALIZATION & B. VIDEO RENDERING ───
  const startCamera = useCallback(async (targetDeviceId?: string) => {
    // Prevent duplicate camera initialization (Requirement C)
    if (isStartingRef.current) {
      console.log('[Camera] Camera initialization already in progress, ignoring duplicate call.')
      return
    }
    isStartingRef.current = true
    // Invalidate any in-flight inference before stopping/replacing a stream.
    detectionSessionRef.current += 1
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    setCameraActive(false)
    setIsStartingCamera(true)
    setCameraError('')
    unlockAudioContext() // Unlock Web Audio API on explicit user interaction
    initProximityEngine()
    resetSceneAnalysis()
    PersonTracker.reset()
    RoadIntelligence.reset()

    setDebugInfo(prev => ({
      ...prev,
      streamStatus: 'initializing',
      errorMessage: '',
    }))

    // Check whether window is in a secure context (HTTPS / localhost required for mobile cameras)
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      const isLocalhost =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '::1'

      if (!isLocalhost) {
        const msg =
          'Camera blocked: Insecure Context. Mobile browsers (Chrome Android & Safari iOS) require HTTPS when accessed via network IP address. Access via localhost or deploy to HTTPS.'
        console.error('[Camera]', msg)
        setCameraError(msg)
        setDebugInfo(prev => ({
          ...prev,
          streamStatus: 'error',
          errorMessage: msg,
        }))
        isStartingRef.current = false
        setIsStartingCamera(false)
        return
      }
    }

    // A. Check whether navigator.mediaDevices and getUserMedia are available
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = 'navigator.mediaDevices.getUserMedia is not available on this browser or platform.'
      console.error('[Camera]', msg)
      setCameraError(msg)
      setDebugInfo(prev => ({
        ...prev,
        streamStatus: 'error',
        errorMessage: msg,
        apiAvailable: false,
      }))
      isStartingRef.current = false
      setIsStartingCamera(false)
      return
    }

    // Release the old stream before requesting a replacement. Clear its ref
    // first so a late `ended` event from the old track cannot mark the new
    // camera session as interrupted.
    const previousStream = streamRef.current
    streamRef.current = null
    if (previousStream) {
      previousStream.getTracks().forEach(t => t.stop())
      if (videoRef.current?.srcObject === previousStream) videoRef.current.srcObject = null
    }

    const deviceToUse = targetDeviceId !== undefined ? targetDeviceId : selectedCameraId
    let stream: MediaStream | null = null
    let lastError: any = null

    // A. Request camera access using { video: { facingMode: { ideal: "environment" } }, audio: false }
    // Or target deviceId if specified
    try {
      const primaryConstraints: MediaStreamConstraints = deviceToUse
        ? { video: { deviceId: { exact: deviceToUse } }, audio: false }
        : { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }

      console.log('[Camera] Requesting camera with primary constraints:', primaryConstraints)
      stream = await navigator.mediaDevices.getUserMedia(primaryConstraints)
      console.log('[Camera] Primary getUserMedia succeeded.')
    } catch (err: any) {
      lastError = err
      console.warn('[Camera] Primary getUserMedia failed:', err.name, err.message)

      // A. If that fails, retry with video: true
      try {
        console.log('[Camera] Retrying getUserMedia with fallback constraint: { video: true, audio: false }...')
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        console.log('[Camera] Fallback getUserMedia ({ video: true }) succeeded.')
        lastError = null
      } catch (retryErr: any) {
        lastError = retryErr
        console.error('[Camera] Fallback getUserMedia also failed:', retryErr.name, retryErr.message)
      }
    }

    // Handle failure to acquire stream
    if (!stream) {
      const errName = lastError?.name || 'Error'
      const errMsg = lastError?.message || 'Could not access camera stream'
      const fullError = `${errName}: ${errMsg}`
      console.error('[Camera] Complete initialization failure:', fullError)

      setCameraError(
        errName === 'NotAllowedError' || errName === 'PermissionDeniedError'
          ? 'Camera permission denied. Please allow camera permissions in your browser.'
          : errName === 'NotFoundError' || errName === 'DevicesNotFoundError'
          ? 'No camera found on your system. Please connect a webcam.'
          : errName === 'NotReadableError' || errName === 'TrackStartError'
          ? 'Camera is in use by another application or tab.'
          : `Camera error: ${fullError}`
      )

      setDebugInfo(prev => ({
        ...prev,
        streamStatus: 'error',
        errorMessage: fullError,
      }))

      isStartingRef.current = false
      setIsStartingCamera(false)
      return
    }

    // B. VIDEO RENDERING
    streamRef.current = stream
    const tracks = stream.getVideoTracks()
    const activeTrack = tracks[0]
    const trackLabel = activeTrack ? activeTrack.label : 'Default Camera'

    activeTrack?.addEventListener('ended', () => {
      handleCameraInterrupted(stream, 'Camera feed stopped unexpectedly. Tap Retry Camera to reconnect.')
    }, { once: true })

    // Check that the video element exists and its ref is correctly connected
    const video = videoRef.current
    if (!video) {
      const msg = 'Video element ref is not connected.'
      console.error('[Camera]', msg)
      streamRef.current = null
      stream.getTracks().forEach((track) => track.stop())
      setCameraError(msg)
      isStartingRef.current = false
      setIsStartingCamera(false)
      return
    }

    // Assign stream using videoRef.current.srcObject = stream
    video.srcObject = stream

    // Set autoPlay, muted, playsInline directly on element as well
    video.muted = true
    video.defaultMuted = true
    video.playsInline = true
    video.autoplay = true
    video.setAttribute('playsinline', 'true')
    video.setAttribute('webkit-playsinline', 'true')

    // Wait for loadedmetadata before considering the video ready
    await new Promise<void>((resolve) => {
      if (video.readyState >= 1 && video.videoWidth > 0) {
        resolve()
        return
      }
      const onLoaded = () => {
        video.removeEventListener('loadedmetadata', onLoaded)
        resolve()
      }
      video.addEventListener('loadedmetadata', onLoaded, { once: true })
      // Timeout fallback (2.5 seconds) to avoid freezing if browser delays event
      setTimeout(resolve, 2500)
    })

    // Call videoRef.current.play() and handle its rejected promise
    try {
      const playPromise = video.play()
      if (playPromise !== undefined) {
        await playPromise
      }
      console.log('[Camera] video.play() resolved. Dimensions:', video.videoWidth, 'x', video.videoHeight)
    } catch (playErr: any) {
      console.warn('[Camera] video.play() was rejected or interrupted:', playErr.name, playErr.message)
    }

    if (streamRef.current !== stream || (activeTrack && activeTrack.readyState !== 'live')) {
      handleCameraInterrupted(stream, 'Camera feed stopped while it was starting. Tap Retry Camera to reconnect.')
      isStartingRef.current = false
      setIsStartingCamera(false)
      return
    }

    // Check videoWidth and videoHeight
    const width = video.videoWidth || 640
    const height = video.videoHeight || 480
    const readyState = video.readyState

    setCameraActive(true)
    setCameraStatus('active')
    setIsStartingCamera(false)
    isStartingRef.current = false

    // Connect active video feed to tool router & live multimodal session
    NaviToolRouter.setActiveVideoElement(video)
    NaviLiveSession.setVideoSource(video)

    // Update Debugging Panel state (Requirement D)
    setDebugInfo(prev => ({
      ...prev,
      streamStatus: 'streaming',
      trackCount: tracks.length,
      trackLabel: trackLabel,
      readyState: readyState,
      readyStateText: getReadyStateDescription(readyState),
      videoWidth: width,
      videoHeight: height,
      errorMessage: '',
    }))

    // Enumerate devices now that permission is granted (device labels will now be available)
    updateAvailableCameras()
    updatePermissionStatus()
  }, [selectedCameraId, updateAvailableCameras, updatePermissionStatus, handleCameraInterrupted])

  // Stop camera stream
  const stopCamera = useCallback(() => {
    const stream = streamRef.current
    streamRef.current = null
    if (stream) {
      stream.getTracks().forEach((t) => {
        t.stop()
        console.log('[Camera] Stopped video track:', t.label)
      })
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    NaviToolRouter.setActiveVideoElement(null)
    NaviLiveSession.setVideoSource(null)
    setCameraActive(false)
    setCameraStatus('inactive')
    setDetections([])
    setSceneObjects([])
    setLatestDetections([])
    resetSceneAnalysis()
    initProximityEngine()
    PersonTracker.reset()
    RoadIntelligence.reset()
    setDebugInfo(prev => ({
      ...prev,
      streamStatus: 'inactive',
      trackCount: 0,
      trackLabel: '',
      readyState: 0,
      readyStateText: getReadyStateDescription(0),
      videoWidth: 0,
      videoHeight: 0,
    }))
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }
  }, [])

  // Switch camera (Requirement E)
  const switchCamera = useCallback(async (newDeviceId: string) => {
    setSelectedCameraId(newDeviceId)
    if (cameraActive) {
      await startCamera(newDeviceId)
    }
  }, [cameraActive, startCamera])

  // Retry Camera (Requirement E)
  const retryCamera = useCallback(() => {
    ensureObjectModelReady()
    stopCamera()
    setTimeout(() => {
      startCamera()
    }, 200)
  }, [ensureObjectModelReady, stopCamera, startCamera])

  const describeSurroundings = useCallback(() => {
    const narration = describeScene(sceneObjects, scanAreaMode, speechLanguage, sensorDistance, sensorRangeTrend)
    speak(narration, speechLanguage === 'hi' ? 'hi-IN' : 'en-US')
  }, [sceneObjects, scanAreaMode, speechLanguage, sensorDistance, sensorRangeTrend])

  const handleConnectSensor = useCallback(async () => {
    setSensorConnecting(true)
    try {
      const connected = await connectBLESensor()
      setSensorConnected(connected)
      speak(
        connected
          ? speechLanguage === 'hi' ? 'दूरी सेंसर जुड़ गया है। सेंटीमीटर में रीडिंग आने की प्रतीक्षा है।' : 'Distance sensor connected. Waiting for a centimetre reading.'
          : speechLanguage === 'hi' ? 'दूरी सेंसर नहीं जुड़ा। सुनिश्चित करें कि सेंसर NaviAble प्रोटोकॉल चला रहा है।' : 'Distance sensor did not connect. Check that it uses the NaviAble sensor protocol.',
        speechLanguage === 'hi' ? 'hi-IN' : 'en-US',
      )
    } finally {
      setSensorConnecting(false)
    }
  }, [speechLanguage])

  const handleDisconnectSensor = useCallback(() => {
    disconnectBLESensor()
    setSensorConnected(false)
    setSensorDistance(null)
  }, [])

  // Listen for voice assistant camera commands through the same camera flow.
  useEffect(() => {
    const offStart = naviOn('camera:start', () => {
      if (!cameraActive) startCamera()
    })
    const offStop = naviOn('camera:stop', () => {
      if (cameraActive) stopCamera()
    })
    const offDescribe = naviOn('camera:describe', () => {
      describeSurroundings()
    })
    return () => {
      offStart()
      offStop()
      offDescribe()
    }
  }, [cameraActive, startCamera, stopCamera, describeSurroundings])

  // Explicit Scan Currency action in Vision screen (Requirement 1)
  const handleScanCurrencyInVision = useCallback(async () => {
    const video = videoRef.current
    if (!video || !cameraActive) return
    if (isCurrencyScanningRef.current) {
      setVisionCurrencyToast({
        denomination: 'Scan in progress',
        amount: 0,
        confidence: 0,
        note_design: '',
        message: 'Please wait for the current currency scan to finish.',
        recognized: false,
        timestamp: Date.now(),
      })
      return
    }
    isCurrencyScanningRef.current = true
    setIsVisionCurrencyScanning(true)
    VoiceManager.unlockVoice()
    try {
      const res = await recognizeBanknote(video, {
        language: speechLanguage,
        forceAnnouncement: true,
        autoSpeak: true,
      })
      const recognized = Boolean(
        res &&
        res.isConfident &&
        res.state === 'DENOMINATION_RECOGNISED' &&
        res.amount > 0 &&
        res.denomination !== 'NEGATIVE'
      )
      setVisionCurrencyToast({
        denomination: recognized ? res.displayName : 'Not confirmed',
        amount: recognized ? res.amount : 0,
        confidence: res.confidence,
        note_design: recognized ? res.note_design : '',
        message: recognized ? res.spokenFeedback : res.rejectionReason || res.spokenFeedback,
        recognized,
        timestamp: Date.now(),
      })
      setTimeout(() => {
        setVisionCurrencyToast(prev => (prev && Date.now() - prev.timestamp >= 5000 ? null : prev))
      }, 5200)
    } catch (err: any) {
      console.error('[Vision] Currency scan error:', err)
      setVisionCurrencyToast({
        denomination: 'Scan error',
        amount: 0,
        confidence: 0,
        note_design: '',
        message: err?.message || 'The currency scan could not complete.',
        recognized: false,
        timestamp: Date.now(),
      })
    } finally {
      isCurrencyScanningRef.current = false
      setIsVisionCurrencyScanning(false)
    }
  }, [cameraActive, speechLanguage])

  // Cleanup on unmount only (Requirement C)
  useEffect(() => {
    return () => {
      const stream = streamRef.current
      streamRef.current = null
      stream?.getTracks().forEach((t) => t.stop())
      NaviToolRouter.setActiveVideoElement(null)
      NaviLiveSession.setVideoSource(null)
      stopSpeaking()
    }
  }, [])

  // Track video dimension updates in case resolution updates after initial play
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onDimensionsReady = () => {
      if (video.videoWidth > 0) {
        setDebugInfo(prev => ({
          ...prev,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
          readyStateText: getReadyStateDescription(video.readyState),
        }))
      }
    }
    video.addEventListener('resize', onDimensionsReady)
    video.addEventListener('loadeddata', onDimensionsReady)
    return () => {
      video.removeEventListener('resize', onDimensionsReady)
      video.removeEventListener('loadeddata', onDimensionsReady)
    }
  }, [])

  const posColor = (p: string) =>
    p === 'LEFT' ? 'text-cyan-400 bg-cyan-400/10' :
    p === 'RIGHT' ? 'text-purple-400 bg-purple-400/10' :
    'text-green-400 bg-green-400/10'

  const statusDot = modelStatus === 'ready' ? 'bg-green-400' :
    modelStatus === 'loading' ? 'bg-yellow-400 animate-pulse' :
    modelStatus === 'error' ? 'bg-red-400' : 'bg-gray-500'

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            AI Vision <span className="gradient-text">Dashboard</span>
          </h1>
          <p className="text-gray-400">
            Live object detection · {COCO_CLASSES.length} supported classes · focused-area alerts
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-500">
            Navi checks the selected camera area, groups the scene into one spoken description, and speaks again when a tracked object approaches or becomes close. Camera range is approximate.
          </p>
        </motion.div>

        {/* Status bar */}
        <div className="glass-card p-4 mb-6 flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${statusDot}`} />
            <span className="text-gray-300">
              {modelStatus === 'loading' ? 'Loading AI Model...' : modelStatus === 'ready' ? 'Model Ready' : modelStatus === 'error' ? 'Model Error' : 'Idle'}
            </span>
          </div>
          {isDetecting && (
            <>
              <span className="text-cyan-400">⚡ {fps} FPS</span>
              <span className="text-gray-500">{inferenceMs}ms</span>
            </>
          )}
          <span className="text-gray-400">Objects: {detections.length}</span>
          <span className="text-gray-500">Threshold: {Math.round(confidence * 100)}%</span>

          <div className="ml-auto flex items-center gap-2">
            {/* Debug panel toggle (Requirement D) */}
            <button
              onClick={() => setShowDebug(!showDebug)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                showDebug
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40'
                  : 'border-white/10 text-gray-400 hover:bg-white/5'
              }`}
              title="Camera diagnostics & debug panel"
            >
              <Activity className="w-3.5 h-3.5" /> Diagnostics
            </button>

            {/* Settings toggle */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                showSettings
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40'
                  : 'border-white/10 text-gray-400 hover:bg-white/5'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" /> Settings
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-5 mb-6"
          >
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-cyan-400" /> Detection Settings
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="text-xs text-gray-400 mb-2 block">
                  Confidence Threshold: <span className="text-cyan-400">{Math.round(confidence * 100)}%</span>
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={0.95}
                  step={0.05}
                  value={confidence}
                  onChange={(e) => setConfidence(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>More detections</span>
                  <span>Higher accuracy</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-2 block">
                  Detection Interval: <span className="text-cyan-400">{detectionInterval}ms</span>
                </label>
                <input
                  type="range"
                  min={100}
                  max={1000}
                  step={50}
                  value={detectionInterval}
                  onChange={(e) => setDetectionInterval(parseInt(e.target.value))}
                  className="w-full accent-cyan-400"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>Faster (more CPU)</span>
                  <span>Slower (less CPU)</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── D. CAMERA DEBUGGING PANEL ─── */}
        {showDebug && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-5 mb-6 border-cyan-500/20 bg-[#0a0e1a]/95"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-cyan-400">
                <Activity className="w-4 h-4" /> Camera Diagnostics & Telemetry
              </h3>
              <span className="text-xs text-gray-500">Live Hardware Status</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-4 text-xs">
              {/* Permission */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <span className="text-gray-500 block mb-1">Permission</span>
                <span className={`font-semibold capitalize flex items-center gap-1 ${
                  debugInfo.permissionStatus === 'granted' ? 'text-green-400' :
                  debugInfo.permissionStatus === 'prompt' ? 'text-yellow-400' :
                  debugInfo.permissionStatus === 'denied' ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {debugInfo.permissionStatus === 'granted' ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                  {debugInfo.permissionStatus}
                </span>
              </div>

              {/* Stream Status */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <span className="text-gray-500 block mb-1">Stream Status</span>
                <span className={`font-semibold capitalize ${
                  debugInfo.streamStatus === 'streaming' ? 'text-green-400' :
                  debugInfo.streamStatus === 'initializing' ? 'text-yellow-400 animate-pulse' :
                  debugInfo.streamStatus === 'error' ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {debugInfo.streamStatus}
                </span>
              </div>

              {/* Video Tracks */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <span className="text-gray-500 block mb-1">Video Tracks</span>
                <span className="font-semibold text-white">
                  {debugInfo.trackCount} {debugInfo.trackCount === 1 ? 'track' : 'tracks'}
                </span>
              </div>

              {/* readyState */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <span className="text-gray-500 block mb-1">Video readyState</span>
                <span className={`font-semibold ${debugInfo.readyState >= 2 ? 'text-green-400' : 'text-yellow-400'}`}>
                  {debugInfo.readyStateText}
                </span>
              </div>

              {/* Resolution */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <span className="text-gray-500 block mb-1">Video Resolution</span>
                <span className="font-semibold text-white">
                  {debugInfo.videoWidth > 0 ? `${debugInfo.videoWidth} × ${debugInfo.videoHeight}` : '0 × 0 (idle)'}
                </span>
              </div>

              {/* MediaDevices API */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <span className="text-gray-500 block mb-1">getUserMedia API</span>
                <span className={`font-semibold flex items-center gap-1 ${debugInfo.apiAvailable ? 'text-green-400' : 'text-red-400'}`}>
                  {debugInfo.apiAvailable ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  {debugInfo.apiAvailable ? 'Available' : 'Unavailable'}
                </span>
              </div>
            </div>

            {/* Active Track / Camera Label */}
            {debugInfo.trackLabel && (
              <div className="text-xs text-gray-400 flex items-center gap-2 mb-2">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                <span>Active Camera: <strong className="text-white">{debugInfo.trackLabel}</strong></span>
              </div>
            )}

            {/* Exact Error Message if any */}
            {debugInfo.errorMessage && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 text-red-400 text-xs flex items-center gap-2 mt-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span><strong>Exact Error:</strong> {debugInfo.errorMessage}</span>
              </div>
            )}
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Camera Feed */}
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card overflow-hidden">
              <div className="relative bg-navy-900 aspect-video rounded-xl overflow-hidden">
                {/* 
                  B. VIDEO RENDERING & C. REACT LIFECYCLE:
                  Keep video element ALWAYS mounted in DOM with autoPlay, muted, playsInline.
                  Never use display: none which breaks width/height and frame decoding in browsers.
                */}
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />

                {/* Placeholder Overlay when camera is NOT active */}
                {!cameraActive && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-navy-900/95 backdrop-blur-sm">
                    <div className="w-20 h-20 rounded-full bg-cyan-400/10 flex items-center justify-center">
                      <Eye className="w-10 h-10 text-cyan-400/50" />
                    </div>
                    <p className="text-gray-400 font-medium text-sm">
                      {isStartingCamera ? 'Connecting to camera...' : 'Start camera to begin AI detection'}
                    </p>
                    {isStartingCamera && (
                      <div className="flex items-center gap-2 text-cyan-400 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> Initializing video stream...
                      </div>
                    )}
                    {modelStatus === 'loading' && !isStartingCamera && (
                      <div className="flex items-center gap-2 text-yellow-400 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading AI model...
                      </div>
                    )}
                  </div>
                )}

                {/* Live badge */}
                {cameraActive && isDetecting && (
                  <div className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/80 backdrop-blur-sm shadow-lg shadow-red-500/20">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span className="text-white text-xs font-bold tracking-wider">LIVE</span>
                  </div>
                )}

                {/* Currency Recognition Toast Notification in Vision */}
                <AnimatePresence>
                  {visionCurrencyToast && (
                    <motion.div
                      initial={{ opacity: 0, y: -20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className={`absolute top-3 right-3 left-auto z-30 max-w-sm bg-[#0a0e1a]/95 backdrop-blur-xl border rounded-xl p-3 shadow-2xl flex items-center justify-between text-white ${visionCurrencyToast.recognized ? 'border-emerald-500/40' : 'border-amber-500/50'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center font-bold text-sm ${visionCurrencyToast.recognized ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' : 'bg-amber-500/20 border-amber-400/40 text-amber-300'}`}>
                          ₹
                        </div>
                        <div>
                          <div className={`font-semibold flex items-center gap-1.5 text-xs ${visionCurrencyToast.recognized ? 'text-emerald-300' : 'text-amber-300'}`}>
                            <span>{visionCurrencyToast.recognized ? `${visionCurrencyToast.denomination} banknote` : `Currency: ${visionCurrencyToast.denomination}`}</span>
                            {visionCurrencyToast.confidence > 0 && <span className="text-[10px] font-normal px-1.5 py-0.2 rounded-full bg-white/10 border border-white/15 text-gray-200">{visionCurrencyToast.confidence}%</span>}
                          </div>
                          <p className="text-[11px] text-gray-300 max-w-[240px]">{visionCurrencyToast.recognized ? visionCurrencyToast.note_design : visionCurrencyToast.message}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setVisionCurrencyToast(null)}
                        className="text-gray-400 hover:text-white p-1 rounded-lg ml-2"
                        aria-label="Dismiss banner"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ─── E. CAMERA CONTROLS ─── */}
              <div className="p-4 flex flex-wrap items-center gap-3">
                {/* Start / Stop Camera */}
                <button
                  onClick={cameraActive ? stopCamera : () => startCamera()}
                  disabled={modelStatus === 'loading' || isStartingCamera}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all ${
                    cameraActive
                      ? 'bg-red-500/20 text-red-400 border border-red-400/30 hover:bg-red-500/30'
                      : 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/30'
                  } disabled:opacity-40`}
                  aria-label={cameraActive ? 'Stop camera' : 'Start camera'}
                >
                  {isStartingCamera ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : cameraActive ? (
                    <CameraOff className="w-4 h-4" />
                  ) : (
                    <CameraIcon className="w-4 h-4" />
                  )}
                  {isStartingCamera ? 'Starting...' : cameraActive ? 'Stop Camera' : 'Start Camera'}
                </button>

                {/* Retry Camera (Requirement E) */}
                {(cameraError || !cameraActive) && (
                  <button
                    onClick={retryCamera}
                    disabled={isStartingCamera}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 transition-all disabled:opacity-40"
                    title="Retry camera initialization"
                    aria-label="Retry camera"
                  >
                    <RefreshCw className={`w-4 h-4 ${isStartingCamera ? 'animate-spin' : ''}`} />
                    Retry Camera
                  </button>
                )}

                {/* Switch Camera if multiple cameras exist (Requirement E) */}
                {availableCameras.length > 1 && (
                  <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-xs text-gray-300">
                    <SwitchCamera className="w-3.5 h-3.5 text-cyan-400" />
                    <select
                      value={selectedCameraId}
                      onChange={(e) => switchCamera(e.target.value)}
                      className="bg-transparent text-xs text-white focus:outline-none cursor-pointer pr-1"
                    >
                      {!selectedCameraId && <option value="" className="bg-navy-900 text-white">Default (rear camera preferred)</option>}
                      {availableCameras.map((cam, idx) => (
                        <option key={cam.deviceId || idx} value={cam.deviceId} className="bg-navy-900 text-white">
                          {cam.label || `Camera ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1" role="group" aria-label="Choose camera scan area">
                  <button
                    type="button"
                    aria-pressed={scanAreaMode === 'focused'}
                    onClick={() => setScanAreaMode('focused')}
                    className={`min-h-12 rounded-full px-3 text-xs transition-colors ${scanAreaMode === 'focused' ? 'bg-cyan-500/25 text-cyan-200' : 'text-gray-400 hover:text-white'}`}
                  >
                    Focus area
                  </button>
                  <button
                    type="button"
                    aria-pressed={scanAreaMode === 'wide'}
                    onClick={() => setScanAreaMode('wide')}
                    className={`min-h-12 rounded-full px-3 text-xs transition-colors ${scanAreaMode === 'wide' ? 'bg-cyan-500/25 text-cyan-200' : 'text-gray-400 hover:text-white'}`}
                  >
                    Wide view
                  </button>
                </div>

                <label className="flex min-h-12 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-xs text-gray-300">
                  <span>Voice</span>
                  <select
                    value={speechLanguage}
                    onChange={(event) => setSpeechLanguage(event.target.value as SpeechLanguage)}
                    className="bg-transparent text-white outline-none"
                    aria-label="Voice language"
                  >
                    <option value="hi" className="bg-navy-900">हिन्दी</option>
                    <option value="en" className="bg-navy-900">English</option>
                  </select>
                </label>

                {/* Describe Surroundings */}
                <button
                  onClick={describeSurroundings}
                  disabled={!cameraActive}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm bg-neon-purple/20 text-neon-purple border border-neon-purple/30 hover:bg-neon-purple/30 disabled:opacity-40 transition-all"
                  aria-label="Describe the selected camera area"
                >
                  <AudioLines className="w-4 h-4" /> Describe Area
                </button>

                {/* Optional saved-family matcher; off by default and yields to the main detector. */}
                <button
                  type="button"
                  onClick={() => {
                    const next = !knownPersonAssistEnabled
                    setKnownPersonAssistEnabled(next)
                    if (!next) {
                      setKnownPersonStatus('Saved-family matching is off.')
                    } else {
                      setKnownPersonStatus('Loading the optional family matcher…')
                    }
                  }}
                  disabled={!cameraActive}
                  aria-pressed={knownPersonAssistEnabled}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm border transition-all disabled:opacity-40 ${knownPersonAssistEnabled ? 'bg-violet-500/20 text-violet-200 border-violet-400/40' : 'border-gray-600/30 hover:bg-white/5 text-gray-300'}`}
                  title="Opt in to match one face against family photos saved on this device"
                >
                  <Users className="w-4 h-4" /> Family match: {knownPersonAssistEnabled ? 'ON' : 'OFF'}
                </button>
                {knownPersonAssistEnabled && (
                  <>
                    <span className="max-w-sm text-xs text-gray-300" role="status" aria-live="polite">{knownPersonStatus}</span>
                    <Suspense fallback={<span className="text-xs text-gray-400">Preparing family matcher…</span>}>
                      <KnownPersonLiveAssist
                        enabled={knownPersonAssistEnabled}
                        cameraActive={cameraActive}
                        video={videoRef.current}
                        language={speechLanguage}
                        canAnalyze={canRunKnownPersonAnalysis}
                        onStatus={reportKnownPersonStatus}
                      />
                    </Suspense>
                  </>
                )}

                {/* Scan Currency Button (Requirement 1) */}
                <button
                  onClick={handleScanCurrencyInVision}
                  disabled={!cameraActive || isVisionCurrencyScanning}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-500/30 disabled:opacity-40 transition-all shadow-sm shadow-emerald-500/10"
                  aria-label="Scan Indian banknote in Vision screen"
                >
                  <Banknote className="w-4 h-4 text-emerald-400" />
                  {isVisionCurrencyScanning ? 'Scanning...' : 'Scan Currency (₹)'}
                </button>

                {/* Auto-read Currency Toggle (Requirement 1) */}
                <button
                  onClick={() => {
                    setAutoReadCurrency(prev => {
                      const next = !prev
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('naviable_auto_currency', String(next))
                      }
                      return next
                    })
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium border transition-all ${
                    autoReadCurrency
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 shadow-sm shadow-emerald-500/10'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:text-gray-300'
                  }`}
                  title="Automatically read Indian banknotes shown to camera"
                >
                  <Banknote className={`w-3.5 h-3.5 ${autoReadCurrency ? 'text-emerald-400' : 'text-gray-500'}`} />
                  Auto-read Currency: {autoReadCurrency ? 'ON' : 'OFF'}
                </button>

                {/* Audio Announcements */}
                <button
                  onClick={() => {
                    const next = !audioEnabled
                    setAudioEnabled(next)
                    if (!next) {
                      VoiceManager.setMode('silent_visual')
                      setAudioMode('silent_visual')
                    } else {
                      VoiceManager.setMode('general_assistance')
                      setAudioMode('general_assistance')
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm border border-gray-600/30 hover:bg-white/5 transition-all"
                  aria-label={audioEnabled ? 'Mute audio' : 'Enable audio'}
                >
                  {audioEnabled ? <Volume2 className="w-4 h-4 text-green-400" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
                  {audioEnabled ? 'Audio On' : 'Audio Off'}
                </button>
              </div>

              {/* Mode-Based Audio Routing Controls (Part 4) */}
              <div className="px-4 pb-3 flex flex-wrap items-center gap-1.5 text-xs border-t border-white/5 pt-3">
                <span className="text-gray-400 text-[11px] font-mono mr-1">Voice Mode:</span>
                {[
                  { id: 'general_assistance', label: 'General Assistance' },
                  { id: 'currency_reading', label: 'Currency Reading' },
                  { id: 'obstacle_proximity', label: 'Obstacle & Proximity' },
                  { id: 'silent_visual', label: 'Silent Visual' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      const modeId = m.id as AudioOperatingMode
                      setAudioMode(modeId)
                      VoiceManager.setMode(modeId)
                      setAudioEnabled(modeId !== 'silent_visual')
                    }}
                    className={`px-3 py-1 rounded-full font-medium transition-all ${
                      audioMode === m.id
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                        : 'text-gray-400 hover:text-white bg-white/5 border border-white/5'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Camera Error Alert */}
              {cameraError && (
                <div className="px-4 pb-4">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{cameraError}</span>
                    </div>
                    <button
                      onClick={retryCamera}
                      className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-400/40 rounded-lg text-xs font-semibold text-red-300 transition-colors flex-shrink-0"
                    >
                      Retry Now
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Detection Panel */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <div className="glass-card p-5 h-fit max-h-[600px] overflow-y-auto">
              <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-cyan-400" /> Detected Objects
              </h3>

              {modelStatus === 'loading' && (
                <div className="flex items-center gap-3 text-yellow-400 text-sm py-8 justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading AI Model...
                </div>
              )}

              {modelStatus === 'error' && (
                <div className="text-red-400 text-sm text-center py-8">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>AI model could not load. It will retry when the connection returns.</p>
                  <button
                    type="button"
                    onClick={() => ensureObjectModelReady(true)}
                    className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl border border-red-400/30 px-4 text-xs font-semibold text-red-200 transition-colors hover:bg-red-400/10"
                  >
                    Retry AI Model
                  </button>
                </div>
              )}

              {detections.length === 0 && cameraActive && modelStatus === 'ready' && (
                <p className="text-gray-500 text-sm text-center py-8">
                  Nothing clearly identified inside the {scanAreaMode} area. Describe Area will explain this and can include a live sensor reading.
                </p>
              )}

              {!cameraActive && modelStatus === 'ready' && (
                <p className="text-gray-500 text-sm text-center py-8">Start the camera to detect objects.</p>
              )}

              <div className="space-y-2">
                {detections.map((d) => {
                  const sceneObject = sceneObjects.find((item) => item.detection.id === d.id)
                  const rangeText = sceneObject?.range === 'close'
                    ? 'Close · visual estimate'
                    : sceneObject?.range === 'nearby'
                      ? 'Nearby · visual estimate'
                      : sceneObject?.range === 'far'
                        ? 'Far · visual estimate'
                        : 'Range not available'
                  const movementText = sceneObject?.movement === 'approaching'
                    ? ' · appears closer'
                    : sceneObject?.movement === 'receding'
                      ? ' · appears farther'
                      : ''
                  return (
                  <div key={d.id} className="bg-white/[0.03] rounded-xl p-3 border border-white/5 hover:border-cyan-400/20 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-medium text-sm capitalize">{d.class}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${posColor(d.position)}`}>
                        {d.position}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-neon-blue transition-all duration-300"
                          style={{ width: `${d.score * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-10 text-right">{Math.round(d.score * 100)}%</span>
                    </div>
                    <p className="mt-2 text-[11px] text-gray-400">{rangeText}{movementText}</p>
                  </div>
                  )
                })}
              </div>
            </div>

            {/* AI Status Mini Panel */}
            <div className="glass-card p-4 mt-4">
              <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-3">AI Status</h4>
              <div className="space-y-2 text-xs">
                {[
                  { label: 'Object Detection', status: modelStatus, ok: modelStatus === 'ready' },
                  { label: 'Camera Stream', status: cameraActive ? 'streaming' : 'inactive', ok: cameraActive },
                  { label: 'Video Feed', status: cameraActive ? `${debugInfo.videoWidth}×${debugInfo.videoHeight}` : 'offline', ok: cameraActive && debugInfo.videoWidth > 0 },
                  { label: 'Voice Output', status: 'available', ok: true },
                  { label: 'Audio Announce', status: audioEnabled ? 'enabled' : 'muted', ok: audioEnabled },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="text-gray-400">{s.label}</span>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${s.ok ? 'bg-green-400' : 'bg-gray-500'}`} />
                      <span className={s.ok ? 'text-green-400' : 'text-gray-500'}>{s.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-4 mt-4 border-cyan-500/15">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-300">Distance sensor</h4>
                <span className={`text-[11px] ${sensorConnected ? 'text-green-400' : 'text-gray-500'}`}>
                  {sensorConnected ? 'Connected' : 'Optional'}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-gray-400 mb-3">
                {sensorDistance !== null
                  ? `Hardware reading: ${Math.round(sensorDistance)} cm · Range ${sensorRangeTrend === 'APPROACHING' ? 'decreasing' : sensorRangeTrend === 'RECEDING' ? 'increasing' : sensorRangeTrend === 'STABLE' ? 'steady' : 'trend unavailable'}`
                  : sensorConnected
                    ? 'Connected; waiting for a distance reading.'
                    : 'Camera estimates near or far. A ToF sensor can provide a measured distance.'}
              </p>
              <button
                type="button"
                onClick={sensorConnected ? handleDisconnectSensor : handleConnectSensor}
                disabled={sensorConnecting || (!sensorConnected && !isBLESupported())}
                className="min-h-12 w-full rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-3 text-xs font-medium text-cyan-200 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sensorConnecting ? 'Connecting…' : sensorConnected ? 'Disconnect sensor' : isBLESupported() ? 'Connect ToF sensor' : 'Bluetooth unavailable'}
              </button>
              {!sensorConnected && isBLESupported() && (
                <p className="mt-2 text-[10px] leading-relaxed text-gray-500">
                  Works with NaviAble BLE firmware on a secure browser connection.
                </p>
              )}
            </div>
            <TestLog />
          </motion.div>
        </div>
      </div>
    </div>
  )
}
