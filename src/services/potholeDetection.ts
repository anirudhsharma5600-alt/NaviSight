// ─── Road Hazard / Pothole Detection Service ───
// Status: MODEL TRAINING PENDING
// Train using RDD2022 dataset with pipeline in ml/pothole_detection/

// ─── Types ───

export type PotholeModelStatus = 'not_trained' | 'loading' | 'ready' | 'error'

export interface RoadHazard {
  type: 'pothole' | 'crack' | 'rough_surface' | 'obstacle'
  severity: 'low' | 'medium' | 'high'
  confidence: number
  bbox: [number, number, number, number]
  position: 'LEFT' | 'CENTRE' | 'RIGHT'
}

export interface PotholeModelInfo {
  status: PotholeModelStatus
  modelName: string
  trainingStatus: string
  supportedHazards: string[]
  disclaimer: string
}

// ─── Constants ───

export const POTHOLE_DISCLAIMER =
  'Road hazard detection is experimental. Never assume a road is safe based on AI analysis. ' +
  'Always exercise caution while walking or driving.'

export const SUPPORTED_HAZARDS = [
  'Pothole (D40)',
  'Longitudinal Crack (D00)',
  'Transverse Crack (D10)',
  'Alligator Crack (D20)',
]

// ─── State ───

let modelStatus: PotholeModelStatus = 'not_trained'

// ─── Public API ───

export function getPotholeModelInfo(): PotholeModelInfo {
  return {
    status: modelStatus,
    modelName: 'YOLOv8n-RDD2022 (Road Damage)',
    trainingStatus: 'PENDING — Train using ml/pothole_detection/train_pothole_model.py',
    supportedHazards: [...SUPPORTED_HAZARDS],
    disclaimer: POTHOLE_DISCLAIMER,
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
      console.warn('[PotholeDetection] Model not found at /models/pothole/model.onnx')
      console.warn('[PotholeDetection] Train with: ml/pothole_detection/train_pothole_model.py')
      modelStatus = 'not_trained'
      return
    }
    console.log('[PotholeDetection] Model file found, ONNX runtime load pending')
    modelStatus = 'not_trained'
  } catch {
    modelStatus = 'not_trained'
  }
}

export async function detectRoadHazards(
  _imageData: ImageData
): Promise<RoadHazard[]> {
  if (modelStatus !== 'ready') {
    return [] // No fake results
  }
  return []
}

export function captureRoadFrame(video: HTMLVideoElement): ImageData | null {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(video, 0, 0)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}
