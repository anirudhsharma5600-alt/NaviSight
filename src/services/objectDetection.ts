import * as cocoSsd from '@tensorflow-models/coco-ssd'
import '@tensorflow/tfjs'

export interface Detection {
  class: string
  score: number
  bbox: [number, number, number, number] // [x, y, width, height]
  position: 'LEFT' | 'CENTRE' | 'RIGHT'
}

let model: cocoSsd.ObjectDetection | null = null
let loading = false

export async function loadModel(): Promise<void> {
  if (model || loading) return
  loading = true
  try {
    model = await cocoSsd.load({ base: 'lite_mobilenet_v2' })
  } finally {
    loading = false
  }
}

export async function detectObjects(
  video: HTMLVideoElement
): Promise<Detection[]> {
  if (!model) await loadModel()
  if (!model) return []

  const predictions = await model.detect(video, 10, 0.4)
  const videoWidth = video.videoWidth

  return predictions.map(p => {
    const centerX = p.bbox[0] + p.bbox[2] / 2
    const relativeX = centerX / videoWidth
    let position: 'LEFT' | 'CENTRE' | 'RIGHT' = 'CENTRE'
    if (relativeX < 0.33) position = 'LEFT'
    else if (relativeX > 0.66) position = 'RIGHT'

    return {
      class: p.class,
      score: p.score,
      bbox: p.bbox as [number, number, number, number],
      position
    }
  })
}

export function isModelLoaded(): boolean {
  return model !== null
}
