// ─── Indian Currency Recognition Service ───
// Status: MODEL TRAINING PENDING
// The model needs to be trained on the Indian Currency Dataset using the
// training pipeline in ml/currency_recognition/

// ─── Types ───

export type CurrencyModelStatus = 'not_trained' | 'loading' | 'ready' | 'error'

export interface CurrencyDetection {
  denomination: string
  confidence: number
  side: 'front' | 'back' | 'unknown'
  bbox: [number, number, number, number]
}

export interface CurrencyModelInfo {
  status: CurrencyModelStatus
  modelName: string
  trainingStatus: string
  supportedDenominations: string[]
  disclaimer: string
}

// ─── Constants ───

export const CURRENCY_DISCLAIMER =
  'Currency identification is approximate. This system identifies apparent denomination only. ' +
  'It cannot verify authenticity or detect counterfeit notes. Do not use for financial verification.'

export const SUPPORTED_DENOMINATIONS = ['₹10', '₹20', '₹50', '₹100', '₹200', '₹500', '₹2000']

export const DENOMINATION_COLORS: Record<string, string> = {
  '₹10': '#8B4513',
  '₹20': '#9ACD32',
  '₹50': '#00BFFF',
  '₹100': '#E6E6FA',
  '₹200': '#FFD700',
  '₹500': '#808080',
  '₹2000': '#FF00FF',
}

// ─── State ───

let modelStatus: CurrencyModelStatus = 'not_trained'

// ─── Public API ───

export function getCurrencyModelInfo(): CurrencyModelInfo {
  return {
    status: modelStatus,
    modelName: 'MobileNetV3-Small (Indian Currency)',
    trainingStatus: 'PENDING — Train using ml/currency_recognition/train_currency_model.py',
    supportedDenominations: [...SUPPORTED_DENOMINATIONS],
    disclaimer: CURRENCY_DISCLAIMER,
  }
}

export function getCurrencyModelStatus(): CurrencyModelStatus {
  return modelStatus
}

export async function loadCurrencyModel(): Promise<void> {
  modelStatus = 'loading'
  try {
    const response = await fetch('/models/currency/model.onnx', { method: 'HEAD' })
    if (!response.ok) {
      console.warn('[CurrencyDetection] Model not found at /models/currency/model.onnx')
      console.warn('[CurrencyDetection] Train with: ml/currency_recognition/train_currency_model.py')
      modelStatus = 'not_trained'
      return
    }
    // Model file exists — would load with ONNX Runtime Web here
    console.log('[CurrencyDetection] Model file found, ONNX runtime load pending')
    modelStatus = 'not_trained'
  } catch {
    modelStatus = 'not_trained'
  }
}

export async function detectCurrency(
  _imageData: ImageData
): Promise<CurrencyDetection[]> {
  if (modelStatus !== 'ready') {
    return [] // No fake results
  }
  return []
}

export function captureFrameFromVideo(video: HTMLVideoElement): ImageData | null {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(video, 0, 0)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}
