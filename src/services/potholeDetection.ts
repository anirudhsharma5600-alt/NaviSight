/**
 * NaviAble AI — Road Hazard & Pothole Detection Module
 *
 * Target Road Hazard Categories:
 * - Potholes (RDD2022 D40)
 * - Longitudinal Cracks (RDD2022 D00)
 * - Transverse Cracks (RDD2022 D10)
 * - Alligator Cracks (RDD2022 D20)
 * - Broken road surfaces & Broken pavements
 * - Open drains
 * - Construction barriers & Roadblocks
 * - Fallen objects & Road debris
 * - Uneven walking surfaces
 * - Waterlogged sections
 *
 * Status: Dedicated deep learning model requires training with RDD2022 dataset
 * via ml/pothole_detection/train_pothole_model.py.
 * Honest status reporting: In accordance with safety policies, this module
 * reports 'not_trained' when no certified ONNX weights are present.
 * NEVER fabricates fake neural hazard predictions.
 */

import { VoiceManager } from './VoiceAnnouncementManager'

export type PotholeModelStatus = 'not_trained' | 'loading' | 'ready' | 'error'

export interface RoadHazard {
  type:
    | 'pothole'
    | 'crack'
    | 'broken_pavement'
    | 'open_drain'
    | 'construction_barrier'
    | 'roadblock'
    | 'fallen_object'
    | 'waterlogged'
    | 'uneven_surface'
  severity: 'low' | 'medium' | 'high'
  confidence: number
  bbox: [number, number, number, number] // [x, y, w, h]
  position: 'LEFT' | 'CENTRE' | 'RIGHT'
  label: string
}

export interface PotholeModelInfo {
  status: PotholeModelStatus
  modelName: string
  trainingStatus: string
  supportedHazards: string[]
  disclaimer: string
  datasetReference: string
  recommendedArchitecture: string
}

export const POTHOLE_DISCLAIMER =
  'Road hazard detection is assistive and experimental. Never assume a road is safe or clear just because no hazard was detected. Never make road-crossing decisions based on AI. This technology does NOT replace a white cane, guide dog, or orientation and mobility training.'

export const SUPPORTED_HAZARDS = [
  'Pothole / Depression (D40)',
  'Longitudinal Crack (D00)',
  'Transverse Crack (D10)',
  'Alligator Crack (D20)',
  'Broken Pavement / Kerb Damage',
  'Open Drain / Missing Manhole Cover',
  'Construction Barrier / Cones',
  'Roadblock / Fallen Object',
  'Uneven Walking Surface',
  'Waterlogged Section',
]

let modelStatus: PotholeModelStatus = 'not_trained'
let lastHazardAnnouncedTime = 0
const HAZARD_ANNOUNCE_COOLDOWN_MS = 6000

export function getPotholeModelInfo(): PotholeModelInfo {
  return {
    status: modelStatus,
    modelName: 'YOLOv8n-RDD2022 (Road Damage & Hazard Intelligence)',
    trainingStatus:
      modelStatus === 'ready'
        ? 'Trained & Operational'
        : 'PENDING — Requires training with RDD2022 dataset using ml/pothole_detection/train_pothole_model.py',
    supportedHazards: [...SUPPORTED_HAZARDS],
    disclaimer: POTHOLE_DISCLAIMER,
    datasetReference: 'Road Damage Dataset 2022 (GRDDC 2022, 40,000+ labeled images)',
    recommendedArchitecture: 'YOLOv8n / MobileNetV3-SSD ONNX (Opset 14, WebGPU/WASM)',
  }
}

export function getPotholeModelStatus(): PotholeModelStatus {
  return modelStatus
}

export async function loadPotholeModel(): Promise<void> {
  modelStatus = 'loading'
  try {
    const response = await fetch('/models/pothole/model.onnx', { method: 'HEAD' })
    if (!response.ok) {
      console.warn('[PotholeDetection] Dedicated road damage model not found at /models/pothole/model.onnx.')
      console.warn('[PotholeDetection] Run ml/pothole_detection/train_pothole_model.py on Google Colab/GPU to train.')
      modelStatus = 'not_trained'
      return
    }
    modelStatus = 'not_trained' // Will switch to ready when valid session creates
  } catch {
    modelStatus = 'not_trained'
  }
}

/**
 * Heuristic surface texture and road anomaly analyzer.
 * Evaluates the lower third (pavement/ground plane) of the camera frame
 * for sudden high-contrast gradient irregularities or dark depressions.
 */
export function analyzeRoadSurfaceHeuristic(
  video: HTMLVideoElement,
  options?: { autoAnnounce?: boolean; language?: 'en' | 'hi' | 'pa' }
): {
  hasSurfaceAnomaly: boolean
  anomalyType: string | null
  confidence: number
  pavementPosition: 'LEFT' | 'CENTRE' | 'RIGHT'
  spokenAlert: string | null
} {
  const lang = options?.language || 'en'
  const shouldSpeak = options?.autoAnnounce ?? true

  if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
    return {
      hasSurfaceAnomaly: false,
      anomalyType: null,
      confidence: 0,
      pavementPosition: 'CENTRE',
      spokenAlert: null,
    }
  }

  const vw = video.videoWidth
  const vh = video.videoHeight

  // Create lightweight inspection canvas for the ground plane (bottom 35% of frame)
  const canvas = document.createElement('canvas')
  canvas.width = 160
  canvas.height = 90
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return {
      hasSurfaceAnomaly: false,
      anomalyType: null,
      confidence: 0,
      pavementPosition: 'CENTRE',
      spokenAlert: null,
    }
  }

  // Draw bottom 40% of the video (road surface region)
  const sy = Math.round(vh * 0.60)
  const sh = Math.round(vh * 0.40)
  ctx.drawImage(video, 0, sy, vw, sh, 0, 0, 160, 90)

  const imgData = ctx.getImageData(0, 0, 160, 90)
  const d = imgData.data

  let darkPixelCount = 0
  let highGradientCount = 0
  const totalPixels = 160 * 90

  let leftEnergy = 0
  let centreEnergy = 0
  let rightEnergy = 0

  for (let y = 1; y < 89; y++) {
    for (let x = 1; x < 159; x++) {
      const idx = (y * 160 + x) * 4
      const luma = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2]

      if (luma < 38) {
        darkPixelCount++
      }

      // Horizontal edge gradient
      const rightLuma = 0.299 * d[idx + 4] + 0.587 * d[idx + 5] + 0.114 * d[idx + 6]
      const grad = Math.abs(rightLuma - luma)
      if (grad > 55) {
        highGradientCount++
        if (x < 53) leftEnergy += grad
        else if (x > 106) rightEnergy += grad
        else centreEnergy += grad
      }
    }
  }

  const darkRatio = darkPixelCount / totalPixels
  const gradientRatio = highGradientCount / totalPixels

  // Pavement anomaly detection
  let hasSurfaceAnomaly = false
  let anomalyType: string | null = null
  let confidence = 0
  let pavementPosition: 'LEFT' | 'CENTRE' | 'RIGHT' = 'CENTRE'

  if (leftEnergy > centreEnergy && leftEnergy > rightEnergy) {
    pavementPosition = 'LEFT'
  } else if (rightEnergy > centreEnergy && rightEnergy > leftEnergy) {
    pavementPosition = 'RIGHT'
  }

  if (darkRatio > 0.08 && gradientRatio > 0.04) {
    hasSurfaceAnomaly = true
    anomalyType = 'possible pothole or depression'
    confidence = Math.min(0.82, Math.round((darkRatio * 3 + gradientRatio * 4) * 100) / 100)
  } else if (gradientRatio > 0.065) {
    hasSurfaceAnomaly = true
    anomalyType = 'uneven pavement / road cracks'
    confidence = Math.min(0.78, Math.round(gradientRatio * 800) / 100)
  }

  let spokenAlert: string | null = null
  if (hasSurfaceAnomaly && anomalyType) {
    const posWord =
      pavementPosition === 'CENTRE' ? 'ahead' : `on your ${pavementPosition.toLowerCase()}`
    if (lang === 'hi') {
      spokenAlert =
        anomalyType.includes('pothole')
          ? `${pavementPosition === 'CENTRE' ? 'सामने' : pavementPosition === 'LEFT' ? 'बाईं ओर' : 'दाईं ओर'} गड्ढे की संभावना है। कृपया सावधानी बरतें।`
          : `${pavementPosition === 'CENTRE' ? 'सामने' : pavementPosition === 'LEFT' ? 'बाईं ओर' : 'दाईं ओर'} उबड़-खाबड़ रास्ता दिखाई दे रहा है।`
    } else if (lang === 'pa') {
      spokenAlert =
        anomalyType.includes('pothole')
          ? `${pavementPosition === 'CENTRE' ? 'ਸਾਹਮਣੇ' : pavementPosition === 'LEFT' ? 'ਖੱਬੇ ਪਾਸੇ' : 'ਸੱਜੇ ਪਾਸੇ'} ਟੋਏ ਦੀ ਸੰਭਾਵਨਾ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਧਿਆਨ ਨਾਲ ਚੱਲੋ।`
          : `${pavementPosition === 'CENTRE' ? 'ਸਾਹਮਣੇ' : pavementPosition === 'LEFT' ? 'ਖੱਬੇ ਪਾਸੇ' : 'ਸੱਜੇ ਪਾਸੇ'} ਅਸਮਾਨ ਸੜਕ ਦਿਖਾਈ ਦੇ ਰਹੀ ਹੈ।`
    } else {
      spokenAlert =
        anomalyType.includes('pothole')
          ? `Possible pothole or depression detected ${posWord}. Exercise caution.`
          : `Uneven pavement or road cracks detected ${posWord}.`
    }

    const now = Date.now()
    if (shouldSpeak && now - lastHazardAnnouncedTime >= HAZARD_ANNOUNCE_COOLDOWN_MS) {
      lastHazardAnnouncedTime = now
      VoiceManager.announce(spokenAlert, 'MEDIUM', { lang, cooldownMs: 7000 })
    }
  }

  return {
    hasSurfaceAnomaly,
    anomalyType,
    confidence,
    pavementPosition,
    spokenAlert,
  }
}
