import * as ort from 'onnxruntime-web'
import { VoiceManager } from './VoiceAnnouncementManager'

// ─── Constants & Types ───

export type BanknoteRecognitionState =
  | 'BANKNOTE_DETECTED'
  | 'DENOMINATION_RECOGNISED'
  | 'NO_BANKNOTE_DETECTED'
  | 'UNKNOWN_OBJECT'
  | 'LOW_CONFIDENCE'
  | 'MULTIPLE_NOTES_UNRESOLVED'

export type CurrencyDenomination =
  | 'INR_10'
  | 'INR_20'
  | 'INR_50'
  | 'INR_100'
  | 'INR_200'
  | 'INR_500'
  | 'INR_2000'
  | 'NEGATIVE'

export interface BanknotePresenceResult {
  hasBanknotePresence: boolean
  presenceConfidence: number
  rejectionReason?: string
  aspectRatioDetected: number
  isScreenOrDocument: boolean
}

export interface CurrencyRecognitionResult {
  state: BanknoteRecognitionState
  banknotePresence: boolean
  presenceConfidence: number
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
  uncertainReason?:
    | 'no_banknote'
    | 'ordinary_object'
    | 'low_contrast'
    | 'low_confidence'
    | 'confused_denominations'
    | 'partial_visible'
    | 'blur_detected'
  rejectionReason?: string
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
  banknotePresence: boolean
  presenceConfidence: number
  state: BanknoteRecognitionState
  noteDetected: boolean
  predictedDenomination: string
  rawConfidence: number
  finalConfidence: number
  calibrationStatus: string
  rejectionReason: string | null
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
  'NEGATIVE',
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
    spokenEn: 'This appears to be a 10-rupee note.',
    spokenHi: 'यह 10 रुपये का नोट प्रतीत होता है।',
    spokenPa: 'ਇਹ 10 ਰੁਪਏ ਦਾ ਨੋਟ ਜਾਪਦਾ ਹੈ।',
  },
  INR_20: {
    amount: 20,
    displayName: '₹20',
    color: '#9ACD32',
    colorName: 'Greenish Yellow',
    motif: 'Ellora Caves',
    spokenEn: 'This appears to be a 20-rupee note.',
    spokenHi: 'यह 20 रुपये का नोट प्रतीत होता है।',
    spokenPa: 'ਇਹ 20 ਰੁਪਏ ਦਾ ਨੋਟ ਜਾਪਦਾ ਹੈ।',
  },
  INR_50: {
    amount: 50,
    displayName: '₹50',
    color: '#00BFFF',
    colorName: 'Fluorescent Blue',
    motif: 'Hampi with Chariot',
    spokenEn: 'This appears to be a 50-rupee note.',
    spokenHi: 'यह 50 रुपये का नोट प्रतीत होता है।',
    spokenPa: 'ਇਹ 50 ਰੁਪਏ ਦਾ ਨੋਟ ਜਾਪਦਾ ਹੈ।',
  },
  INR_100: {
    amount: 100,
    displayName: '₹100',
    color: '#9370DB',
    colorName: 'Lavender',
    motif: 'Rani ki Vav',
    spokenEn: 'This appears to be a 100-rupee note.',
    spokenHi: 'यह 100 रुपये का नोट प्रतीत होता है।',
    spokenPa: 'ਇਹ 100 ਰੁਪਏ ਦਾ ਨੋਟ ਜਾਪਦਾ ਹੈ।',
  },
  INR_200: {
    amount: 200,
    displayName: '₹200',
    color: '#FF8C00',
    colorName: 'Bright Yellow-Orange',
    motif: 'Sanchi Stupa',
    spokenEn: 'This appears to be a 200-rupee note.',
    spokenHi: 'यह 200 रुपये का नोट प्रतीत होता है।',
    spokenPa: 'ਇਹ 200 ਰੁਪਏ ਦਾ ਨੋਟ ਜਾਪਦਾ ਹੈ।',
  },
  INR_500: {
    amount: 500,
    displayName: '₹500',
    color: '#708090',
    colorName: 'Stone Grey',
    motif: 'Red Fort, Delhi',
    spokenEn: 'This appears to be a 500-rupee note.',
    spokenHi: 'यह 500 रुपये का नोट प्रतीत होता है।',
    spokenPa: 'ਇਹ 500 ਰੁਪਏ ਦਾ ਨੋਟ ਜਾਪਦਾ ਹੈ।',
  },
  INR_2000: {
    amount: 2000,
    displayName: '₹2000',
    color: '#FF1493',
    colorName: 'Magenta',
    motif: 'Mangalyaan',
    spokenEn: 'This appears to be a 2000-rupee note.',
    spokenHi: 'यह 2000 रुपये का नोट प्रतीत होता है।',
    spokenPa: 'ਇਹ 2000 ਰੁਪਏ ਦਾ ਨੋਟ ਜਾਪਦਾ ਹੈ।',
  },
  NEGATIVE: {
    amount: 0,
    displayName: 'No Banknote',
    color: '#64748b',
    colorName: 'Ordinary Object / Non-Banknote',
    motif: 'None',
    spokenEn: 'No banknote detected.',
    spokenHi: 'कोई बैंक नोट नहीं मिला।',
    spokenPa: 'ਕੋਈ ਬੈਂਕ ਨੋਟ ਨਹੀਂ ਮਿਲਿਆ।',
  },
}

export const CURRENCY_DISCLAIMER =
  'Notice: This feature provides optical banknote denomination assistance. It does not certify legal currency authenticity or detect counterfeit security threads. Please verify physical security features independently for financial transactions.'

// ─── Module State ───

let session: ort.InferenceSession | null = null
let modelStatus: CurrencyModelStatus = 'idle'
let modelLoadPromise: Promise<boolean> | null = null
let executionProvider = 'wasm'
let loadDuration = 0
let lastInferenceTime = 0
let lastPredictedClass = 'None'
let lastRawConfidence = 0
let lastNoteDesign = 'None'
let cameraFrameReceived = false
let noteDetected = false
let lastInferenceError: string | null = null

// Two-Stage & Calibration State
let lastBanknotePresence = false
let lastPresenceConfidence = 0
let lastRecognitionState: BanknoteRecognitionState = 'NO_BANKNOTE_DETECTED'
let lastCalibrationStatus = 'Calibrated (8-Class Negative-Trained Open-Set Rejection)'
let lastRejectionReason: string | null = null

// Voice alert debouncing state
let lastAnnouncedDenomination: string | null = null
let lastAnnouncementTime = 0
const ANNOUNCEMENT_DEBOUNCE_MS = 3500

// ─── Note Design Classifier Helper ───

export function determineNoteDesign(
  cls: CurrencyDenomination,
  chroma: { r: number; g: number; b: number; contrast: number }
): { design: string; motif: string; colorName: string } {
  if (cls === 'NEGATIVE') {
    return {
      design: 'Ordinary Object (Non-Banknote)',
      motif: 'None',
      colorName: 'Non-Banknote Surface',
    }
  }

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

export function loadCurrencyModel(): Promise<boolean> {
  if (session && modelStatus === 'ready') return Promise.resolve(true)
  // Dashboard preloading and a user's first scan can happen together. Share
  // the in-flight load instead of falsely reporting “unavailable” to the scan.
  if (modelLoadPromise) return modelLoadPromise

  modelStatus = 'loading'
  const startTime = performance.now()
  modelLoadPromise = (async () => {
    try {
      const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2
      ort.env.wasm.numThreads = Math.min(4, Math.max(1, Math.floor(cores / 2)))
      ort.env.wasm.simd = true

      const modelUrl = new URL('/models/currency/model.onnx', document.baseURI).toString()
      const headCheck = await fetch(modelUrl, { method: 'HEAD' })
      if (!headCheck.ok) {
        throw new Error(`Currency model request failed (${headCheck.status}): ${modelUrl}`)
      }

      // Prefer WebGPU when available; ONNX Runtime will use WASM as fallback.
      try {
        session = await ort.InferenceSession.create(modelUrl, {
          executionProviders: ['webgpu', 'wasm'],
          graphOptimizationLevel: 'all',
        })
        executionProvider = 'webgpu/wasm'
      } catch {
        session = await ort.InferenceSession.create(modelUrl, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'basic',
        })
        executionProvider = 'wasm'
      }

      loadDuration = Math.round(performance.now() - startTime)
      modelStatus = 'ready'
      lastInferenceError = null
      console.log(`[CurrencyModel] Loaded 8-Class MobileNetV3 in ${loadDuration}ms using: ${executionProvider}`)
      return true
    } catch (err: any) {
      console.error('[CurrencyModel] Initialization failed:', err)
      modelStatus = 'error'
      lastInferenceError = err.message || 'Failed to initialize ONNX Runtime Web'
      return false
    }
  })().finally(() => {
    modelLoadPromise = null
  })

  return modelLoadPromise
}

export function getCurrencyModelInfo(): CurrencyModelInfo {
  return {
    status: modelStatus,
    modelName: 'MobileNetV3-Small (8-Class Negative-Trained Banknote Detector)',
    modelVersion: '3.0.0-negative-calibrated',
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
    modelName: 'MobileNetV3-Small (8-Class Negative-Calibrated)',
    modelVersion: '3.0.0-negative-calibrated',
    modelInputSize: '224x224x3 (Float32)',
    cameraFrameReceived,
    banknotePresence: lastBanknotePresence,
    presenceConfidence: lastPresenceConfidence,
    state: lastRecognitionState,
    noteDetected,
    predictedDenomination: lastPredictedClass,
    rawConfidence: lastRawConfidence,
    finalConfidence: noteDetected ? lastRawConfidence : 0,
    calibrationStatus: lastCalibrationStatus,
    rejectionReason: lastRejectionReason,
    noteDesign: lastNoteDesign,
    speechStatus: VoiceManager.getStatus().isSpeaking ? 'Speaking' : 'Idle',
    lastError: lastInferenceError,
  }
}

// ─── STAGE A: Banknote Presence Detection ───

export function detectBanknotePresence(
  videoOrCanvas: HTMLVideoElement | HTMLCanvasElement,
  region?: ImageRegion
): BanknotePresenceResult {
  const srcWidth = Math.max(1, 'videoWidth' in videoOrCanvas ? videoOrCanvas.videoWidth : videoOrCanvas.width)
  const srcHeight = Math.max(1, 'videoHeight' in videoOrCanvas ? videoOrCanvas.videoHeight : videoOrCanvas.height)

  const canvas = document.createElement('canvas')
  canvas.width = 112
  canvas.height = 112
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    return {
      hasBanknotePresence: false,
      presenceConfidence: 0,
      rejectionReason: 'Canvas context acquisition failed',
      aspectRatioDetected: 1.0,
      isScreenOrDocument: false,
    }
  }

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
    sw = Math.round(srcWidth * 0.75)
    sh = Math.round(srcHeight * 0.75)
    sx = Math.round((srcWidth - sw) / 2)
    sy = Math.round((srcHeight - sh) / 2)
  }

  ctx.drawImage(videoOrCanvas, sx, sy, sw, sh, 0, 0, 112, 112)
  const imgData = ctx.getImageData(0, 0, 112, 112)
  const pixels = imgData.data
  const totalPixels = 112 * 112

  let sumR = 0
  let sumG = 0
  let sumB = 0
  let sumLuma = 0
  let minLuma = 255
  let maxLuma = 0
  let darkPixelCount = 0
  let brightPixelCount = 0
  let horizontalGradientSum = 0
  let verticalGradientSum = 0

  for (let i = 0; i < totalPixels; i++) {
    const r = pixels[i * 4]
    const g = pixels[i * 4 + 1]
    const b = pixels[i * 4 + 2]
    const luma = 0.299 * r + 0.587 * g + 0.114 * b

    sumR += r
    sumG += g
    sumB += b
    sumLuma += luma

    if (luma < minLuma) minLuma = luma
    if (luma > maxLuma) maxLuma = luma
    if (luma < 42) darkPixelCount++
    if (luma > 218) brightPixelCount++

    if (i % 112 < 111) {
      const nextLuma = 0.299 * pixels[(i + 1) * 4] + 0.587 * pixels[(i + 1) * 4 + 1] + 0.114 * pixels[(i + 1) * 4 + 2]
      horizontalGradientSum += Math.abs(nextLuma - luma)
    }
    if (i < totalPixels - 112) {
      const downLuma = 0.299 * pixels[(i + 112) * 4] + 0.587 * pixels[(i + 112) * 4 + 1] + 0.114 * pixels[(i + 112) * 4 + 2]
      verticalGradientSum += Math.abs(downLuma - luma)
    }
  }

  const avgR = sumR / totalPixels
  const avgG = sumG / totalPixels
  const avgB = sumB / totalPixels
  const avgLuma = sumLuma / totalPixels
  const contrast = maxLuma - minLuma
  const darkRatio = darkPixelCount / totalPixels
  const brightRatio = brightPixelCount / totalPixels
  const hGrad = horizontalGradientSum / totalPixels
  const vGrad = verticalGradientSum / totalPixels

  // 1. REJECT MONOCHROMATIC DARK SCREENS (VSCode / IDE / Terminal / Dark monitor)
  if (darkRatio > 0.45 || (avgLuma < 52 && contrast < 95) || (avgLuma < 42 && avgR < 48 && avgG < 48 && avgB < 52)) {
    return {
      hasBanknotePresence: false,
      presenceConfidence: 0.04,
      rejectionReason: 'Monochromatic dark display screen (IDE / code editor / dark monitor)',
      aspectRatioDetected: sw / sh,
      isScreenOrDocument: true,
    }
  }

  // 2. REJECT UNIFORM WHITE SHEETS / PLAIN PAPER / BLANK DOCUMENTS / RECEIPTS
  const maxChannelDiff = Math.max(Math.abs(avgR - avgG), Math.abs(avgG - avgB), Math.abs(avgR - avgB))
  if (brightRatio > 0.58 || (avgLuma > 212 && maxChannelDiff < 22)) {
    return {
      hasBanknotePresence: false,
      presenceConfidence: 0.08,
      rejectionReason: 'Uniform light surface / plain white paper / document page',
      aspectRatioDetected: sw / sh,
      isScreenOrDocument: true,
    }
  }

  // 3. REJECT SOLID FEATURELESS WALLS OR DESK TOPS
  if (contrast < 28 && hGrad < 1.1 && vGrad < 1.1) {
    return {
      hasBanknotePresence: false,
      presenceConfidence: 0.06,
      rejectionReason: 'Featureless solid surface (wall / desk / floor)',
      aspectRatioDetected: sw / sh,
      isScreenOrDocument: false,
    }
  }

  // 4. CHROMATIC SPECTRUM CALIBRATION
  let presenceScore = 0.65
  // ₹10: Chocolate Brown
  if (avgR > 95 && avgG > 55 && avgB < 95 && avgR > avgG && avgG > avgB) presenceScore = 0.88
  // ₹20: Greenish Yellow
  else if (avgG > 115 && avgR > 95 && avgB < 110 && avgG >= avgR * 0.9) presenceScore = 0.88
  // ₹50: Fluorescent Blue
  else if (avgB > 105 && avgB > avgR + 12) presenceScore = 0.88
  // ₹100: Lavender
  else if ((avgB > 95 && avgB > avgG + 6 && avgR > 85) || (avgR > 125 && avgG > 125 && avgB > 135)) presenceScore = 0.85
  // ₹200: Bright Yellow
  else if (avgR > 130 && avgG > 110 && avgB < 110 && avgR + avgG > avgB * 2.0) presenceScore = 0.90
  // ₹500: Stone Grey / Green
  else if (avgG >= avgR - 10 && avgG >= avgB - 10 && maxChannelDiff < 35 && avgLuma > 85 && avgLuma < 200) presenceScore = 0.88
  // ₹2000: Magenta
  else if (avgR > 125 && avgB > 90 && avgG < 105 && (avgR - avgG) > 22) presenceScore = 0.90

  return {
    hasBanknotePresence: true,
    presenceConfidence: presenceScore,
    aspectRatioDetected: sw / sh,
    isScreenOrDocument: false,
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
    // Use the same 2.25:1 horizontal window as the banknote guide and training
    // preprocessing. The former near-square mobile crop clipped the long ends
    // of a note and stretched mostly background into the classifier input.
    sw = Math.round(srcWidth * 0.88)
    sh = Math.min(Math.round(sw / 2.25), Math.round(srcHeight * 0.88))
    sx = Math.round((srcWidth - sw) / 2)
    sy = Math.round((srcHeight - sh) / 2)
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

// ─── Single Note Recognition (MODE A: Two-Stage Verification) ───

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
      : 'I cannot recognise this note clearly. Please scan again.'

  const noBanknoteSpeech =
    lang === 'hi'
      ? 'कोई बैंक नोट नहीं मिला।'
      : lang === 'pa'
      ? 'ਕੋਈ ਬੈਂਕ ਨੋਟ ਨਹੀਂ ਮਿਲਿਆ।'
      : 'No banknote detected.'

  // ═══════════════════════════════════════════════════════════════════
  // STAGE A: BANKNOTE PRESENCE DETECTION
  // ═══════════════════════════════════════════════════════════════════
  const presence = detectBanknotePresence(videoOrCanvas)
  lastBanknotePresence = presence.hasBanknotePresence
  lastPresenceConfidence = Math.round(presence.presenceConfidence * 100)

  // The color/contrast gate is only a rough hint: a small note on a bright or
  // dark background can fail it. Always let the negative-trained classifier
  // confirm the frame instead of rejecting the banknote before inference.

  // ═══════════════════════════════════════════════════════════════════
  // STAGE B: DENOMINATION CLASSIFICATION (8-Class Neural Inference)
  // ═══════════════════════════════════════════════════════════════════

  if (!session || modelStatus !== 'ready') {
    const loaded = await loadCurrencyModel()
    if (!loaded || !session) {
      const modelUnavailableSpeech = lang === 'hi'
        ? 'करेंसी मॉडल लोड नहीं हुआ। कृपया इंटरनेट कनेक्शन जांचकर फिर से कोशिश करें।'
        : lang === 'pa'
          ? 'ਕਰੰਸੀ ਮਾਡਲ ਲੋਡ ਨਹੀਂ ਹੋਇਆ। ਕਿਰਪਾ ਕਰਕੇ ਇੰਟਰਨੈੱਟ ਕਨੈਕਸ਼ਨ ਜਾਂਚ ਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।'
          : 'The currency model could not load. Check the connection and try again.'
      noteDetected = false
      lastBanknotePresence = presence.hasBanknotePresence
      lastPresenceConfidence = Math.round(presence.presenceConfidence * 100)
      lastRecognitionState = 'LOW_CONFIDENCE'
      lastPredictedClass = 'Unavailable'
      lastRawConfidence = 0
      lastNoteDesign = 'Unavailable'
      lastRejectionReason = lastInferenceError || 'Currency model unavailable'
      if (shouldSpeak && options?.forceAnnouncement) {
        VoiceManager.announce(modelUnavailableSpeech, 'MEDIUM', { force: true, lang })
      }
      return {
        state: 'LOW_CONFIDENCE',
        banknotePresence: true,
        presenceConfidence: presence.presenceConfidence,
        denomination: 'NEGATIVE',
        note_design: 'Unavailable',
        recognition_confidence: 0,
        amount: 0,
        displayName: 'Currency model unavailable',
        confidence: 0,
        rawConfidence: 0,
        colorName: 'None',
        noteTheme: 'None',
        isConfident: false,
        rejectionReason: lastInferenceError || 'Currency model unavailable',
        spokenFeedback: modelUnavailableSpeech,
        timestamp: Date.now(),
        inferenceMs: 0,
      }
    }
  }

  const startInfer = performance.now()
  const { tensor, chromaticProfile, blurScore } = extractTensorFromRegion(videoOrCanvas)

  try {
    const inputName = session.inputNames[0] || 'input'
    const feeds: Record<string, ort.Tensor> = { [inputName]: tensor }
    const results = await session.run(feeds)
    const outputTensor = results[session.outputNames[0]] || results.output || Object.values(results)[0]
    if (!outputTensor || outputTensor.data.length < CURRENCY_CLASSES.length) {
      throw new Error(`Currency model returned ${outputTensor?.data.length ?? 0} scores; expected ${CURRENCY_CLASSES.length}.`)
    }
    const rawLogits = outputTensor.data as Float32Array

    tensor.dispose()

    const probs = softmax(rawLogits)
    const inferDuration = Math.round(performance.now() - startInfer)
    lastInferenceTime = inferDuration

    // Rank predictions by neural network confidence across 8 classes
    const ranked = CURRENCY_CLASSES.map((cls, idx) => ({
      cls,
      prob: probs[idx] || 0,
    })).sort((a, b) => b.prob - a.prob)

    let topMatch = ranked[0]
    const secondMatch = ranked[1]
    const scoreMargin = topMatch.prob - (secondMatch ? secondMatch.prob : 0)

    lastPredictedClass = topMatch.cls
    lastRawConfidence = Math.round(topMatch.prob * 100)

    // CHECK IF CLASSIFIED AS HARD NEGATIVE
    if (topMatch.cls === 'NEGATIVE') {
      lastRecognitionState = 'NO_BANKNOTE_DETECTED'
      lastRejectionReason = 'Neural model classified region as ordinary non-banknote object'
      noteDetected = false
      lastBanknotePresence = false
      lastPresenceConfidence = Math.round((1 - topMatch.prob) * 100)

      if (shouldSpeak && options?.forceAnnouncement) {
        VoiceManager.announce(noBanknoteSpeech, 'MEDIUM', { force: true, lang })
      }

      return {
        state: 'NO_BANKNOTE_DETECTED',
        banknotePresence: false,
        presenceConfidence: 0.1,
        denomination: 'NEGATIVE',
        note_design: 'Ordinary Object (Non-Banknote)',
        recognition_confidence: 0,
        amount: 0,
        displayName: 'No Banknote Detected',
        confidence: Math.round(topMatch.prob * 100),
        rawConfidence: Math.round(topMatch.prob * 100),
        colorName: 'None',
        noteTheme: 'None',
        isConfident: false,
        uncertainReason: 'ordinary_object',
        rejectionReason: lastRejectionReason,
        spokenFeedback: noBanknoteSpeech,
        timestamp: Date.now(),
        inferenceMs: inferDuration,
      }
    }

    const meta = CLASS_METADATA[topMatch.cls]
    const noteDesignInfo = determineNoteDesign(topMatch.cls, chromaticProfile)
    lastNoteDesign = noteDesignInfo.design

    // Calibrated Rejection and Uncertainty Check
    let isConfident = true
    let state: BanknoteRecognitionState = 'DENOMINATION_RECOGNISED'
    let uncertainReason: CurrencyRecognitionResult['uncertainReason'] = undefined
    let spokenText = ''

    if (chromaticProfile.contrast < 30) {
      isConfident = false
      state = 'LOW_CONFIDENCE'
      uncertainReason = 'low_contrast'
      spokenText =
        lang === 'hi'
          ? 'रोशनी बहुत कम है। कृपया नोट को स्पष्ट रूप से दिखाएं।'
          : lang === 'pa'
          ? 'ਰੋਸ਼ਨੀ ਬਹੁਤ ਘੱਟ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਨੋਟ ਨੂੰ ਸਪਸ਼ਟ ਦਿਖਾਓ।'
          : 'Lighting is low. Please hold the note clearly in front of the camera.'
    } else if (blurScore < 2.0 && chromaticProfile.contrast < 45) {
      isConfident = false
      state = 'LOW_CONFIDENCE'
      uncertainReason = 'blur_detected'
      spokenText = failSpeech
    } else if (topMatch.prob < 0.70) {
      // CALIBRATED REJECTION THRESHOLD: Require >= 0.70 (70%)
      isConfident = false
      state = 'LOW_CONFIDENCE'
      uncertainReason = 'low_confidence'
      spokenText =
        lang === 'hi'
          ? 'कृपया नोट को कैमरे के सामने स्पष्ट रूप से पकड़ें।'
          : lang === 'pa'
          ? 'ਕਿਰਪਾ ਕਰਕੇ ਨੋਟ ਨੂੰ ਕੈਮਰੇ ਸਾਹਮਣੇ ਸਪਸ਼ਟ ਤੌਰ ਤੇ ਫੜੋ।'
          : 'Please hold the note clearly in front of the camera.'
    } else if (scoreMargin < 0.15) {
      isConfident = false
      state = 'LOW_CONFIDENCE'
      uncertainReason = 'confused_denominations'
      spokenText =
        lang === 'hi'
          ? 'कृपया एक बार में एक ही नोट स्कैन करें।'
          : lang === 'pa'
          ? 'ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ ਸਮੇਂ ਵਿੱਚ ਇੱਕ ਹੀ ਨੋਟ ਸਕੈਨ ਕਰੋ।'
          : 'Please scan one note at a time.'
    } else {
      // Verified High-Confidence Indian Banknote Recognition
      state = 'DENOMINATION_RECOGNISED'
      spokenText = lang === 'hi' ? meta.spokenHi : lang === 'pa' ? meta.spokenPa : meta.spokenEn
    }

    lastRecognitionState = state
    noteDetected = isConfident
    lastBanknotePresence = true
    lastPresenceConfidence = Math.max(lastPresenceConfidence, Math.round(topMatch.prob * 100))
    lastRejectionReason = isConfident ? null : uncertainReason || 'Low confidence prediction'

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
      state,
      banknotePresence: true,
      presenceConfidence: presence.presenceConfidence,
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
      rejectionReason: lastRejectionReason || undefined,
      spokenFeedback: spokenText,
      timestamp: now,
      inferenceMs: inferDuration,
    }
  } catch (err: any) {
    tensor.dispose()
    lastInferenceError = err.message || 'Error executing ONNX inference'
    console.error('[CurrencyModel] Inference error:', err)
    noteDetected = false
    lastBanknotePresence = presence.hasBanknotePresence
    lastPresenceConfidence = Math.round(presence.presenceConfidence * 100)
    lastRecognitionState = 'LOW_CONFIDENCE'
    lastPredictedClass = 'Error'
    lastRawConfidence = 0
    lastNoteDesign = 'Unavailable'
    lastRejectionReason = lastInferenceError
    if (shouldSpeak && options?.forceAnnouncement) {
      VoiceManager.announce(failSpeech, 'MEDIUM', { force: true, lang })
    }
    return {
      state: 'LOW_CONFIDENCE',
      banknotePresence: false,
      presenceConfidence: 0,
      denomination: 'NEGATIVE',
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
      rejectionReason: lastInferenceError || undefined,
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
      const inputName = session!.inputNames[0] || 'input'
      const results = await session!.run({ [inputName]: tensor })
      const outputTensor = results[session!.outputNames[0]] || results.output || Object.values(results)[0]
      if (!outputTensor || outputTensor.data.length < CURRENCY_CLASSES.length) {
        throw new Error(`Currency model returned ${outputTensor?.data.length ?? 0} scores; expected ${CURRENCY_CLASSES.length}.`)
      }
      const probs = softmax(outputTensor.data as Float32Array)
      tensor.dispose()

      let maxIdx = 0
      for (let i = 1; i < probs.length; i++) {
        if (probs[i] > probs[maxIdx]) maxIdx = i
      }

      const topCls = CURRENCY_CLASSES[maxIdx]
      const topProb = probs[maxIdx]

      if (topCls === 'NEGATIVE') continue
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
