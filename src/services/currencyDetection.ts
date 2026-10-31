import * as ort from 'onnxruntime-web'
import { speak } from './speechService'

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
  amount: number
  displayName: string
  confidence: number
  colorName: string
  noteTheme: string
  isConfident: boolean
  spokenFeedback: string
  timestamp: number
  inferenceMs: number
}

export type CurrencyModelStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface CurrencyModelInfo {
  status: CurrencyModelStatus
  modelName: string
  executionProvider: string
  inputShape: string
  supportedClasses: string[]
  disclaimer: string
  loadTimeMs: number
  lastInferenceMs: number
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
    spokenEn: 'Possible 10-rupee note detected.',
    spokenHi: 'संभावित १० रुपये का नोट पहचाना गया।',
    spokenPa: '੧੦ ਰੁਪਏ ਦਾ ਨੋਟ ਪਛਾਣਿਆ ਗਿਆ।',
  },
  INR_20: {
    amount: 20,
    displayName: '₹20',
    color: '#9ACD32',
    colorName: 'Greenish Yellow',
    motif: 'Ellora Caves',
    spokenEn: 'Possible 20-rupee note detected.',
    spokenHi: 'संभावित २० रुपये का नोट पहचाना गया।',
    spokenPa: '੨੦ ਰੁਪਏ ਦਾ ਨੋਟ ਪਛਾਣਿਆ ਗਿਆ।',
  },
  INR_50: {
    amount: 50,
    displayName: '₹50',
    color: '#00BFFF',
    colorName: 'Fluorescent Blue',
    motif: 'Hampi with Chariot',
    spokenEn: 'Possible 50-rupee note detected.',
    spokenHi: 'संभावित ५० रुपये का नोट पहचाना गया।',
    spokenPa: '੫੦ ਰੁਪਏ ਦਾ ਨੋਟ ਪਛਾਣਿਆ ਗਿਆ।',
  },
  INR_100: {
    amount: 100,
    displayName: '₹100',
    color: '#9370DB',
    colorName: 'Lavender',
    motif: 'Rani ki Vav',
    spokenEn: 'Possible 100-rupee note detected.',
    spokenHi: 'संभावित १०० रुपये का नोट पहचाना गया।',
    spokenPa: '੧੦੦ ਰੁਪਏ ਦਾ ਨੋਟ ਪਛਾਣਿਆ ਗਿਆ।',
  },
  INR_200: {
    amount: 200,
    displayName: '₹200',
    color: '#FF8C00',
    colorName: 'Bright Yellow-Orange',
    motif: 'Sanchi Stupa',
    spokenEn: 'Possible 200-rupee note detected.',
    spokenHi: 'संभावित २०० रुपये का नोट पहचाना गया।',
    spokenPa: '੨੦੦ ਰੁਪਏ ਦਾ ਨੋਟ ਪਛਾਣਿਆ ਗਿਆ।',
  },
  INR_500: {
    amount: 500,
    displayName: '₹500',
    color: '#708090',
    colorName: 'Stone Grey',
    motif: 'Red Fort, Delhi',
    spokenEn: 'Possible 500-rupee note detected.',
    spokenHi: 'संभावित ५०० रुपये का नोट पहचाना गया।',
    spokenPa: '੫੦੦ ਰੁਪਏ ਦਾ ਨੋਟ ਪਛਾਣਿਆ ਗਿਆ।',
  },
  INR_2000: {
    amount: 2000,
    displayName: '₹2000',
    color: '#FF1493',
    colorName: 'Magenta',
    motif: 'Mangalyaan',
    spokenEn: 'Possible 2000-rupee note detected.',
    spokenHi: 'संभावित २००० रुपये का नोट पहचाना गया।',
    spokenPa: '੨੦੦੦ ਰੁਪਏ ਦਾ ਨੋਟ ਪਛਾਣਿਆ ਗਿਆ।',
  },
}

export const CURRENCY_DISCLAIMER =
  'Notice: This feature estimates apparent denomination only. It does not certify banknote authenticity or guarantee counterfeit detection. Please verify independently before monetary transactions.'

// ─── Module State ───

let session: ort.InferenceSession | null = null
let modelStatus: CurrencyModelStatus = 'idle'
let executionProvider = 'wasm'
let loadDuration = 0
let lastInferenceTime = 0

// ─── Model Lifecycle ───

export async function loadCurrencyModel(): Promise<boolean> {
  if (session && modelStatus === 'ready') return true
  if (modelStatus === 'loading') return false

  modelStatus = 'loading'
  const startTime = performance.now()

  try {
    // Configure ONNX Runtime Web for browser environments
    ort.env.wasm.numThreads = 2
    ort.env.wasm.simd = true

    // Check if model file is accessible
    const headCheck = await fetch('/models/currency/model.onnx', { method: 'HEAD' })
    if (!headCheck.ok) {
      console.warn('[CurrencyModel] /models/currency/model.onnx not found.')
      modelStatus = 'error'
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
    console.log(`[CurrencyModel] Loaded in ${loadDuration}ms using provider: ${executionProvider}`)
    return true
  } catch (err: any) {
    console.error('[CurrencyModel] Initialization failed:', err)
    modelStatus = 'error'
    return false
  }
}

export function getCurrencyModelInfo(): CurrencyModelInfo {
  return {
    status: modelStatus,
    modelName: 'MobileNetV3-Small (7 Indian Rupee Classes)',
    executionProvider,
    inputShape: '[1, 3, 224, 224]',
    supportedClasses: CURRENCY_CLASSES.map((c) => CLASS_METADATA[c].displayName),
    disclaimer: CURRENCY_DISCLAIMER,
    loadTimeMs: loadDuration,
    lastInferenceMs: lastInferenceTime,
  }
}

export function getCurrencyModelStatus(): CurrencyModelStatus {
  return modelStatus
}

// ─── Image Preprocessing Pipeline ───

/**
 * Preprocesses video/canvas frame:
 * 1. Crops region of interest (central 65% of viewport matching banknote guide)
 * 2. Scales to 224 × 224
 * 3. Normalizes using ImageNet mean [0.485, 0.456, 0.406] and std [0.229, 0.224, 0.225]
 * 4. Yields NCHW Float32Array [1, 3, 224, 224]
 */
function prepareImageTensor(
  videoOrCanvas: HTMLVideoElement | HTMLCanvasElement
): { tensor: ort.Tensor; chromaticProfile: { r: number; g: number; b: number; contrast: number } } {
  const canvas = document.createElement('canvas')
  canvas.width = 224
  canvas.height = 224
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  const srcWidth = 'videoWidth' in videoOrCanvas ? videoOrCanvas.videoWidth : videoOrCanvas.width
  const srcHeight = 'videoHeight' in videoOrCanvas ? videoOrCanvas.videoHeight : videoOrCanvas.height

  // Crop guide region (central 65% width, central 50% height)
  const cropW = Math.round(srcWidth * 0.65)
  const cropH = Math.round(srcHeight * 0.50)
  const cropX = Math.round((srcWidth - cropW) / 2)
  const cropY = Math.round((srcHeight - cropH) / 2)

  ctx.drawImage(videoOrCanvas, cropX, cropY, cropW, cropH, 0, 0, 224, 224)

  const imgData = ctx.getImageData(0, 0, 224, 224)
  const pixels = imgData.data

  const float32Data = new Float32Array(1 * 3 * 224 * 224)
  const mean = [0.485, 0.456, 0.406]
  const std = [0.229, 0.224, 0.225]

  let sumR = 0
  let sumG = 0
  let sumB = 0
  let minBrightness = 255
  let maxBrightness = 0

  const totalPixels = 224 * 224

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

    // NCHW layout: [batch, channel, height, width]
    float32Data[i] = (r / 255.0 - mean[0]) / std[0] // R
    float32Data[totalPixels + i] = (g / 255.0 - mean[1]) / std[1] // G
    float32Data[totalPixels * 2 + i] = (b / 255.0 - mean[2]) / std[2] // B
  }

  const avgR = sumR / totalPixels
  const avgG = sumG / totalPixels
  const avgB = sumB / totalPixels
  const contrast = maxBrightness - minBrightness

  const tensor = new ort.Tensor('float32', float32Data, [1, 3, 224, 224])
  return {
    tensor,
    chromaticProfile: { r: avgR, g: avgG, b: avgB, contrast },
  }
}

// ─── Softmax Function ───

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

// ─── Chromatic Heuristic Validation (Multi-cue Check) ───

function getChromaticClassBonus(
  profile: { r: number; g: number; b: number; contrast: number },
  cls: CurrencyDenomination
): number {
  const { r, g, b, contrast } = profile
  // If contrast is very low (e.g. black frame or blank wall), penalize
  if (contrast < 40) return 0

  switch (cls) {
    case 'INR_10': // Chocolate Brown (warm dark, high red relative to blue)
      return r > g && g > b && r < 160 ? 0.15 : 0
    case 'INR_20': // Greenish Yellow (high G, balanced R, low B)
      return g > b && r > b && g > 110 ? 0.15 : 0
    case 'INR_50': // Fluorescent Blue (high B and cyan, B > R)
      return b > r && g > r ? 0.20 : 0
    case 'INR_100': // Lavender (purple/violet, balanced B and R, lower G)
      return b > g && r > g ? 0.18 : 0
    case 'INR_200': // Bright Yellow / Orange (very high R and G, low B)
      return r > 140 && g > 110 && b < 100 ? 0.20 : 0
    case 'INR_500': // Stone Grey (desaturated, R approx equal to G and B)
      return Math.abs(r - g) < 25 && Math.abs(g - b) < 25 ? 0.18 : 0
    case 'INR_2000': // Magenta (very high R and B, low G)
      return r > g && b > g && r > 130 ? 0.22 : 0
  }
}

// ─── Main Recognition Function ───

export async function recognizeBanknote(
  videoOrCanvas: HTMLVideoElement | HTMLCanvasElement,
  options?: { language?: 'en' | 'hi' | 'pa'; autoSpeak?: boolean }
): Promise<CurrencyRecognitionResult> {
  const lang = options?.language || 'en'
  const shouldSpeak = options?.autoSpeak !== false

  // Ensure model is loaded
  if (!session || modelStatus !== 'ready') {
    const loaded = await loadCurrencyModel()
    if (!loaded || !session) {
      const failResult: CurrencyRecognitionResult = {
        denomination: 'INR_10',
        amount: 0,
        displayName: 'Unknown',
        confidence: 0,
        colorName: 'None',
        noteTheme: 'None',
        isConfident: false,
        spokenFeedback:
          lang === 'hi'
            ? 'क्षमा करें, करेंसी मॉडल लोड नहीं हो सका।'
            : 'Sorry, the currency recognition model could not be loaded.',
        timestamp: Date.now(),
        inferenceMs: 0,
      }
      if (shouldSpeak) speak(failResult.spokenFeedback, lang === 'hi' ? 'hi-IN' : 'en-US')
      return failResult
    }
  }

  const startInfer = performance.now()
  const { tensor, chromaticProfile } = prepareImageTensor(videoOrCanvas)

  try {
    const feeds: Record<string, ort.Tensor> = { input: tensor }
    const results = await session.run(feeds)
    const outputTensor = results.output || Object.values(results)[0]
    const rawLogits = outputTensor.data as Float32Array

    tensor.dispose()

    const probs = softmax(rawLogits)
    const inferDuration = Math.round(performance.now() - startInfer)
    lastInferenceTime = inferDuration

    // Combine neural network probabilities with chromatic cues
    const combinedScores = CURRENCY_CLASSES.map((cls, idx) => {
      const nnProb = probs[idx] || 0
      const colorBonus = getChromaticClassBonus(chromaticProfile, cls)
      return {
        cls,
        score: Math.min(1.0, nnProb * 0.75 + colorBonus * 0.25),
      }
    })

    combinedScores.sort((a, b) => b.score - a.score)
    const topMatch = combinedScores[0]
    const meta = CLASS_METADATA[topMatch.cls]

    // Quality check: Check if frame is too dim or has no contrast
    const isImageQualityGood = chromaticProfile.contrast >= 45
    const isConfident = isImageQualityGood && topMatch.score >= 0.48

    let spokenText = ''
    if (isConfident) {
      spokenText =
        lang === 'hi'
          ? meta.spokenHi
          : lang === 'pa'
          ? meta.spokenPa
          : meta.spokenEn
    } else {
      spokenText =
        lang === 'hi'
          ? 'क्षमा करें, यह नोट स्पष्ट नहीं दिख रहा है। कृपया नोट को फ्रेम के बीच में सीधा रखें।'
          : 'Sorry, I cannot recognise this note clearly. Please hold one note flat in the camera frame.'
    }

    if (shouldSpeak) {
      speak(spokenText, lang === 'hi' ? 'hi-IN' : 'en-US')
    }

    return {
      denomination: topMatch.cls,
      amount: meta.amount,
      displayName: meta.displayName,
      confidence: Math.round(topMatch.score * 100),
      colorName: meta.colorName,
      noteTheme: meta.motif,
      isConfident,
      spokenFeedback: spokenText,
      timestamp: Date.now(),
      inferenceMs: inferDuration,
    }
  } catch (err: any) {
    tensor.dispose()
    console.error('[CurrencyModel] Inference error:', err)
    const errResult: CurrencyRecognitionResult = {
      denomination: 'INR_10',
      amount: 0,
      displayName: 'Error',
      confidence: 0,
      colorName: 'None',
      noteTheme: 'None',
      isConfident: false,
      spokenFeedback: 'Error during note inference. Please try again.',
      timestamp: Date.now(),
      inferenceMs: 0,
    }
    return errResult
  }
}
