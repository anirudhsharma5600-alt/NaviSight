import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Camera, CameraOff, Volume2, VolumeX, AlertCircle, Eye, Loader2,
  RefreshCw, SwitchCamera, Activity, Info, Shield
} from 'lucide-react'
import {
  loadModel, detectObjects, isModelLoaded, getModelStatus, onModelStatusChange,
  type Detection, type ModelStatus,
} from '../services/objectDetection'
import {
  initProximityEngine, processDetectionsForProximity,
  setAlertsEnabled, setVibrationEnabled, setAlertVolume, playTestBeep,
  getProximityConfig, updateProximityConfig,
  connectBLESensor, disconnectBLESensor, isBLESensorConnected, getSensorDistance,
  isBLESupported, isVibrationSupported,
  type ProximityAlert, type AlertLevel,
} from '../services/proximityEngine'
import { speak } from '../services/speechService'

const ZONE_COLORS: Record<string, string> = {
  NEAR: '#ef4444',
  MEDIUM: '#f59e0b',
  FAR: '#22c55e',
}

const LEVEL_STYLES: Record<string, string> = {
  CRITICAL: 'bg-red-500/20 border-red-500/30 text-red-400',
  DANGER: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
  WARNING: 'bg-green-500/20 border-green-500/30 text-green-400',
}

export default function ProximityPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)
  const isStartingRef = useRef(false)

  const [cameraActive, setCameraActive] = useState(false)
  const [isStartingCamera, setIsStartingCamera] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle')
  const [alerts, setAlerts] = useState<ProximityAlert[]>([])

  // Controls
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [vibrationOn, setVibrationOn] = useState(true)
  const [voiceOn, setVoiceOn] = useState(true)
  const [volume, setVolume] = useState(0.6)
  const [sensitivity, setSensitivity] = useState<'low' | 'medium' | 'high'>('medium')

  // BLE
  const [bleStatus, setBleStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [bleDistance, setBleDistance] = useState<number | null>(null)

  useEffect(() => {
    setModelStatus(getModelStatus())
    return onModelStatusChange(setModelStatus)
  }, [])

  useEffect(() => {
    if (modelStatus === 'idle') {
      loadModel().catch(() => {})
    }
  }, [modelStatus])

  useEffect(() => {
    initProximityEngine()
  }, [])

  // Sync controls to engine
  useEffect(() => {
    setAlertsEnabled(soundEnabled)
    setVibrationEnabled(vibrationOn)
    setAlertVolume(volume)
    updateProximityConfig({ sensitivity, voiceEnabled: voiceOn })
  }, [soundEnabled, vibrationOn, volume, sensitivity, voiceOn])

  // Camera start
  const startCamera = useCallback(async () => {
    if (isStartingRef.current) return
    isStartingRef.current = true
    setIsStartingCamera(true)
    setCameraError('')

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera API not available. Use HTTPS or localhost.')
      isStartingRef.current = false
      setIsStartingCamera(false)
      return
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      } catch (err: unknown) {
        const e = err as Error
        setCameraError(`Camera error: ${e.message || 'Could not access camera'}`)
        isStartingRef.current = false
        setIsStartingCamera(false)
        return
      }
    }

    if (!stream) {
      setCameraError('Failed to acquire camera stream')
      isStartingRef.current = false
      setIsStartingCamera(false)
      return
    }

    streamRef.current = stream
    const video = videoRef.current
    if (!video) {
      isStartingRef.current = false
      setIsStartingCamera(false)
      return
    }

    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    video.autoplay = true

    await new Promise<void>(resolve => {
      if (video.readyState >= 1 && video.videoWidth > 0) { resolve(); return }
      video.addEventListener('loadedmetadata', () => resolve(), { once: true })
      setTimeout(resolve, 2500)
    })

    try { await video.play() } catch { /* ignore */ }

    setCameraActive(true)
    setIsStartingCamera(false)
    isStartingRef.current = false
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
    setAlerts([])
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
  }, [])

  // Detection + proximity loop
  const detectLoop = useCallback(async () => {
    const video = videoRef.current
    if (!cameraActive || !video || video.readyState < 2 || video.videoWidth === 0) {
      animationRef.current = requestAnimationFrame(detectLoop)
      return
    }

    try {
      const detections = await detectObjects(video)
      const proximityAlerts = processDetectionsForProximity(
        detections, video.videoWidth, video.videoHeight
      )
      setAlerts(proximityAlerts)
      drawProximityOverlay(detections, proximityAlerts)

      // Voice announce critical/danger
      if (voiceOn && proximityAlerts.length > 0) {
        const critical = proximityAlerts.filter(a => a.level === 'CRITICAL')
        if (critical.length > 0) {
          const names = critical.map(a => a.objectClass).join(', ')
          speak(`Warning! ${names} very close.`)
        }
      }
    } catch { /* skip frame */ }

    animationRef.current = requestAnimationFrame(detectLoop)
  }, [cameraActive, voiceOn])

  useEffect(() => {
    if (cameraActive && modelStatus === 'ready') {
      animationRef.current = requestAnimationFrame(detectLoop)
    }
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current) }
  }, [cameraActive, modelStatus, detectLoop])

  // Draw proximity overlay
  const drawProximityOverlay = useCallback((detections: Detection[], proximityAlerts: ProximityAlert[]) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video || video.videoWidth === 0) return

    if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth
    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    detections.forEach((d, i) => {
      const alert = proximityAlerts.find(a => a.objectClass === d.class && a.position === d.position)
      const zone = alert?.zone || 'FAR'
      const color = ZONE_COLORS[zone] || '#22c55e'
      const [x, y, w, h] = d.bbox

      ctx.strokeStyle = color
      ctx.lineWidth = zone === 'NEAR' ? 4 : zone === 'MEDIUM' ? 3 : 2
      ctx.strokeRect(x, y, w, h)

      // Zone label
      const label = `${d.class} [${zone}]`
      ctx.font = 'bold 13px Inter, system-ui, sans-serif'
      const tw = ctx.measureText(label).width
      const ly = y > 28 ? y - 28 : y + 4
      ctx.fillStyle = color
      ctx.globalAlpha = 0.85
      ctx.beginPath()
      ctx.roundRect(x, ly, tw + 14, 22, 4)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.fillStyle = '#0a0e1a'
      ctx.textBaseline = 'top'
      ctx.fillText(label, x + 7, ly + 4)
    })
  }, [])

  // BLE sensor polling
  useEffect(() => {
    if (bleStatus !== 'connected') return
    const interval = setInterval(() => {
      setBleDistance(getSensorDistance())
    }, 200)
    return () => clearInterval(interval)
  }, [bleStatus])

  const handleBLEConnect = async () => {
    setBleStatus('connecting')
    const ok = await connectBLESensor()
    setBleStatus(ok ? 'connected' : 'disconnected')
  }

  const handleBLEDisconnect = () => {
    disconnectBLESensor()
    setBleStatus('disconnected')
    setBleDistance(null)
  }

  // Cleanup
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            Proximity <span className="gradient-text">Alerts</span>
          </h1>
          <p className="text-gray-400">Smart proximity detection with audio, vibration and voice warnings</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Camera Feed */}
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card overflow-hidden">
              <div className="relative bg-navy-900 aspect-video rounded-xl overflow-hidden">
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

                {!cameraActive && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-navy-900/95 backdrop-blur-sm">
                    <div className="w-20 h-20 rounded-full bg-cyan-400/10 flex items-center justify-center">
                      <Shield className="w-10 h-10 text-cyan-400/50" />
                    </div>
                    <p className="text-gray-400 font-medium text-sm">
                      {isStartingCamera ? 'Connecting to camera...' : 'Start camera for proximity detection'}
                    </p>
                    {isStartingCamera && (
                      <div className="flex items-center gap-2 text-cyan-400 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" /> Initializing...
                      </div>
                    )}
                  </div>
                )}

                {cameraActive && alerts.some(a => a.level === 'CRITICAL') && (
                  <div className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/90 backdrop-blur-sm shadow-lg animate-pulse">
                    <AlertCircle className="w-4 h-4 text-white" />
                    <span className="text-white text-xs font-bold">PROXIMITY WARNING</span>
                  </div>
                )}
              </div>

              {/* Camera Controls */}
              <div className="p-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={cameraActive ? stopCamera : startCamera}
                  disabled={modelStatus === 'loading' || isStartingCamera}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all ${
                    cameraActive
                      ? 'bg-red-500/20 text-red-400 border border-red-400/30 hover:bg-red-500/30'
                      : 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/30'
                  } disabled:opacity-40`}
                >
                  {isStartingCamera ? <Loader2 className="w-4 h-4 animate-spin" /> :
                    cameraActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                  {isStartingCamera ? 'Starting...' : cameraActive ? 'Stop Camera' : 'Start Camera'}
                </button>

                {/* Test beeps */}
                <div className="flex items-center gap-1.5">
                  {(['WARNING', 'DANGER', 'CRITICAL'] as AlertLevel[]).map(level => (
                    <button
                      key={level}
                      onClick={() => playTestBeep(level)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        level === 'WARNING' ? 'border-green-400/30 text-green-400 hover:bg-green-400/10' :
                        level === 'DANGER' ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10' :
                        'border-red-400/30 text-red-400 hover:bg-red-400/10'
                      }`}
                    >
                      Test {level}
                    </button>
                  ))}
                </div>
              </div>

              {cameraError && (
                <div className="px-4 pb-4">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{cameraError}</span>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Alert Controls */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <div className="glass-card p-5">
                <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-400" /> Alert Controls
                </h3>

                <div className="space-y-4">
                  {/* Sound toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Sound Alerts</span>
                    <button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        soundEnabled ? 'bg-cyan-500' : 'bg-gray-600'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        soundEnabled ? 'left-6' : 'left-0.5'
                      }`} />
                    </button>
                  </div>

                  {/* Vibration toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">
                      Vibration {!isVibrationSupported() && <span className="text-xs text-gray-500">(unsupported)</span>}
                    </span>
                    <button
                      onClick={() => setVibrationOn(!vibrationOn)}
                      disabled={!isVibrationSupported()}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        vibrationOn && isVibrationSupported() ? 'bg-cyan-500' : 'bg-gray-600'
                      } disabled:opacity-40`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        vibrationOn && isVibrationSupported() ? 'left-6' : 'left-0.5'
                      }`} />
                    </button>
                  </div>

                  {/* Voice toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Voice Alerts</span>
                    <button
                      onClick={() => setVoiceOn(!voiceOn)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        voiceOn ? 'bg-cyan-500' : 'bg-gray-600'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        voiceOn ? 'left-6' : 'left-0.5'
                      }`} />
                    </button>
                  </div>

                  {/* Volume */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-300 flex items-center gap-1.5">
                        {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                        Volume
                      </span>
                      <span className="text-xs text-cyan-400">{Math.round(volume * 100)}%</span>
                    </div>
                    <input
                      type="range" min={0} max={1} step={0.05} value={volume}
                      onChange={e => setVolume(parseFloat(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  {/* Sensitivity */}
                  <div>
                    <span className="text-sm text-gray-300 block mb-2">Sensitivity</span>
                    <div className="grid grid-cols-3 gap-2">
                      {(['low', 'medium', 'high'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setSensitivity(s)}
                          className={`py-2 rounded-lg text-xs font-medium border transition-colors capitalize ${
                            sensitivity === s
                              ? 'bg-cyan-500/20 text-cyan-400 border-cyan-400/40'
                              : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Active Alerts */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <div className="glass-card p-5">
                <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-cyan-400" /> Active Alerts
                </h3>

                {!cameraActive && (
                  <p className="text-gray-500 text-sm text-center py-6">Start camera to detect proximity.</p>
                )}

                {cameraActive && alerts.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-6">No objects in proximity range.</p>
                )}

                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {alerts.map((a, i) => (
                    <div key={`${a.objectClass}-${a.position}-${i}`}
                      className={`rounded-xl p-3 border ${LEVEL_STYLES[a.level]}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm capitalize">{a.objectClass}</span>
                        <span className="text-xs font-bold">{a.zone}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs opacity-75">
                        <span>{a.position} · {a.direction}</span>
                        <span>{(a.relativeSize * 100).toFixed(1)}% of frame</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* BLE Sensor Panel */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
              <div className="glass-card p-5">
                <h3 className="font-display text-sm font-semibold mb-3 flex items-center gap-2 text-gray-300">
                  <Activity className="w-4 h-4 text-cyan-400" /> Hardware Sensor
                </h3>

                {!isBLESupported() ? (
                  <p className="text-gray-500 text-xs">Web Bluetooth not supported in this browser.</p>
                ) : bleStatus === 'connected' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-400 text-xs">
                      <div className="w-2 h-2 rounded-full bg-green-400" /> Connected
                    </div>
                    {bleDistance !== null && (
                      <div className="text-lg font-bold text-cyan-400">{bleDistance.toFixed(1)} cm</div>
                    )}
                    <button onClick={handleBLEDisconnect}
                      className="text-xs text-red-400 hover:underline">Disconnect</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-500 text-xs">
                      <div className="w-2 h-2 rounded-full bg-gray-500" /> Disconnected
                    </div>
                    <p className="text-xs text-gray-500">Using camera-based estimation</p>
                    <button onClick={handleBLEConnect}
                      disabled={bleStatus === 'connecting'}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 hover:bg-cyan-400/20 disabled:opacity-40"
                    >
                      {bleStatus === 'connecting' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                      {bleStatus === 'connecting' ? 'Connecting...' : 'Connect Sensor'}
                    </button>
                    <p className="text-xs text-gray-600 mt-1">Requires ESP32 + ToF sensor with Bluetooth</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Safety Disclaimer */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="mt-8 glass-card p-4 border-yellow-500/20">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-yellow-400 font-semibold text-sm mb-1">Safety Notice</h4>
              <p className="text-gray-400 text-xs leading-relaxed">
                Proximity estimates are approximate and based on camera bounding box analysis.
                Do not rely on this system for safety-critical decisions. Always use primary
                mobility aids such as a cane or guide dog.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

