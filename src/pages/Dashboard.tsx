import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Camera as CameraIcon, CameraOff, Volume2, VolumeX, Eye, Loader2, AlertCircle, AudioLines } from 'lucide-react'
import { loadModel, detectObjects, isModelLoaded } from '../services/objectDetection'
import { speak, stopSpeaking, describeDetections } from '../services/speechService'

interface Detection {
  class: string
  score: number
  bbox: [number, number, number, number]
  position: 'LEFT' | 'CENTRE' | 'RIGHT'
}

export default function Dashboard() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const lastDetectionTime = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)

  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [detections, setDetections] = useState<Detection[]>([])
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [fps, setFps] = useState(0)
  const [isDetecting, setIsDetecting] = useState(false)

  const DETECTION_INTERVAL = 200 // ~5 fps

  // Load model on mount
  useEffect(() => {
    const init = async () => {
      setModelStatus('loading')
      try {
        await loadModel()
        setModelStatus('ready')
      } catch {
        setModelStatus('error')
      }
    }
    init()
  }, [])

  // Draw bounding boxes
  const drawDetections = useCallback((dets: Detection[]) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    dets.forEach((d) => {
      const [x, y, w, h] = d.bbox
      const color = d.position === 'LEFT' ? '#00e5ff' : d.position === 'RIGHT' ? '#7c3aed' : '#22c55e'

      // Box
      ctx.strokeStyle = color
      ctx.lineWidth = 2.5
      ctx.strokeRect(x, y, w, h)

      // Background label
      const label = `${d.class} ${Math.round(d.score * 100)}% (${d.position})`
      ctx.font = 'bold 14px Inter, system-ui, sans-serif'
      const textW = ctx.measureText(label).width
      ctx.fillStyle = color
      ctx.globalAlpha = 0.85
      ctx.fillRect(x, y - 26, textW + 12, 24)
      ctx.globalAlpha = 1

      // Label text
      ctx.fillStyle = '#000'
      ctx.fillText(label, x + 6, y - 8)
    })
  }, [])

  // Detection loop
  const detectLoop = useCallback(async () => {
    if (!cameraActive || !videoRef.current || videoRef.current.readyState < 2) {
      animationRef.current = requestAnimationFrame(detectLoop)
      return
    }

    const now = performance.now()
    if (now - lastDetectionTime.current > DETECTION_INTERVAL) {
      const start = performance.now()
      try {
        const results = await detectObjects(videoRef.current)
        setDetections(results)
        drawDetections(results)
        const elapsed = performance.now() - start
        setFps(Math.round(1000 / Math.max(elapsed, 1)))
      } catch {
        // skip frame
      }
      lastDetectionTime.current = now
    }

    animationRef.current = requestAnimationFrame(detectLoop)
  }, [cameraActive, drawDetections])

  // Start/stop detection loop
  useEffect(() => {
    if (cameraActive && modelStatus === 'ready') {
      setIsDetecting(true)
      animationRef.current = requestAnimationFrame(detectLoop)
    } else {
      setIsDetecting(false)
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [cameraActive, modelStatus, detectLoop])

  const startCamera = async () => {
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)
    } catch (err: any) {
      setCameraError(err.name === 'NotAllowedError' ? 'Camera permission denied. Please allow camera access.' : 'Could not access camera. Please check your device.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
    setDetections([])
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
  }

  const describeSurroundings = () => {
    const text = describeDetections(detections)
    if (audioEnabled) speak(text)
  }

  // Cleanup on unmount
  useEffect(() => () => { stopCamera(); stopSpeaking() }, [])

  const posColor = (p: string) => p === 'LEFT' ? 'text-cyan-400 bg-cyan-400/10' : p === 'RIGHT' ? 'text-purple-400 bg-purple-400/10' : 'text-green-400 bg-green-400/10'

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            AI Vision <span className="gradient-text">Dashboard</span>
          </h1>
          <p className="text-gray-400">Real-time object detection powered by COCO-SSD</p>
        </motion.div>

        {/* Status bar */}
        <div className="glass-card p-4 mb-6 flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${modelStatus === 'ready' ? 'bg-green-400 animate-pulse' : modelStatus === 'loading' ? 'bg-yellow-400 animate-pulse' : modelStatus === 'error' ? 'bg-red-400' : 'bg-gray-500'}`} />
            <span className="text-gray-300">
              {modelStatus === 'loading' ? 'Loading AI Model...' : modelStatus === 'ready' ? 'AI Model Ready' : modelStatus === 'error' ? 'Model Error' : 'Model Idle'}
            </span>
          </div>
          {isDetecting && <span className="text-cyan-400">⚡ {fps} FPS</span>}
          <span className="text-gray-400">Objects: {detections.length}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Camera Feed */}
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card overflow-hidden">
              <div className="relative bg-navy-900 aspect-video">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  style={{ display: cameraActive ? 'block' : 'none' }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full"
                  style={{ display: cameraActive ? 'block' : 'none' }}
                />
                {!cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-cyan-400/10 flex items-center justify-center">
                      <Eye className="w-10 h-10 text-cyan-400/50" />
                    </div>
                    <p className="text-gray-400">Start camera to begin AI detection</p>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="p-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={cameraActive ? stopCamera : startCamera}
                  disabled={modelStatus === 'loading'}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all ${
                    cameraActive
                      ? 'bg-red-500/20 text-red-400 border border-red-400/30 hover:bg-red-500/30'
                      : 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/30'
                  } disabled:opacity-40`}
                >
                  {cameraActive ? <CameraOff className="w-4 h-4" /> : <CameraIcon className="w-4 h-4" />}
                  {cameraActive ? 'Stop Camera' : 'Start Camera'}
                </button>

                <button
                  onClick={describeSurroundings}
                  disabled={!cameraActive || detections.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm bg-neon-purple/20 text-neon-purple border border-neon-purple/30 hover:bg-neon-purple/30 disabled:opacity-40 transition-all"
                >
                  <AudioLines className="w-4 h-4" /> Describe Surroundings
                </button>

                <button
                  onClick={() => { setAudioEnabled(!audioEnabled); if (audioEnabled) stopSpeaking() }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm border border-gray-600/30 hover:bg-white/5 transition-all"
                >
                  {audioEnabled ? <Volume2 className="w-4 h-4 text-green-400" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
                  {audioEnabled ? 'Audio On' : 'Audio Off'}
                </button>
              </div>

              {cameraError && (
                <div className="px-4 pb-4">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {cameraError}
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Detection Panel */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5 h-fit max-h-[600px] overflow-y-auto">
            <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-cyan-400" /> Detected Objects
            </h3>

            {modelStatus === 'loading' && (
              <div className="flex items-center gap-3 text-yellow-400 text-sm py-8 justify-center">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading AI Model...
              </div>
            )}

            {detections.length === 0 && cameraActive && modelStatus === 'ready' && (
              <p className="text-gray-500 text-sm text-center py-8">No objects detected yet. Point your camera at objects.</p>
            )}

            {!cameraActive && modelStatus === 'ready' && (
              <p className="text-gray-500 text-sm text-center py-8">Start the camera to detect objects.</p>
            )}

            <div className="space-y-2">
              {detections.map((d, i) => (
                <div key={`${d.class}-${i}`} className="bg-white/[0.03] rounded-xl p-3 border border-white/5 hover:border-cyan-400/20 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-sm capitalize">{d.class}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${posColor(d.position)}`}>
                      {d.position}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-neon-blue transition-all"
                        style={{ width: `${d.score * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-10 text-right">{Math.round(d.score * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

