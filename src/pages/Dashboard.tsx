import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Camera as CameraIcon, CameraOff, Volume2, VolumeX, Eye, Loader2,
  AlertCircle, AudioLines, Settings2, SlidersHorizontal,
} from 'lucide-react'
import {
  loadModel, detectObjects, isModelLoaded, getModelStatus,
  onModelStatusChange, getConfig, updateConfig, COCO_CLASSES,
  type Detection, type ModelStatus,
} from '../services/objectDetection'
import { speak, stopSpeaking } from '../services/speechService'
import {
  generateSceneDescription, generateNewDetectionAnnouncements,
  resetAnnouncementCooldowns,
} from '../services/contextEngine'
import { setCameraStatus } from '../services/modelManager'

export default function Dashboard() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const lastDetectionTime = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)

  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle')
  const [detections, setDetections] = useState<Detection[]>([])
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [fps, setFps] = useState(0)
  const [inferenceMs, setInferenceMs] = useState(0)
  const [isDetecting, setIsDetecting] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [confidence, setConfidence] = useState(getConfig().confidenceThreshold)
  const [detectionInterval, setDetectionInterval] = useState(200)
  const [totalDetected, setTotalDetected] = useState(0)

  // Subscribe to model status changes
  useEffect(() => {
    setModelStatus(getModelStatus())
    return onModelStatusChange(setModelStatus)
  }, [])

  // Load model on mount
  useEffect(() => {
    if (modelStatus === 'idle') {
      loadModel().catch(() => {})
    }
  }, [modelStatus])

  // Draw bounding boxes with futuristic style
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

      // Bounding box
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.setLineDash([])
      ctx.strokeRect(x, y, w, h)

      // Corner accents
      const corner = Math.min(w, h) * 0.15
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x, y + corner); ctx.lineTo(x, y); ctx.lineTo(x + corner, y)
      ctx.moveTo(x + w - corner, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + corner)
      ctx.moveTo(x, y + h - corner); ctx.lineTo(x, y + h); ctx.lineTo(x + corner, y + h)
      ctx.moveTo(x + w - corner, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - corner)
      ctx.stroke()

      // Label background
      const label = `${d.class} ${Math.round(d.score * 100)}% [${d.position}]`
      ctx.font = 'bold 13px Inter, system-ui, sans-serif'
      const textW = ctx.measureText(label).width
      const labelY = y > 28 ? y - 28 : y + 4
      ctx.fillStyle = color
      ctx.globalAlpha = 0.88
      ctx.beginPath()
      ctx.roundRect(x, labelY, textW + 14, 22, 4)
      ctx.fill()
      ctx.globalAlpha = 1

      // Label text
      ctx.fillStyle = '#0a0e1a'
      ctx.textBaseline = 'top'
      ctx.fillText(label, x + 7, labelY + 4)
    })
  }, [])

  // Detection loop
  const detectLoop = useCallback(async () => {
    if (!cameraActive || !videoRef.current || videoRef.current.readyState < 2) {
      animationRef.current = requestAnimationFrame(detectLoop)
      return
    }

    const now = performance.now()
    if (now - lastDetectionTime.current > detectionInterval) {
      const start = performance.now()
      try {
        const results = await detectObjects(videoRef.current)
        const elapsed = performance.now() - start

        setDetections(results)
        setTotalDetected(prev => prev + results.length)
        drawDetections(results)
        setInferenceMs(Math.round(elapsed))
        setFps(Math.round(1000 / Math.max(elapsed, 1)))

        // Auto-announce new detections
        if (audioEnabled && results.length > 0) {
          const announcements = generateNewDetectionAnnouncements(results)
          if (announcements.length > 0) {
            speak(announcements.join('. '))
          }
        }
      } catch {
        // skip frame on error
      }
      lastDetectionTime.current = now
    }

    animationRef.current = requestAnimationFrame(detectLoop)
  }, [cameraActive, drawDetections, detectionInterval, audioEnabled])

  // Start/stop detection loop
  useEffect(() => {
    if (cameraActive && modelStatus === 'ready') {
      setIsDetecting(true)
      resetAnnouncementCooldowns()
      animationRef.current = requestAnimationFrame(detectLoop)
    } else {
      setIsDetecting(false)
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [cameraActive, modelStatus, detectLoop])

  // Update config when confidence changes
  useEffect(() => {
    updateConfig({ confidenceThreshold: confidence })
  }, [confidence])

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
      setCameraStatus('active')
    } catch (err: any) {
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : 'Could not access camera. Check if another app is using it.'
      )
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
    setCameraStatus('inactive')
    setDetections([])
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
  }

  const describeSurroundings = () => {
    const scene = generateSceneDescription(detections, confidence)
    speak(scene.text)
  }

  // Cleanup on unmount
  useEffect(() => () => { stopCamera(); stopSpeaking() }, [])

  const posColor = (p: string) =>
    p === 'LEFT' ? 'text-cyan-400 bg-cyan-400/10' :
    p === 'RIGHT' ? 'text-purple-400 bg-purple-400/10' :
    'text-green-400 bg-green-400/10'

  const statusDot = modelStatus === 'ready' ? 'bg-green-400' :
    modelStatus === 'loading' ? 'bg-yellow-400 animate-pulse' :
    modelStatus === 'error' ? 'bg-red-400' : 'bg-gray-500'

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            AI Vision <span className="gradient-text">Dashboard</span>
          </h1>
          <p className="text-gray-400">Real-time object detection · {COCO_CLASSES.length} classes · COCO-SSD MobileNet v2</p>
        </motion.div>

        {/* Status bar */}
        <div className="glass-card p-4 mb-6 flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${statusDot}`} />
            <span className="text-gray-300">
              {modelStatus === 'loading' ? 'Loading AI Model...' : modelStatus === 'ready' ? 'Model Ready' : modelStatus === 'error' ? 'Model Error' : 'Idle'}
            </span>
          </div>
          {isDetecting && (
            <>
              <span className="text-cyan-400">⚡ {fps} FPS</span>
              <span className="text-gray-500">{inferenceMs}ms</span>
            </>
          )}
          <span className="text-gray-400">Objects: {detections.length}</span>
          <span className="text-gray-500">Threshold: {Math.round(confidence * 100)}%</span>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-white/10 hover:bg-white/5 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Settings
          </button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="glass-card p-5 mb-6"
          >
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-cyan-400" /> Detection Settings
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="text-xs text-gray-400 mb-2 block">
                  Confidence Threshold: <span className="text-cyan-400">{Math.round(confidence * 100)}%</span>
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={0.95}
                  step={0.05}
                  value={confidence}
                  onChange={(e) => setConfidence(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>More detections</span>
                  <span>Higher accuracy</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-2 block">
                  Detection Interval: <span className="text-cyan-400">{detectionInterval}ms</span>
                </label>
                <input
                  type="range"
                  min={100}
                  max={1000}
                  step={50}
                  value={detectionInterval}
                  onChange={(e) => setDetectionInterval(parseInt(e.target.value))}
                  className="w-full accent-cyan-400"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>Faster (more CPU)</span>
                  <span>Slower (less CPU)</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

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
                    {modelStatus === 'loading' && (
                      <div className="flex items-center gap-2 text-yellow-400 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading AI model...
                      </div>
                    )}
                  </div>
                )}
                {/* Live badge */}
                {cameraActive && isDetecting && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/80 backdrop-blur-sm">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span className="text-white text-xs font-bold tracking-wider">LIVE</span>
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
                  aria-label={cameraActive ? 'Stop camera' : 'Start camera'}
                >
                  {cameraActive ? <CameraOff className="w-4 h-4" /> : <CameraIcon className="w-4 h-4" />}
                  {cameraActive ? 'Stop Camera' : 'Start Camera'}
                </button>

                <button
                  onClick={describeSurroundings}
                  disabled={!cameraActive || detections.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm bg-neon-purple/20 text-neon-purple border border-neon-purple/30 hover:bg-neon-purple/30 disabled:opacity-40 transition-all"
                  aria-label="Describe surroundings"
                >
                  <AudioLines className="w-4 h-4" /> Describe Surroundings
                </button>

                <button
                  onClick={() => { setAudioEnabled(!audioEnabled); if (audioEnabled) stopSpeaking() }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm border border-gray-600/30 hover:bg-white/5 transition-all"
                  aria-label={audioEnabled ? 'Mute audio' : 'Enable audio'}
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
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <div className="glass-card p-5 h-fit max-h-[600px] overflow-y-auto">
              <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-cyan-400" /> Detected Objects
              </h3>

              {modelStatus === 'loading' && (
                <div className="flex items-center gap-3 text-yellow-400 text-sm py-8 justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading AI Model...
                </div>
              )}

              {modelStatus === 'error' && (
                <div className="text-red-400 text-sm text-center py-8">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Failed to load AI model. Check your connection and refresh.
                </div>
              )}

              {detections.length === 0 && cameraActive && modelStatus === 'ready' && (
                <p className="text-gray-500 text-sm text-center py-8">No objects detected. Point your camera at objects.</p>
              )}

              {!cameraActive && modelStatus === 'ready' && (
                <p className="text-gray-500 text-sm text-center py-8">Start the camera to detect objects.</p>
              )}

              <div className="space-y-2">
                {detections.map((d) => (
                  <div key={d.id} className="bg-white/[0.03] rounded-xl p-3 border border-white/5 hover:border-cyan-400/20 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-medium text-sm capitalize">{d.class}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${posColor(d.position)}`}>
                        {d.position}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-neon-blue transition-all duration-300"
                          style={{ width: `${d.score * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-10 text-right">{Math.round(d.score * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Status Mini Panel */}
            <div className="glass-card p-4 mt-4">
              <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-3">AI Status</h4>
              <div className="space-y-2 text-xs">
                {[
                  { label: 'Object Detection', status: modelStatus, ok: modelStatus === 'ready' },
                  { label: 'Camera', status: cameraActive ? 'active' : 'inactive', ok: cameraActive },
                  { label: 'Voice Output', status: 'available', ok: true },
                  { label: 'Audio Announce', status: audioEnabled ? 'enabled' : 'muted', ok: audioEnabled },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="text-gray-400">{s.label}</span>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${s.ok ? 'bg-green-400' : 'bg-gray-500'}`} />
                      <span className={s.ok ? 'text-green-400' : 'text-gray-500'}>{s.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
