import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera as CameraIcon, CameraOff, Volume2, VolumeX, Eye, Loader2,
  AlertCircle, AudioLines, Settings2, SlidersHorizontal,
  RefreshCw, SwitchCamera, Activity, CheckCircle2, XCircle, Info
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
import { naviOn, setLatestDetections } from '../services/naviEventBus'

// ─── Helper for readyState text ───
function getReadyStateDescription(state: number): string {
  switch (state) {
    case 0: return '0 (HAVE_NOTHING)'
    case 1: return '1 (HAVE_METADATA)'
    case 2: return '2 (HAVE_CURRENT_DATA)'
    case 3: return '3 (HAVE_FUTURE_DATA)'
    case 4: return '4 (HAVE_ENOUGH_DATA)'
    default: return `${state} (UNKNOWN)`
  }
}

export default function Dashboard() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const lastDetectionTime = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)
  const isStartingRef = useRef(false)

  // Camera & Detection state
  const [cameraActive, setCameraActive] = useState(false)
  const [isStartingCamera, setIsStartingCamera] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle')
  const [detections, setDetections] = useState<Detection[]>([])
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [fps, setFps] = useState(0)
  const [inferenceMs, setInferenceMs] = useState(0)
  const [isDetecting, setIsDetecting] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [confidence, setConfidence] = useState(getConfig().confidenceThreshold)
  const [detectionInterval, setDetectionInterval] = useState(200)
  const [totalDetected, setTotalDetected] = useState(0)

  // Detailed Debug State (Requirement D)
  const [debugInfo, setDebugInfo] = useState({
    permissionStatus: 'unknown',
    streamStatus: 'inactive',
    trackCount: 0,
    trackLabel: '',
    readyState: 0,
    readyStateText: '0 (HAVE_NOTHING)',
    videoWidth: 0,
    videoHeight: 0,
    errorMessage: '',
    apiAvailable: typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia,
  })

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

  // Update permission status via Permissions API
  const updatePermissionStatus = useCallback(async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const res = await navigator.permissions.query({ name: 'camera' as any })
        setDebugInfo(prev => ({ ...prev, permissionStatus: res.state }))
        res.onchange = () => {
          setDebugInfo(prev => ({ ...prev, permissionStatus: res.state }))
        }
      }
    } catch {
      // Permissions API for camera not supported in all browsers
    }
  }, [])

  // Enumerate available video input devices
  const updateAvailableCameras = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(d => d.kind === 'videoinput')
      setAvailableCameras(videoDevices)
      if (videoDevices.length > 0 && !selectedCameraId) {
        setSelectedCameraId(videoDevices[0].deviceId)
      }
    } catch (err: any) {
      console.warn('[Camera] Failed to enumerate devices:', err.message)
    }
  }, [selectedCameraId])

  // Initial checks on mount
  useEffect(() => {
    updatePermissionStatus()
    updateAvailableCameras()
  }, [updatePermissionStatus, updateAvailableCameras])

  // Draw bounding boxes with futuristic style
  const drawDetections = useCallback((dets: Detection[]) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video || video.videoWidth === 0 || video.videoHeight === 0) return

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
    }
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
    const video = videoRef.current
    if (!cameraActive || !video || video.readyState < 2 || video.videoWidth === 0) {
      animationRef.current = requestAnimationFrame(detectLoop)
      return
    }

    const now = performance.now()
    if (now - lastDetectionTime.current > detectionInterval) {
      const start = performance.now()
      try {
        const results = await detectObjects(video)
        const elapsed = performance.now() - start

        setDetections(results)
        setLatestDetections(results) // Publish to shared store for voice assistant
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

  // ─── A. CAMERA INITIALIZATION & B. VIDEO RENDERING ───
  const startCamera = useCallback(async (targetDeviceId?: string) => {
    // Prevent duplicate camera initialization (Requirement C)
    if (isStartingRef.current) {
      console.log('[Camera] Camera initialization already in progress, ignoring duplicate call.')
      return
    }
    isStartingRef.current = true
    setIsStartingCamera(true)
    setCameraError('')

    setDebugInfo(prev => ({
      ...prev,
      streamStatus: 'initializing',
      errorMessage: '',
    }))

    // A. Check whether navigator.mediaDevices and getUserMedia are available
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = 'navigator.mediaDevices.getUserMedia is not available. Ensure you are running on localhost or HTTPS.'
      console.error('[Camera]', msg)
      setCameraError(msg)
      setDebugInfo(prev => ({
        ...prev,
        streamStatus: 'error',
        errorMessage: msg,
        apiAvailable: false,
      }))
      isStartingRef.current = false
      setIsStartingCamera(false)
      return
    }

    // Stop any existing stream before starting a new one
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    const deviceToUse = targetDeviceId !== undefined ? targetDeviceId : selectedCameraId
    let stream: MediaStream | null = null
    let lastError: any = null

    // A. Request camera access using { video: { facingMode: "environment" }, audio: false }
    // Or target deviceId if specified
    try {
      const primaryConstraints: MediaStreamConstraints = deviceToUse
        ? { video: { deviceId: { exact: deviceToUse } }, audio: false }
        : { video: { facingMode: 'environment' }, audio: false }

      console.log('[Camera] Requesting camera with primary constraints:', primaryConstraints)
      stream = await navigator.mediaDevices.getUserMedia(primaryConstraints)
      console.log('[Camera] Primary getUserMedia succeeded.')
    } catch (err: any) {
      lastError = err
      console.warn('[Camera] Primary getUserMedia failed:', err.name, err.message)

      // A. If that fails, retry with video: true
      try {
        console.log('[Camera] Retrying getUserMedia with fallback constraint: { video: true, audio: false }...')
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        console.log('[Camera] Fallback getUserMedia ({ video: true }) succeeded.')
        lastError = null
      } catch (retryErr: any) {
        lastError = retryErr
        console.error('[Camera] Fallback getUserMedia also failed:', retryErr.name, retryErr.message)
      }
    }

    // Handle failure to acquire stream
    if (!stream) {
      const errName = lastError?.name || 'Error'
      const errMsg = lastError?.message || 'Could not access camera stream'
      const fullError = `${errName}: ${errMsg}`
      console.error('[Camera] Complete initialization failure:', fullError)

      setCameraError(
        errName === 'NotAllowedError' || errName === 'PermissionDeniedError'
          ? 'Camera permission denied. Please allow camera permissions in your browser.'
          : errName === 'NotFoundError' || errName === 'DevicesNotFoundError'
          ? 'No camera found on your system. Please connect a webcam.'
          : errName === 'NotReadableError' || errName === 'TrackStartError'
          ? 'Camera is in use by another application or tab.'
          : `Camera error: ${fullError}`
      )

      setDebugInfo(prev => ({
        ...prev,
        streamStatus: 'error',
        errorMessage: fullError,
      }))

      isStartingRef.current = false
      setIsStartingCamera(false)
      return
    }

    // B. VIDEO RENDERING
    streamRef.current = stream
    const tracks = stream.getVideoTracks()
    const activeTrack = tracks[0]
    const trackLabel = activeTrack ? activeTrack.label : 'Default Camera'

    // Check that the video element exists and its ref is correctly connected
    const video = videoRef.current
    if (!video) {
      const msg = 'Video element ref is not connected.'
      console.error('[Camera]', msg)
      setCameraError(msg)
      isStartingRef.current = false
      setIsStartingCamera(false)
      return
    }

    // Assign stream using videoRef.current.srcObject = stream
    video.srcObject = stream

    // Set autoPlay, muted, playsInline directly on element as well
    video.muted = true
    video.defaultMuted = true
    video.playsInline = true
    video.autoplay = true

    // Wait for loadedmetadata before considering the video ready
    await new Promise<void>((resolve) => {
      if (video.readyState >= 1 && video.videoWidth > 0) {
        resolve()
        return
      }
      const onLoaded = () => {
        video.removeEventListener('loadedmetadata', onLoaded)
        resolve()
      }
      video.addEventListener('loadedmetadata', onLoaded, { once: true })
      // Timeout fallback (2.5 seconds) to avoid freezing if browser delays event
      setTimeout(resolve, 2500)
    })

    // Call videoRef.current.play() and handle its rejected promise
    try {
      const playPromise = video.play()
      if (playPromise !== undefined) {
        await playPromise
      }
      console.log('[Camera] video.play() resolved. Dimensions:', video.videoWidth, 'x', video.videoHeight)
    } catch (playErr: any) {
      console.warn('[Camera] video.play() was rejected or interrupted:', playErr.name, playErr.message)
    }

    // Check videoWidth and videoHeight
    const width = video.videoWidth || 640
    const height = video.videoHeight || 480
    const readyState = video.readyState

    setCameraActive(true)
    setCameraStatus('active')
    setIsStartingCamera(false)
    isStartingRef.current = false

    // Update Debugging Panel state (Requirement D)
    setDebugInfo(prev => ({
      ...prev,
      streamStatus: 'streaming',
      trackCount: tracks.length,
      trackLabel: trackLabel,
      readyState: readyState,
      readyStateText: getReadyStateDescription(readyState),
      videoWidth: width,
      videoHeight: height,
      errorMessage: '',
    }))

    // Enumerate devices now that permission is granted (device labels will now be available)
    updateAvailableCameras()
    updatePermissionStatus()
  }, [selectedCameraId, updateAvailableCameras, updatePermissionStatus])

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        t.stop()
        console.log('[Camera] Stopped video track:', t.label)
      })
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
    setCameraStatus('inactive')
    setDetections([])
    setDebugInfo(prev => ({
      ...prev,
      streamStatus: 'inactive',
      trackCount: 0,
      trackLabel: '',
      readyState: 0,
      readyStateText: getReadyStateDescription(0),
      videoWidth: 0,
      videoHeight: 0,
    }))
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }
  }, [])

  // Switch camera (Requirement E)
  const switchCamera = useCallback(async (newDeviceId: string) => {
    setSelectedCameraId(newDeviceId)
    if (cameraActive) {
      await startCamera(newDeviceId)
    }
  }, [cameraActive, startCamera])

  // Retry Camera (Requirement E)
  const retryCamera = useCallback(() => {
    stopCamera()
    setTimeout(() => {
      startCamera()
    }, 200)
  }, [stopCamera, startCamera])

  // Listen for voice assistant camera commands via event bus with proper dependency array (Requirement C)
  useEffect(() => {
    const offStart = naviOn('camera:start', () => {
      if (!cameraActive) startCamera()
    })
    const offStop = naviOn('camera:stop', () => {
      if (cameraActive) stopCamera()
    })
    const offDescribe = naviOn('camera:describe', () => {
      describeSurroundings()
    })
    return () => {
      offStart()
      offStop()
      offDescribe()
    }
  }, [cameraActive, startCamera, stopCamera])

  const describeSurroundings = useCallback(() => {
    const scene = generateSceneDescription(detections, confidence)
    speak(scene.text)
  }, [detections, confidence])

  // Cleanup on unmount only (Requirement C)
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      stopSpeaking()
    }
  }, [])

  // Track video dimension updates in case resolution updates after initial play
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onDimensionsReady = () => {
      if (video.videoWidth > 0) {
        setDebugInfo(prev => ({
          ...prev,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
          readyStateText: getReadyStateDescription(video.readyState),
        }))
      }
    }
    video.addEventListener('resize', onDimensionsReady)
    video.addEventListener('loadeddata', onDimensionsReady)
    return () => {
      video.removeEventListener('resize', onDimensionsReady)
      video.removeEventListener('loadeddata', onDimensionsReady)
    }
  }, [])

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

          <div className="ml-auto flex items-center gap-2">
            {/* Debug panel toggle (Requirement D) */}
            <button
              onClick={() => setShowDebug(!showDebug)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                showDebug
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40'
                  : 'border-white/10 text-gray-400 hover:bg-white/5'
              }`}
              title="Camera diagnostics & debug panel"
            >
              <Activity className="w-3.5 h-3.5" /> Diagnostics
            </button>

            {/* Settings toggle */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                showSettings
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40'
                  : 'border-white/10 text-gray-400 hover:bg-white/5'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" /> Settings
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
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

        {/* ─── D. CAMERA DEBUGGING PANEL ─── */}
        {showDebug && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-5 mb-6 border-cyan-500/20 bg-[#0a0e1a]/95"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-cyan-400">
                <Activity className="w-4 h-4" /> Camera Diagnostics & Telemetry
              </h3>
              <span className="text-xs text-gray-500">Live Hardware Status</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-4 text-xs">
              {/* Permission */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <span className="text-gray-500 block mb-1">Permission</span>
                <span className={`font-semibold capitalize flex items-center gap-1 ${
                  debugInfo.permissionStatus === 'granted' ? 'text-green-400' :
                  debugInfo.permissionStatus === 'prompt' ? 'text-yellow-400' :
                  debugInfo.permissionStatus === 'denied' ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {debugInfo.permissionStatus === 'granted' ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                  {debugInfo.permissionStatus}
                </span>
              </div>

              {/* Stream Status */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <span className="text-gray-500 block mb-1">Stream Status</span>
                <span className={`font-semibold capitalize ${
                  debugInfo.streamStatus === 'streaming' ? 'text-green-400' :
                  debugInfo.streamStatus === 'initializing' ? 'text-yellow-400 animate-pulse' :
                  debugInfo.streamStatus === 'error' ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {debugInfo.streamStatus}
                </span>
              </div>

              {/* Video Tracks */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <span className="text-gray-500 block mb-1">Video Tracks</span>
                <span className="font-semibold text-white">
                  {debugInfo.trackCount} {debugInfo.trackCount === 1 ? 'track' : 'tracks'}
                </span>
              </div>

              {/* readyState */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <span className="text-gray-500 block mb-1">Video readyState</span>
                <span className={`font-semibold ${debugInfo.readyState >= 2 ? 'text-green-400' : 'text-yellow-400'}`}>
                  {debugInfo.readyStateText}
                </span>
              </div>

              {/* Resolution */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <span className="text-gray-500 block mb-1">Video Resolution</span>
                <span className="font-semibold text-white">
                  {debugInfo.videoWidth > 0 ? `${debugInfo.videoWidth} × ${debugInfo.videoHeight}` : '0 × 0 (idle)'}
                </span>
              </div>

              {/* MediaDevices API */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <span className="text-gray-500 block mb-1">getUserMedia API</span>
                <span className={`font-semibold flex items-center gap-1 ${debugInfo.apiAvailable ? 'text-green-400' : 'text-red-400'}`}>
                  {debugInfo.apiAvailable ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  {debugInfo.apiAvailable ? 'Available' : 'Unavailable'}
                </span>
              </div>
            </div>

            {/* Active Track / Camera Label */}
            {debugInfo.trackLabel && (
              <div className="text-xs text-gray-400 flex items-center gap-2 mb-2">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                <span>Active Camera: <strong className="text-white">{debugInfo.trackLabel}</strong></span>
              </div>
            )}

            {/* Exact Error Message if any */}
            {debugInfo.errorMessage && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 text-red-400 text-xs flex items-center gap-2 mt-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span><strong>Exact Error:</strong> {debugInfo.errorMessage}</span>
              </div>
            )}
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Camera Feed */}
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card overflow-hidden">
              <div className="relative bg-navy-900 aspect-video rounded-xl overflow-hidden">
                {/* 
                  B. VIDEO RENDERING & C. REACT LIFECYCLE:
                  Keep video element ALWAYS mounted in DOM with autoPlay, muted, playsInline.
                  Never use display: none which breaks width/height and frame decoding in browsers.
                */}
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />

                {/* Placeholder Overlay when camera is NOT active */}
                {!cameraActive && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-navy-900/95 backdrop-blur-sm">
                    <div className="w-20 h-20 rounded-full bg-cyan-400/10 flex items-center justify-center">
                      <Eye className="w-10 h-10 text-cyan-400/50" />
                    </div>
                    <p className="text-gray-400 font-medium text-sm">
                      {isStartingCamera ? 'Connecting to camera...' : 'Start camera to begin AI detection'}
                    </p>
                    {isStartingCamera && (
                      <div className="flex items-center gap-2 text-cyan-400 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> Initializing video stream...
                      </div>
                    )}
                    {modelStatus === 'loading' && !isStartingCamera && (
                      <div className="flex items-center gap-2 text-yellow-400 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading AI model...
                      </div>
                    )}
                  </div>
                )}

                {/* Live badge */}
                {cameraActive && isDetecting && (
                  <div className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/80 backdrop-blur-sm shadow-lg shadow-red-500/20">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span className="text-white text-xs font-bold tracking-wider">LIVE</span>
                  </div>
                )}
              </div>

              {/* ─── E. CAMERA CONTROLS ─── */}
              <div className="p-4 flex flex-wrap items-center gap-3">
                {/* Start / Stop Camera */}
                <button
                  onClick={cameraActive ? stopCamera : () => startCamera()}
                  disabled={modelStatus === 'loading' || isStartingCamera}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all ${
                    cameraActive
                      ? 'bg-red-500/20 text-red-400 border border-red-400/30 hover:bg-red-500/30'
                      : 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/30'
                  } disabled:opacity-40`}
                  aria-label={cameraActive ? 'Stop camera' : 'Start camera'}
                >
                  {isStartingCamera ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : cameraActive ? (
                    <CameraOff className="w-4 h-4" />
                  ) : (
                    <CameraIcon className="w-4 h-4" />
                  )}
                  {isStartingCamera ? 'Starting...' : cameraActive ? 'Stop Camera' : 'Start Camera'}
                </button>

                {/* Retry Camera (Requirement E) */}
                {(cameraError || !cameraActive) && (
                  <button
                    onClick={retryCamera}
                    disabled={isStartingCamera}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 transition-all disabled:opacity-40"
                    title="Retry camera initialization"
                    aria-label="Retry camera"
                  >
                    <RefreshCw className={`w-4 h-4 ${isStartingCamera ? 'animate-spin' : ''}`} />
                    Retry Camera
                  </button>
                )}

                {/* Switch Camera if multiple cameras exist (Requirement E) */}
                {availableCameras.length > 1 && (
                  <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-xs text-gray-300">
                    <SwitchCamera className="w-3.5 h-3.5 text-cyan-400" />
                    <select
                      value={selectedCameraId}
                      onChange={(e) => switchCamera(e.target.value)}
                      className="bg-transparent text-xs text-white focus:outline-none cursor-pointer pr-1"
                    >
                      {availableCameras.map((cam, idx) => (
                        <option key={cam.deviceId || idx} value={cam.deviceId} className="bg-navy-900 text-white">
                          {cam.label || `Camera ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Describe Surroundings */}
                <button
                  onClick={describeSurroundings}
                  disabled={!cameraActive || detections.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm bg-neon-purple/20 text-neon-purple border border-neon-purple/30 hover:bg-neon-purple/30 disabled:opacity-40 transition-all"
                  aria-label="Describe surroundings"
                >
                  <AudioLines className="w-4 h-4" /> Describe Surroundings
                </button>

                {/* Audio Announcements */}
                <button
                  onClick={() => { setAudioEnabled(!audioEnabled); if (audioEnabled) stopSpeaking() }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm border border-gray-600/30 hover:bg-white/5 transition-all"
                  aria-label={audioEnabled ? 'Mute audio' : 'Enable audio'}
                >
                  {audioEnabled ? <Volume2 className="w-4 h-4 text-green-400" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
                  {audioEnabled ? 'Audio On' : 'Audio Off'}
                </button>
              </div>

              {/* Camera Error Alert */}
              {cameraError && (
                <div className="px-4 pb-4">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{cameraError}</span>
                    </div>
                    <button
                      onClick={retryCamera}
                      className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-400/40 rounded-lg text-xs font-semibold text-red-300 transition-colors flex-shrink-0"
                    >
                      Retry Now
                    </button>
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
                  { label: 'Camera Stream', status: cameraActive ? 'streaming' : 'inactive', ok: cameraActive },
                  { label: 'Video Feed', status: cameraActive ? `${debugInfo.videoWidth}×${debugInfo.videoHeight}` : 'offline', ok: cameraActive && debugInfo.videoWidth > 0 },
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
