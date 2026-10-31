import { useEffect } from 'react'
import type { Detection } from '../../services/objectDetection'

interface DetectionOverlayProps {
  detections: Detection[]
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  videoRef: React.RefObject<HTMLVideoElement | null>
}

const POSITION_COLORS: Record<string, string> = {
  LEFT: '#00e5ff',    // cyan
  CENTRE: '#22c55e',  // green
  RIGHT: '#a855f7',   // purple
}

export default function DetectionOverlay({ detections, canvasRef, videoRef }: DetectionOverlayProps) {
  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Match canvas internal resolution to the video's natural resolution
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    detections.forEach(det => {
      const [x, y, w, h] = det.bbox
      const color = POSITION_COLORS[det.position] || '#00e5ff'
      const confidence = Math.round(det.score * 100)

      // Draw bounding box
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.setLineDash([])
      ctx.strokeRect(x, y, w, h)

      // Draw corner accents for futuristic look
      const cornerLen = Math.min(w, h) * 0.2
      ctx.lineWidth = 4
      ctx.beginPath()
      // Top-left
      ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y)
      // Top-right
      ctx.moveTo(x + w - cornerLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cornerLen)
      // Bottom-left
      ctx.moveTo(x, y + h - cornerLen); ctx.lineTo(x, y + h); ctx.lineTo(x + cornerLen, y + h)
      // Bottom-right
      ctx.moveTo(x + w - cornerLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cornerLen)
      ctx.stroke()

      // Draw label background
      const label = `${det.class} ${confidence}%`
      ctx.font = 'bold 14px Inter, system-ui, sans-serif'
      const textMetrics = ctx.measureText(label)
      const textWidth = textMetrics.width
      const textHeight = 20
      const labelY = y > textHeight + 4 ? y - textHeight - 4 : y + 4

      ctx.fillStyle = color + 'CC' // semi-transparent
      ctx.beginPath()
      ctx.roundRect(x, labelY, textWidth + 12, textHeight, 4)
      ctx.fill()

      // Draw label text
      ctx.fillStyle = '#0a0e1a'
      ctx.textBaseline = 'top'
      ctx.fillText(label, x + 6, labelY + 3)
    })
  }, [detections, canvasRef, videoRef])

  return null
}
