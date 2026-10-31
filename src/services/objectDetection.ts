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
  confidenceThreshold: 0.55,
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
let modelLoadPromise: Promise<void> | null = null

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
  if (modelLoadPromise) return modelLoadPromise

  setStatus('loading')
  modelLoadPromise = (async () => {
    try {
      model = await cocoSsd.load({ base: 'lite_mobilenet_v2' })
      setStatus('ready')
    } catch (err) {
      console.error('[ObjectDetection] Model load failed:', err)
      setStatus('error')
      throw err
    }
  })()

  try {
    await modelLoadPromise
  } finally {
    modelLoadPromise = null
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

// ─── Performance Metrics ───

let _lastFpsTime = 0
let _frameCount = 0
let _currentFps = 0
let _lastInferenceMs = 0

export function getPerformanceMetrics() {
  return { fps: _currentFps, inferenceMs: _lastInferenceMs }
}

// ─── Off-screen canvas for frame resize (perf optimization) ───

let _resizeCanvas: OffscreenCanvas | HTMLCanvasElement | null = null

function getResizedFrame(video: HTMLVideoElement, maxDim: number): HTMLCanvasElement | OffscreenCanvas | HTMLVideoElement {
  const vw = video.videoWidth
  const vh = video.videoHeight
  // Skip resize if already small enough
  if (vw <= maxDim && vh <= maxDim) return video

  const scale = Math.min(maxDim / vw, maxDim / vh)
  const tw = Math.round(vw * scale)
  const th = Math.round(vh * scale)

  if (!_resizeCanvas) {
    _resizeCanvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(tw, th)
      : document.createElement('canvas')
  }
  _resizeCanvas.width = tw
  _resizeCanvas.height = th

  const ctx = _resizeCanvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  if (!ctx) return video
  ctx.drawImage(video, 0, 0, tw, th)
  return _resizeCanvas as HTMLCanvasElement
}

// ─── Main Detection Function ───

export async function detectObjects(
  video: HTMLVideoElement,
  options?: { resizeMaxDim?: number }
): Promise<Detection[]> {
  if (!model) {
    await loadModel()
    if (!model) return []
  }

  const maxDim = options?.resizeMaxDim ?? 640
  const inputFrame = getResizedFrame(video, maxDim) as HTMLCanvasElement | HTMLVideoElement

  const start = performance.now()
  const predictions = await model.detect(inputFrame, config.maxDetections, config.confidenceThreshold)
  _lastInferenceMs = Math.round(performance.now() - start)

  // FPS tracking
  _frameCount++
  const now = performance.now()
  if (now - _lastFpsTime >= 1000) {
    _currentFps = _frameCount
    _frameCount = 0
    _lastFpsTime = now
  }

  // Scale bounding boxes back to original video dimensions if we resized
  const scaleX = inputFrame === video ? 1 : video.videoWidth / (inputFrame as HTMLCanvasElement).width
  const scaleY = inputFrame === video ? 1 : video.videoHeight / (inputFrame as HTMLCanvasElement).height
  const videoWidth = video.videoWidth

  let detections: Detection[] = predictions.map(p => ({
    class: p.class,
    score: p.score,
    bbox: [
      p.bbox[0] * scaleX,
      p.bbox[1] * scaleY,
      p.bbox[2] * scaleX,
      p.bbox[3] * scaleY,
    ] as [number, number, number, number],
    position: calcPosition(
      [p.bbox[0] * scaleX, p.bbox[1] * scaleY, p.bbox[2] * scaleX, p.bbox[3] * scaleY],
      videoWidth
    ),
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

// ─── Cleanup ───

export function cleanup(): void {
  model?.dispose()
  model = null
  modelLoadPromise = null
  previousDetections = []
  nextId = 1
  _resizeCanvas = null
  _frameCount = 0
  _currentFps = 0
  setStatus('idle')
}
