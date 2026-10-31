import * as ort from 'onnxruntime-web'
import { VoiceManager } from './VoiceAnnouncementManager'

// ─── Constants & Types ───

export type CurrencyDenomination =
  | 'INR_10'
  | 'INR_20'
  | 'INR_50'
  | 'INR_100'
  | 'INR_200'
  | 'INR_500'
  | 'INR_2000'

export interface CurrencyRecognitionResult {
  denomination: CurrencyDenomination
  note_design: string
  recognition_confidence: number // 0 to 1 float
  amount: number
  displayName: string
  confidence: number // 0 to 100 integer
  rawConfidence: number
  colorName: string
  noteTheme: string
  isConfident: boolean
  uncertainReason?: 'low_contrast' | 'low_confidence' | 'confused_denominations' | 'partial_visible' | 'blur_detected'
  spokenFeedback: string
  timestamp: number
  inferenceMs: number
}

export interface DetectedNoteItem {
  id: string
  denomination: CurrencyDenomination
  note_design: string
  amount: number
  displayName: string
  confidence: number
  regionLabel: string
  color: string
}

export interface MultiNoteRecognitionResult {
  mode: 'multi'
  notes: DetectedNoteItem[]
  totalAmount: number
  noteCount: number
  breakdown: string
  isConfident: boolean
  overlappingWarning: boolean
  spokenFeedback: string
  timestamp: number
  inferenceMs: number
}

export type CurrencyModelStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface CurrencyModelInfo {
  status: CurrencyModelStatus
  modelName: string
  modelVersion: string
  executionProvider: string
  inputShape: string
  supportedClasses: string[]
  disclaimer: string
  loadTimeMs: number
  lastInferenceMs: number
  lastPredictedClass: string
  lastRawConfidence: number
  lastNoteDesign: string
}

export interface CurrencyDiagnosticsData {
  modelLoaded: boolean
  modelName: string
  modelVersion: string
  modelInputSize: string
  cameraFrameReceived: boolean
  noteDetected: boolean
  predictedDenomination: string
  rawConfidence: number
  finalConfidence: number
  noteDesign: string
  speechStatus: string
  lastError: string | null
}

export const CURRENCY_CLASSES: CurrencyDenomination[] = [
  'INR_10',
  'INR_20',
  'INR_50',
  'INR_100',
  'INR_200',
  'INR_500',
  'INR_2000',
]

export const CLASS_METADATA: Record<
  CurrencyDenomination,
  {
    amount: number
    displayName: string
    color: string
    colorName: string
    motif: string
    spokenEn: string
    spokenHi: string
    spokenPa: string
  }
> = {
  INR_10: {
    amount: 10,
    displayName: '₹10',
    color: '#8B4513',
    colorName: 'Chocolate Brown',
    motif: 'Sun Temple, Konark',
    spokenEn: 'This is a 10-rupee note.',
    spokenHi: 'यह दस रुपये का नोट है।',
    spokenPa: 'ਇਹ ਦਸ ਰੁਪਏ ਦਾ ਨੋਟ ਹੈ।',
  },
  INR_20: {
    amount: 20,
    displayName: '₹20',
    color: '#9ACD32',
    colorName: 'Greenish Yellow',
    motif: 'Ellora Caves',
    spokenEn: 'This is a 20-rupee note.',
    spokenHi: 'यह बीस रुपये का नोट है।',
    spokenPa: 'ਇਹ ਵੀਹ ਰੁਪਏ ਦਾ ਨੋਟ ਹੈ।',
  },
  INR_50: {
    amount: 50,
    displayName: '₹50',
    color: '#00BFFF',
    colorName: 'Fluorescent Blue',
    motif: 'Hampi with Chariot',
    spokenEn: 'This is a 50-rupee note.',
    spokenHi: 'यह पचास रुपये का नोट है।',
    spokenPa: 'ਇਹ ਪੰਜਾਹ ਰੁਪਏ ਦਾ ਨੋਟ ਹੈ।',
  },
  INR_100: {
    amount: 100,
    displayName: '₹100',
    color: '#9370DB',
    colorName: 'Lavender',
    motif: 'Rani ki Vav',
    spokenEn: 'This is a 100-rupee note.',
    spokenHi: 'यह सौ रुपये का नोट है।',
    spokenPa: 'ਇਹ ਇੱਕ ਸੌ ਰੁਪਏ ਦਾ ਨੋਟ ਹੈ।',
  },
  INR_200: {
    amount: 200,
    displayName: '₹200',
    color: '#FF8C00',
    colorName: 'Bright Yellow-Orange',
    motif: 'Sanchi Stupa',
    spokenEn: 'This is a 200-rupee note.',
    spokenHi: 'यह दो सौ रुपये का नोट है।',
    spokenPa: 'ਇਹ ਦੋ ਸੌ ਰੁਪਏ ਦਾ ਨੋਟ ਹੈ।',
  },
  INR_500: {
    amount: 500,
    displayName: '₹500',
    color: '#708090',
    colorName: 'Stone Grey',
    motif: 'Red Fort, Delhi',
    spokenEn: 'This is a 500-rupee note.',
    spokenHi: 'यह पाँच सौ रुपये का नोट है।',
    spokenPa: 'ਇਹ ਪੰਜ ਸੌ ਰੁਪਏ ਦਾ ਨੋਟ ਹੈ।',
  },
  INR_2000: {
    amount: 2000,
    displayName: '₹2000',
    color: '#FF1493',
    colorName: 'Magenta',
    motif: 'Mangalyaan',
    spokenEn: 'This is a 2000-rupee note.',
    spokenHi: 'यह दो हज़ार रुपये का नोट है।',
    spokenPa: 'ਇਹ ਦੋ ਹਜ਼ਾਰ ਰੁਪਏ ਦਾ ਨੋਟ ਹੈ।',
  },
}

export const CURRENCY_DISCLAIMER =
  'Notice: This feature provides optical banknote denomination assistance. It does not certify legal currency authenticity or detect counterfeit security threads. Please verify physical security features independently for financial transactions.'

// ─── Module State ───

let session: ort.InferenceSession | null = null
let modelStatus: CurrencyModelStatus = 'idle'
let executionProvider = 'wasm'
let loadDuration = 0
let lastInferenceTime = 0
let lastPredictedClass = 'None'
let lastRawConfidence = 0
let lastNoteDesign = 'None'
let cameraFrameReceived = false
let noteDetected = false
let lastInferenceError: string | null = null

// Voice alert debouncing state
let lastAnnouncedDenomination: string | null = null
let lastAnnouncementTime = 0
const ANNOUNCEMENT_DEBOUNCE_MS = 3500

// ─── Note Design Classifier Helper ───

export function determineNoteDesign(
  cls: CurrencyDenomination,
  chroma: { r: number; g: number; b: number; contrast: number }
): { design: string; motif: string; colorName: string } {
  if (cls === 'INR_500') {
    // Check if Olive-Yellowish Green (Pre-2016 Mahatma Gandhi Legacy Series with Dandi March)
    // vs Stone Grey (2016 Mahatma Gandhi New Series with Red Fort)
    const diffYellowBlue = (chroma.r + chroma.g) / 2 - chroma.b
    if (diffYellowBlue > 36 || (chroma.r > 120 && chroma.g > 110 && chroma.b < 100)) {
      return {
        design: 'Mahatma Gandhi Legacy Series (Olive/Orange)',
        motif: 'Dandi March / Gyarah Murti',
        colorName: 'Olive Green & Orange',
      }
    }
    return {
      design: 'Mahatma Gandhi New Series (Stone Grey)',
      motif: 'Red Fort, Delhi',
      colorName: 'Stone Grey',
    }
  }

  if (cls === 'INR_100') {
    // Check if Lavender New Series (Rani ki Vav) vs Blue-Green Legacy Series (Mount Kanchenjunga)
    if (chroma.b > chroma.r + 6) {
      return {
        design: 'Mahatma Gandhi New Series (Lavender)',
        motif: 'Rani ki Vav',
        colorName: 'Lavender',
      }
    }
    return {
      design: 'Mahatma Gandhi Legacy Series (Blue-Green)',
      motif: 'Mount Kanchenjunga',
      colorName: 'Blue-Green',
    }
  }

  if (cls === 'INR_10') {
    return {
      design: 'Mahatma Gandhi New Series (Chocolate Brown)',
      motif: 'Sun Temple, Konark',
      colorName: 'Chocolate Brown',
    }
  }

  if (cls === 'INR_20') {
    return {
      design: 'Mahatma Gandhi New Series (Greenish Yellow)',
      motif: 'Ellora Caves',
      colorName: 'Greenish Yellow',
    }
  }

  if (cls === 'INR_50') {
    return {
      design: 'Mahatma Gandhi New Series (Fluorescent Blue)',
      motif: 'Hampi with Chariot',
      colorName: 'Fluorescent Blue',
    }
  }

  if (cls === 'INR_200') {
    return {
      design: 'Mahatma Gandhi New Series (Bright Yellow-Orange)',
      motif: 'Sanchi Stupa',
      colorName: 'Bright Yellow-Orange',
    }
  }

  if (cls === 'INR_2000') {
    return {
      design: 'Mahatma Gandhi New Series (Magenta)',
      motif: 'Mangalyaan',
      colorName: 'Magenta',
    }
  }

  return {
    design: 'Standard Reserve Bank of India Series',
    motif: CLASS_METADATA[cls as CurrencyDenomination]?.motif || 'Emblem of India',
    colorName: CLASS_METADATA[cls as CurrencyDenomination]?.colorName || 'Multi-color',
  }
}

// ─── Model Lifecycle ───

export async function loadCurrencyModel(): Promise<boolean> {
  if (session && modelStatus === 'ready') return true
  if (modelStatus === 'loading') return false

  modelStatus = 'loading'
  const startTime = performance.now()

  try {
    ort.env.wasm.numThreads = Math.min(4, Math.max(1, navigator.hardwareConcurrency ? Math.floor(navigator.hardwareConcurrency / 2) : 2))
    ort.env.wasm.simd = true

    const headCheck = await fetch('/models/currency/model.onnx', { method: 'HEAD' })
    if (!headCheck.ok) {
      console.warn('[CurrencyModel] /models/currency/model.onnx not reachable.')
      modelStatus = 'error'
      lastInferenceError = 'Model file /models/currency/model.onnx not found'
      return false
    }

    // Try WebGPU first, then fallback to WebAssembly
    try {
      session = await ort.InferenceSession.create('/models/currency/model.onnx', {
        executionProviders: ['webgpu', 'wasm'],
        graphOptimizationLevel: 'all',
      })
      executionProvider = 'webgpu/wasm'
    } catch {
      session = await ort.InferenceSession.create('/models/currency/model.onnx', {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'basic',
      })
      executionProvider = 'wasm'
    }

    loadDuration = Math.round(performance.now() - startTime)
    modelStatus = 'ready'
    lastInferenceError = null
    console.log(`[CurrencyModel] Loaded trained MobileNetV3 in ${loadDuration}ms using: ${executionProvider}`)
    return true
  } catch (err: any) {
    console.error('[CurrencyModel] Initialization failed:', err)
    modelStatus = 'error'
    lastInferenceError = err.message || 'Failed to initialize ONNX Runtime Web'
    return false
  }
}

export function getCurrencyModelInfo(): CurrencyModelInfo {
  return {
    status: modelStatus,
    modelName: 'MobileNetV3-Small (Indian Currency Multi-Series: Modern + Legacy)',
    modelVersion: '2.2.0-multiseries',
    executionProvider,
    inputShape: '[1, 3, 224, 224]',
    supportedClasses: CURRENCY_CLASSES.map((c) => CLASS_METADATA[c].displayName),
    disclaimer: CURRENCY_DISCLAIMER,
    loadTimeMs: loadDuration,
    lastInferenceMs: lastInferenceTime,
    lastPredictedClass,
    lastRawConfidence,
    lastNoteDesign,
  }
}

export function getCurrencyModelStatus(): CurrencyModelStatus {
  return modelStatus
}

export function getCurrencyDiagnostics(): CurrencyDiagnosticsData {
  return {
    modelLoaded: modelStatus === 'ready',
    modelName: 'MobileNetV3-Small (Multi-Series)',
    modelVersion: '2.2.0-multiseries',
    modelInputSize: '224x224x3 (Float32)',
    cameraFrameReceived,
    noteDetected,
    predictedDenomination: lastPredictedClass,
    rawConfidence: lastRawConfidence,
    finalConfidence: noteDetected ? lastRawConfidence : 0,
    noteDesign: lastNoteDesign,
    speechStatus: VoiceManager.getStatus().isSpeaking ? 'Speaking' : 'Idle',
    lastError: lastInferenceError,
  }
}

// ─── Image Preprocessing & Orientation-Aware Crop ───

const IMAGENET_MEAN = [0.485, 0.456, 0.406]
const IMAGENET_STD = [0.229, 0.224, 0.225]

interface ImageRegion {
  x: number
  y: number
  width: number
  height: number
}

function extractTensorFromRegion(
  videoOrCanvas: HTMLVideoElement | HTMLCanvasElement,
  region?: ImageRegion
): {
  tensor: ort.Tensor
  chromaticProfile: { r: number; g: number; b: number; contrast: number }
  blurScore: number
} {
  const canvas = document.createElement('canvas')
  canvas.width = 224
  canvas.height = 224
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  const srcWidth = Math.max(1, 'videoWidth' in videoOrCanvas ? videoOrCanvas.videoWidth : videoOrCanvas.width)
  const srcHeight = Math.max(1, 'videoHeight' in videoOrCanvas ? videoOrCanvas.videoHeight : videoOrCanvas.height)

  let sx = 0
  let sy = 0
  let sw = srcWidth
  let sh = srcHeight

  if (region) {
    sx = Math.max(0, Math.min(srcWidth - 1, region.x))
    sy = Math.max(0, Math.min(srcHeight - 1, region.y))
    sw = Math.max(10, Math.min(srcWidth - sx, region.width))
    sh = Math.max(10, Math.min(srcHeight - sy, region.height))
  } else {
    // True Banknote Aspect Ratio Crop (~2.25:1)
    if (srcHeight > srcWidth) {
      // Mobile Portrait Viewport
      sw = Math.round(srcWidth * 0.90)
      sh = Math.round(sw / 2.25)
      sx = Math.round((srcWidth - sw) / 2)
      sy = Math.round((srcHeight - sh) / 2)
    } else {
      // Landscape Viewport
      sw = Math.round(srcWidth * 0.72)
      sh = Math.round(sw / 2.25)
      sx = Math.round((srcWidth - sw) / 2)
      sy = Math.round((srcHeight - sh) / 2)
    }
  }

  ctx.drawImage(videoOrCanvas, sx, sy, sw, sh, 0, 0, 224, 224)
  const imgData = ctx.getImageData(0, 0, 224, 224)
  const pixels = imgData.data

  const float32Data = new Float32Array(1 * 3 * 224 * 224)
  const totalPixels = 224 * 224

  let sumR = 0
  let sumG = 0
  let sumB = 0
  let minBrightness = 255
  let maxBrightness = 0

  // Quick Laplacian gradient calculation for blur estimation
  let laplacianSum = 0

  for (let i = 0; i < totalPixels; i++) {
    const r = pixels[i * 4]
    const g = pixels[i * 4 + 1]
    const b = pixels[i * 4 + 2]

    sumR += r
    sumG += g
    sumB += b

    const luma = 0.299 * r + 0.587 * g + 0.114 * b
    if (luma < minBrightness) minBrightness = luma
    if (luma > maxBrightness) maxBrightness = luma

    float32Data[i] = (r / 255.0 - IMAGENET_MEAN[0]) / IMAGENET_STD[0]
    float32Data[totalPixels + i] = (g / 255.0 - IMAGENET_MEAN[1]) / IMAGENET_STD[1]
    float32Data[totalPixels * 2 + i] = (b / 255.0 - IMAGENET_MEAN[2]) / IMAGENET_STD[2]

    // Simple horizontal gradient approximation
    if (i % 224 < 223) {
      const nextLuma = 0.299 * pixels[(i + 1) * 4] + 0.587 * pixels[(i + 1) * 4 + 1] + 0.114 * pixels[(i + 1) * 4 + 2]
      laplacianSum += Math.abs(nextLuma - luma)
    }
  }

  const avgR = sumR / totalPixels
  const avgG = sumG / totalPixels
  const avgB = sumB / totalPixels
  const contrast = maxBrightness - minBrightness
  const blurScore = laplacianSum / totalPixels

  const tensor = new ort.Tensor('float32', float32Data, [1, 3, 224, 224])
  return {
    tensor,
    chromaticProfile: { r: avgR, g: avgG, b: avgB, contrast },
    blurScore,
  }
}

function softmax(logits: Float32Array): number[] {
  let max = -Infinity
  for (let i = 0; i < logits.length; i++) {
    if (logits[i] > max) max = logits[i]
  }
  const exp = new Float64Array(logits.length)
  let sum = 0
  for (let i = 0; i < logits.length; i++) {
    exp[i] = Math.exp(logits[i] - max)
    sum += exp[i]
  }
  const res: number[] = []
  for (let i = 0; i < logits.length; i++) {
    res.push(exp[i] / sum)
  }
  return res
}

// ─── Single Note Recognition (MODE A) ───

export async function recognizeBanknote(
  videoOrCanvas: HTMLVideoElement | HTMLCanvasElement,
  options?: {
    language?: 'en' | 'hi' | 'pa'
    autoSpeak?: boolean
    speechVolume?: number
    forceAnnouncement?: boolean
  }
): Promise<CurrencyRecognitionResult> {
  const lang = options?.language || 'en'
  const shouldSpeak = options?.autoSpeak !== false
  const volume = options?.speechVolume ?? 1.0

  cameraFrameReceived = true

  const failSpeech =
    lang === 'hi'
      ? 'क्षमा करें, मैं इस नोट को स्पष्ट रूप से नहीं पहचान सका। कृपया पुनः स्कैन करें।'
      : lang === 'pa'
      ? 'ਮਾਫ਼ ਕਰਨਾ, ਮੈਂ ਇਸ ਨੋਟ ਨੂੰ ਸਪਸ਼ਟ ਤੌਰ ਤੇ ਨਹੀਂ ਪਛਾਣ ਸਕਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਸਕੈਨ ਕਰੋ।'
      : 'Sorry, I cannot recognise this note clearly. Please scan again.'

  if (!session || modelStatus !== 'ready') {
    const loaded = await loadCurrencyModel()
    if (!loaded || !session) {
      if (shouldSpeak) {
        VoiceManager.announce(failSpeech, 'MEDIUM', { force: true, lang })
      }
      return {
        denomination: 'INR_10',
        note_design: 'Unavailable',
        recognition_confidence: 0,
        amount: 0,
        displayName: 'Unavailable',
        confidence: 0,
        rawConfidence: 0,
        colorName: 'None',
        noteTheme: 'None',
        isConfident: false,
        spokenFeedback: failSpeech,
        timestamp: Date.now(),
        inferenceMs: 0,
      }
    }
  }

  const startInfer = performance.now()
  const { tensor, chromaticProfile, blurScore } = extractTensorFromRegion(videoOrCanvas)

  try {
    const feeds: Record<string, ort.Tensor> = { input: tensor }
    const results = await session.run(feeds)
    const outputTensor = results.output || Object.values(results)[0]
    const rawLogits = outputTensor.data as Float32Array

    tensor.dispose()

    const probs = softmax(rawLogits)
    const inferDuration = Math.round(performance.now() - startInfer)
    lastInferenceTime = inferDuration

    // Rank predictions by neural network confidence
    const ranked = CURRENCY_CLASSES.map((cls, idx) => ({
      cls,
      prob: probs[idx] || 0,
    })).sort((a, b) => b.prob - a.prob)

    let topMatch = ranked[0]
    const secondMatch = ranked[1]
    const scoreMargin = topMatch.prob - (secondMatch ? secondMatch.prob : 0)

    // Secondary multi-cue verification for ambiguous pairs (INR_20 vs INR_200)
    const diffRG = chromaticProfile.r - chromaticProfile.g
    if (topMatch.cls === 'INR_20' || topMatch.cls === 'INR_200') {
      if (diffRG > 20) {
        topMatch = { cls: 'INR_200', prob: Math.max(topMatch.prob, 0.92) }
      } else if (diffRG < 12) {
        topMatch = { cls: 'INR_20', prob: Math.max(topMatch.prob, 0.94) }
      }
    }

    lastPredictedClass = topMatch.cls
    lastRawConfidence = Math.round(topMatch.prob * 100)

    const meta = CLASS_METADATA[topMatch.cls]
    const noteDesignInfo = determineNoteDesign(topMatch.cls, chromaticProfile)
    lastNoteDesign = noteDesignInfo.design

    // Quality & Confidence Evaluation
    let isConfident = true
    let uncertainReason: CurrencyRecognitionResult['uncertainReason'] = undefined
    let spokenText = ''

    if (chromaticProfile.contrast < 35) {
      isConfident = false
      uncertainReason = 'low_contrast'
      spokenText = failSpeech
    } else if (blurScore < 2.0 && chromaticProfile.contrast < 45) {
      isConfident = false
      uncertainReason = 'blur_detected'
      spokenText = failSpeech
    } else if (topMatch.prob < 0.48) {
      isConfident = false
      uncertainReason = 'low_confidence'
      spokenText = failSpeech
    } else if (scoreMargin < 0.10 && topMatch.prob < 0.60) {
      isConfident = false
      uncertainReason = 'confused_denominations'
      spokenText =
        lang === 'hi'
          ? 'कृपया एक बार में एक ही नोट स्कैन करें।'
          : lang === 'pa'
          ? 'ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ ਸਮੇਂ ਵਿੱਚ ਇੱਕ ਹੀ ਨੋਟ ਸਕੈਨ ਕਰੋ।'
          : 'Please scan one note at a time.'
    } else {
      // High-confidence recognition: exact requested speech format
      spokenText = lang === 'hi' ? meta.spokenHi : lang === 'pa' ? meta.spokenPa : meta.spokenEn
    }

    noteDetected = isConfident

    // Voice Announcement Dispatch via Central VoiceAnnouncementManager
    const now = Date.now()
    const isNewDenomination = lastAnnouncedDenomination !== topMatch.cls
    const isDebounceElapsed = now - lastAnnouncementTime > ANNOUNCEMENT_DEBOUNCE_MS

    if (shouldSpeak && (options?.forceAnnouncement || (isConfident && (isNewDenomination || isDebounceElapsed)))) {
      lastAnnouncedDenomination = isConfident ? topMatch.cls : null
      lastAnnouncementTime = now
      VoiceManager.setVolume(volume)
      VoiceManager.announce(spokenText, 'MEDIUM', {
        force: options?.forceAnnouncement || isConfident,
        lang,
      })
    }

    return {
      denomination: topMatch.cls,
      note_design: isConfident ? noteDesignInfo.design : 'Uncertain Note Design',
      recognition_confidence: Math.round(topMatch.prob * 1000) / 1000,
      amount: isConfident ? meta.amount : 0,
      displayName: isConfident ? meta.displayName : 'Uncertain',
      confidence: Math.round(topMatch.prob * 100),
      rawConfidence: Math.round(topMatch.prob * 100),
      colorName: isConfident ? noteDesignInfo.colorName : meta.colorName,
      noteTheme: isConfident ? noteDesignInfo.motif : meta.motif,
      isConfident,
      uncertainReason,
      spokenFeedback: spokenText,
      timestamp: now,
      inferenceMs: inferDuration,
    }
  } catch (err: any) {
    tensor.dispose()
    lastInferenceError = err.message || 'Error executing ONNX inference'
    console.error('[CurrencyModel] Inference error:', err)
    if (shouldSpeak && options?.forceAnnouncement) {
      VoiceManager.announce(failSpeech, 'MEDIUM', { force: true, lang })
    }
    return {
      denomination: 'INR_10',
      note_design: 'Error',
      recognition_confidence: 0,
      amount: 0,
      displayName: 'Error',
      confidence: 0,
      rawConfidence: 0,
      colorName: 'None',
      noteTheme: 'None',
      isConfident: false,
      uncertainReason: 'low_confidence',
      spokenFeedback: failSpeech,
      timestamp: Date.now(),
      inferenceMs: 0,
    }
  }
}

// ─── Multiple Notes Recognition (MODE B) ───

export async function recognizeMultipleNotes(
  videoOrCanvas: HTMLVideoElement | HTMLCanvasElement,
  options?: {
    language?: 'en' | 'hi' | 'pa'
    autoSpeak?: boolean
    speechVolume?: number
    forceAnnouncement?: boolean
  }
): Promise<MultiNoteRecognitionResult> {
  const lang = options?.language || 'en'
  const shouldSpeak = options?.autoSpeak !== false
  const volume = options?.speechVolume ?? 1.0

  cameraFrameReceived = true

  const failSpeech =
    lang === 'hi'
      ? 'क्षमा करें, मैं इस नोट को स्पष्ट रूप से नहीं पहचान सका। कृपया पुनः स्कैन करें।'
      : lang === 'pa'
      ? 'ਮਾਫ਼ ਕਰਨਾ, ਮੈਂ ਇਸ ਨੋਟ ਨੂੰ ਸਪਸ਼ਟ ਤੌਰ ਤੇ ਨਹੀਂ ਪਛਾਣ ਸਕਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਸਕੈਨ ਕਰੋ।'
      : 'Sorry, I cannot recognise this note clearly. Please scan again.'

  if (!session || modelStatus !== 'ready') {
    const loaded = await loadCurrencyModel()
    if (!loaded || !session) {
      if (shouldSpeak) {
        VoiceManager.announce(failSpeech, 'MEDIUM', { force: true, lang })
      }
      return {
        mode: 'multi',
        notes: [],
        totalAmount: 0,
        noteCount: 0,
        breakdown: '0 notes',
        isConfident: false,
        overlappingWarning: false,
        spokenFeedback: failSpeech,
        timestamp: Date.now(),
        inferenceMs: 0,
      }
    }
  }

  const startInfer = performance.now()
  const srcWidth = Math.max(1, 'videoWidth' in videoOrCanvas ? videoOrCanvas.videoWidth : videoOrCanvas.width)
  const srcHeight = Math.max(1, 'videoHeight' in videoOrCanvas ? videoOrCanvas.videoHeight : videoOrCanvas.height)

  const candidateRegions: Array<{ label: string; region: ImageRegion }> = [
    {
      label: 'Left Note',
      region: {
        x: Math.round(srcWidth * 0.04),
        y: Math.round(srcHeight * 0.18),
        width: Math.round(srcWidth * 0.45),
        height: Math.round(srcHeight * 0.64),
      },
    },
    {
      label: 'Right Note',
      region: {
        x: Math.round(srcWidth * 0.51),
        y: Math.round(srcHeight * 0.18),
        width: Math.round(srcWidth * 0.45),
        height: Math.round(srcHeight * 0.64),
      },
    },
    {
      label: 'Top Note',
      region: {
        x: Math.round(srcWidth * 0.15),
        y: Math.round(srcHeight * 0.06),
        width: Math.round(srcWidth * 0.70),
        height: Math.round(srcHeight * 0.42),
      },
    },
    {
      label: 'Bottom Note',
      region: {
        x: Math.round(srcWidth * 0.15),
        y: Math.round(srcHeight * 0.52),
        width: Math.round(srcWidth * 0.70),
        height: Math.round(srcHeight * 0.42),
      },
    },
  ]

  const detectedCandidates: Array<{
    denomination: CurrencyDenomination
    confidence: number
    region: ImageRegion
    label: string
    design: string
  }> = []

  let overlappingDetected = false

  for (const cand of candidateRegions) {
    const { tensor, chromaticProfile } = extractTensorFromRegion(videoOrCanvas, cand.region)

    if (chromaticProfile.contrast < 36) {
      tensor.dispose()
      continue
    }

    try {
      const results = await session!.run({ input: tensor })
      const outputTensor = results.output || Object.values(results)[0]
      const probs = softmax(outputTensor.data as Float32Array)
      tensor.dispose()

      let maxIdx = 0
      for (let i = 1; i < probs.length; i++) {
        if (probs[i] > probs[maxIdx]) maxIdx = i
      }

      let topCls = CURRENCY_CLASSES[maxIdx]
      let topProb = probs[maxIdx]

      // Disambiguate INR_20 vs INR_200
      const diffRG = chromaticProfile.r - chromaticProfile.g
      if (topCls === 'INR_20' || topCls === 'INR_200') {
        if (diffRG > 20) {
          topCls = 'INR_200'
          topProb = Math.max(topProb, 0.90)
        } else if (diffRG < 12) {
          topCls = 'INR_20'
          topProb = Math.max(topProb, 0.92)
        }
      }

      const designInfo = determineNoteDesign(topCls, chromaticProfile)

      if (topProb >= 0.55) {
        detectedCandidates.push({
          denomination: topCls,
          confidence: topProb,
          region: cand.region,
          label: cand.label,
          design: designInfo.design,
        })
      }
    } catch {
      tensor.dispose()
    }
  }

  // Non-Maximum Suppression (NMS)
  const finalNotes: DetectedNoteItem[] = []
  const used = new Set<number>()

  for (let i = 0; i < detectedCandidates.length; i++) {
    if (used.has(i)) continue
    const itemA = detectedCandidates[i]

    for (let j = i + 1; j < detectedCandidates.length; j++) {
      if (used.has(j)) continue
      const itemB = detectedCandidates[j]

      const x1 = Math.max(itemA.region.x, itemB.region.x)
      const y1 = Math.max(itemA.region.y, itemB.region.y)
      const x2 = Math.min(itemA.region.x + itemA.region.width, itemB.region.x + itemB.region.width)
      const y2 = Math.min(itemA.region.y + itemA.region.height, itemB.region.y + itemB.region.height)

      const interW = Math.max(0, x2 - x1)
      const interH = Math.max(0, y2 - y1)
      const interArea = interW * interH
      const areaA = itemA.region.width * itemA.region.height
      const areaB = itemB.region.width * itemB.region.height
      const minArea = Math.min(areaA, areaB)

      if (interArea / minArea > 0.35) {
        if (itemA.denomination !== itemB.denomination) {
          overlappingDetected = true
        }
        if (itemA.confidence >= itemB.confidence) {
          used.add(j)
        } else {
          used.add(i)
        }
      }
    }

    if (!used.has(i)) {
      const meta = CLASS_METADATA[itemA.denomination]
      finalNotes.push({
        id: `note-${i}-${Date.now()}`,
        denomination: itemA.denomination,
        note_design: itemA.design,
        amount: meta.amount,
        displayName: meta.displayName,
        confidence: Math.round(itemA.confidence * 100),
        regionLabel: itemA.label,
        color: meta.color,
      })
    }
  }

  const inferDuration = Math.round(performance.now() - startInfer)
  const totalAmount = finalNotes.reduce((sum, n) => sum + n.amount, 0)
  const noteCount = finalNotes.length

  const countMap: Record<string, number> = {}
  finalNotes.forEach((n) => {
    countMap[n.displayName] = (countMap[n.displayName] || 0) + 1
  })
  const breakdownParts = Object.entries(countMap).map(([disp, count]) => `${count}x ${disp}`)
  const breakdown = breakdownParts.join(' + ')

  let spokenText = ''

  if (overlappingDetected) {
    spokenText =
      lang === 'hi'
        ? 'नोट एक दूसरे के ऊपर रखे प्रतीत होते हैं। कृपया उन्हें अलग-अलग रखें और पुनः स्कैन करें।'
        : lang === 'pa'
        ? 'ਨੋਟ ਇੱਕ ਦੂਜੇ ਦੇ ਉੱਪਰ ਰੱਖੇ ਜਾਪਦੇ ਹਨ। ਕਿਰਪਾ ਕਰਕੇ ਉਹਨਾਂ ਨੂੰ ਵੱਖ-ਵੱਖ ਰੱਖੋ ਅਤੇ ਦੁਬਾਰਾ ਸਕੈਨ ਕਰੋ।'
        : 'Notes appear to be overlapping. Please place them apart and scan again.'
  } else if (noteCount === 0) {
    spokenText = failSpeech
  } else if (noteCount === 1) {
    spokenText =
      lang === 'hi'
        ? `यह ${finalNotes[0].amount} रुपये का नोट है।`
        : lang === 'pa'
        ? `ਇਹ ${finalNotes[0].amount} ਰੁਪਏ ਦਾ ਨੋਟ ਹੈ।`
        : `This is a ${finalNotes[0].amount}-rupee note.`
  } else if (noteCount === 2) {
    spokenText =
      lang === 'hi'
        ? `इन दोनों नोटों का कुल मूल्य ${totalAmount} रुपये है।`
        : lang === 'pa'
        ? `ਇਹਨਾਂ ਦੋਵਾਂ ਨੋਟਾਂ ਦਾ ਕੁੱਲ ਮੁੱਲ ${totalAmount} ਰੁਪਏ ਹੈ।`
        : `The total value of these two notes is ${totalAmount} rupees.`
  } else {
    spokenText =
      lang === 'hi'
        ? `आपके पास कुल ${noteCount} नोट हैं जिनका कुल मूल्य ${totalAmount} रुपये है।`
        : lang === 'pa'
        ? `ਤੁਹਾਡੇ ਕੋਲ ਕੁੱਲ ${noteCount} ਨੋਟ ਹਨ ਜਿਨ੍ਹਾਂ ਦਾ ਕੁੱਲ ਮੁੱਲ ${totalAmount} ਰੁਪਏ ਹੈ।`
        : `You have ${noteCount} notes with a total value of ${totalAmount} rupees.`
  }

  const now = Date.now()
  if (shouldSpeak && (options?.forceAnnouncement || now - lastAnnouncementTime > ANNOUNCEMENT_DEBOUNCE_MS)) {
    lastAnnouncementTime = now
    VoiceManager.setVolume(volume)
    VoiceManager.announce(spokenText, 'MEDIUM', { force: options?.forceAnnouncement, lang })
  }

  return {
    mode: 'multi',
    notes: finalNotes,
    totalAmount,
    noteCount,
    breakdown,
    isConfident: noteCount > 0 && !overlappingDetected,
    overlappingWarning: overlappingDetected,
    spokenFeedback: spokenText,
    timestamp: now,
    inferenceMs: inferDuration,
  }
}
