import * as cocoSsd from '@tensorflow-models/coco-ssd'
import '@tensorflow/tfjs'

// ─── Types ───

export interface Detection {
  class: string
  score: number
  bbox: [number, number, number, number] // [x, y, width, height]
  position: 'LEFT' | 'CENTRE' | 'RIGHT'
  id: number
}

export interface DetectionConfig {
  confidenceThreshold: number
  maxDetections: number
  iouThreshold: number
  enableTracking: boolean
}

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error'

// ─── Defaults ───

const DEFAULT_CONFIG: DetectionConfig = {
  confidenceThreshold: 0.45,
  maxDetections: 15,
  iouThreshold: 0.5,
  enableTracking: true,
}

// ─── State ───

let model: cocoSsd.ObjectDetection | null = null
let modelStatus: ModelStatus = 'idle'
let config: DetectionConfig = { ...DEFAULT_CONFIG }
let nextId = 1
let previousDetections: Detection[] = []

// ─── Listeners ───

type StatusListener = (status: ModelStatus) => void
const statusListeners: Set<StatusListener> = new Set()

export function onModelStatusChange(fn: StatusListener): () => void {
  statusListeners.add(fn)
  return () => statusListeners.delete(fn)
}

function setStatus(s: ModelStatus) {
  modelStatus = s
  statusListeners.forEach(fn => fn(s))
}

// ─── Config ───

export function getConfig(): DetectionConfig {
  return { ...config }
}

export function updateConfig(partial: Partial<DetectionConfig>): void {
  config = { ...config, ...partial }
}

// ─── Model Loading ───

export async function loadModel(): Promise<void> {
  if (model) return
  if (modelStatus === 'loading') return

  setStatus('loading')
  try {
    model = await cocoSsd.load({ base: 'lite_mobilenet_v2' })
    setStatus('ready')
  } catch (err) {
    console.error('[ObjectDetection] Model load failed:', err)
    setStatus('error')
    throw err
  }
}

export function getModelStatus(): ModelStatus {
  return modelStatus
}

export function isModelLoaded(): boolean {
  return model !== null
}

// ─── IOU Calculation ───

function computeIOU(a: number[], b: number[]): number {
  const x1 = Math.max(a[0], b[0])
  const y1 = Math.max(a[1], b[1])
  const x2 = Math.min(a[0] + a[2], b[0] + b[2])
  const y2 = Math.min(a[1] + a[3], b[1] + b[3])

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const areaA = a[2] * a[3]
  const areaB = b[2] * b[3]
  const union = areaA + areaB - intersection

  return union > 0 ? intersection / union : 0
}

// ─── NMS (Non-Maximum Suppression) ───

function applyNMS(
  detections: Detection[],
  iouThreshold: number
): Detection[] {
  const sorted = [...detections].sort((a, b) => b.score - a.score)
  const keep: Detection[] = []

  for (const det of sorted) {
    let shouldKeep = true
    for (const kept of keep) {
      if (det.class === kept.class && computeIOU(det.bbox, kept.bbox) > iouThreshold) {
        shouldKeep = false
        break
      }
    }
    if (shouldKeep) keep.push(det)
  }

  return keep
}

// ─── Temporal Tracking ───

function assignIds(current: Detection[], previous: Detection[]): Detection[] {
  if (!config.enableTracking || previous.length === 0) {
    return current.map(d => ({ ...d, id: nextId++ }))
  }

  const used = new Set<number>()
  const result: Detection[] = []

  for (const det of current) {
    let bestMatch: Detection | null = null
    let bestIOU = 0.3 // minimum IOU to consider a match

    for (const prev of previous) {
      if (used.has(prev.id)) continue
      if (det.class !== prev.class) continue

      const iou = computeIOU(det.bbox, prev.bbox)
      if (iou > bestIOU) {
        bestIOU = iou
        bestMatch = prev
      }
    }

    if (bestMatch) {
      used.add(bestMatch.id)
      result.push({ ...det, id: bestMatch.id })
    } else {
      result.push({ ...det, id: nextId++ })
    }
  }

  return result
}

// ─── Position Calculation ───

function calcPosition(bbox: number[], videoWidth: number): 'LEFT' | 'CENTRE' | 'RIGHT' {
  const centerX = bbox[0] + bbox[2] / 2
  const rel = centerX / videoWidth
  if (rel < 0.33) return 'LEFT'
  if (rel > 0.66) return 'RIGHT'
  return 'CENTRE'
}

// ─── Main Detection Function ───

export async function detectObjects(
  video: HTMLVideoElement
): Promise<Detection[]> {
  if (!model) {
    await loadModel()
    if (!model) return []
  }

  const predictions = await model.detect(video, config.maxDetections, config.confidenceThreshold)
  const videoWidth = video.videoWidth

  let detections: Detection[] = predictions.map(p => ({
    class: p.class,
    score: p.score,
    bbox: p.bbox as [number, number, number, number],
    position: calcPosition(p.bbox, videoWidth),
    id: 0,
  }))

  // Apply NMS to remove duplicate boxes
  detections = applyNMS(detections, config.iouThreshold)

  // Assign stable IDs via temporal tracking
  detections = assignIds(detections, previousDetections)

  // Store for next frame
  previousDetections = detections

  return detections
}

// ─── COCO Class List (for reference) ───

export const COCO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck',
  'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench',
  'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra',
  'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
  'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup',
  'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
  'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
  'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear',
  'hair drier', 'toothbrush',
]
