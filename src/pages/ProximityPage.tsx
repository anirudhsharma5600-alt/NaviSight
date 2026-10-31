import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, CameraOff, Volume2, VolumeX, AlertCircle, Eye, Loader2,
  RefreshCw, SwitchCamera, Activity, Info, Shield, Radio, Volume1, Play
} from 'lucide-react'
import {
  loadModel, detectObjects, isModelLoaded, getModelStatus, onModelStatusChange,
  type Detection, type ModelStatus,
} from '../services/objectDetection'
import {
  initProximityEngine, processDetectionsForProximity,
  setAlertsEnabled, setVibrationEnabled, setAlertVolume, playTestBeep,
  getProximityConfig, updateProximityConfig, unlockAudioContext,
  getProximityState, connectBLESensor, disconnectBLESensor, isBLESensorConnected,
  getSensorDistance, isBLESupported, isVibrationSupported,
  type ProximityAlert, type AlertLevel, type ProximityState,
} from '../services/proximityEngine'
import {
  startCameraFeed, stopCameraFeed, enumerateVideoCameras, queryCameraPermission,
  type CameraTelemetry, getCameraTelemetry,
} from '../services/cameraManager'
import CameraDiagnostics from '../components/CameraDiagnostics'
import { speak } from '../services/speechService'

const ZONE_COLORS: Record<string, string> = {
  NEAR: '#ef4444',
  MEDIUM: '#f59e0b',
  FAR: '#22c55e',
}

const STATE_BADGES: Record<
  ProximityState,
  { label: string; bg: string; border: string; text: string; icon: string }
> = {
  CLEAR: {
    label: 'CLEAR — Path Open',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
    icon: '🟢',
  },
  PERSON_DETECTED: {
    label: 'PERSON DETECTED',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    icon: '🟡',
  },
  PERSON_APPROACHING: {
    label: 'PERSON APPROACHING',
    bg: 'bg-orange-500/15',
    border: 'border-orange-500/40',
    text: 'text-orange-400',
    icon: '⚠️',
  },
  PERSON_APPEARS_CLOSE: {
    label: 'CRITICAL: PERSON VERY CLOSE',
    bg: 'bg-red-500/20',
    border: 'border-red-500/50',
    text: 'text-red-400',
    icon: '🚨',
  },
  UNKNOWN: {
    label: 'STANDBY',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/20',
    text: 'text-gray-400',
    icon: '⚪',
  },
}

export default function ProximityPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const [cameraActive, setCameraActive] = useState(false)
  const [isStartingCamera, setIsStartingCamera] = useState(false)
  const [telemetry, setTelemetry] = useState<CameraTelemetry>(getCameraTelemetry())
  const [showDiagnostics, setShowDiagnostics] = useState(false)

  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle')
  const [alerts, setAlerts] = useState<ProximityAlert[]>([])
  const [proximityState, setProximityState] = useState<ProximityState>('CLEAR')

  // Proximity Alert Controls
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [vibrationOn, setVibrationOn] = useState(true)
  const [voiceOn, setVoiceOn] = useState(true)
  const [volume, setVolume] = useState(0.7)
  const [sensitivity, setSensitivity] = useState<'low' | 'medium' | 'high'>('medium')

  // Hardware BLE state
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
    queryCameraPermission().then(() => setTelemetry(getCameraTelemetry()))
    enumerateVideoCameras().then(() => setTelemetry(getCameraTelemetry()))
  }, [])

  // Sync controls to engine
  useEffect(() => {
    setAlertsEnabled(soundEnabled)
    setVibrationEnabled(vibrationOn)
    setAlertVolume(volume)
    updateProximityConfig({ sensitivity, voiceEnabled: voiceOn })
  }, [soundEnabled, vibrationOn, volume, sensitivity, voiceOn])

  // Camera start using cameraManager
  const startCamera = useCallback(async (deviceId?: string) => {
    if (!videoRef.current) return
    setIsStartingCamera(true)
    unlockAudioContext() // Unlock Web Audio API on explicit user tap

    const res = await startCameraFeed({
      targetVideoElement: videoRef.current,
      preferredFacingMode: 'environment',
      deviceId,
      onTelemetryChange: setTelemetry,
    })

    setIsStartingCamera(false)
    if (res.success) {
      setCameraActive(true)
    }
  }, [])

  const stopCamera = useCallback(() => {
    stopCameraFeed(videoRef.current)
    setCameraActive(false)
    setAlerts([])
    setProximityState('CLEAR')
    setTelemetry(getCameraTelemetry())

    const ctx = canvasRef.current?.getContext('2d')
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }
  }, [])

  // Draw visual proximity overlay on canvas
  const drawProximityOverlay = useCallback(
    (detections: Detection[], proximityAlerts: ProximityAlert[]) => {
      const canvas = canvasRef.current
      const video = videoRef.current
      if (!canvas || !video || video.videoWidth === 0) return

      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      detections.forEach((d) => {
        const isPerson = d.class.toLowerCase() === 'person'
        const alert = proximityAlerts.find(
          (a) => a.objectClass === d.class && a.position === d.position
        )
        const zone = alert?.zone || 'FAR'
        const color = isPerson
          ? zone === 'NEAR'
            ? '#ef4444'
            : zone === 'MEDIUM'
            ? '#f97316'
            : '#00e5ff'
          : ZONE_COLORS[zone] || '#22c55e'

        const [x, y, w, h] = d.bbox

        // Highlight box
        ctx.strokeStyle = color
        ctx.lineWidth = isPerson && zone === 'NEAR' ? 4 : zone === 'NEAR' ? 3 : 2
        ctx.strokeRect(x, y, w, h)

        // Pulsing corners for close person
        if (isPerson && zone === 'NEAR') {
          const corner = Math.min(w, h) * 0.2
          ctx.lineWidth = 5
          ctx.strokeStyle = '#ef4444'
          ctx.beginPath()
          ctx.moveTo(x, y + corner); ctx.lineTo(x, y); ctx.lineTo(x + corner, y)
          ctx.moveTo(x + w - corner, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + corner)
          ctx.moveTo(x, y + h - corner); ctx.lineTo(x, y + h); ctx.lineTo(x + corner, y + h)
          ctx.moveTo(x + w - corner, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - corner)
          ctx.stroke()
        }

        // Label pill
        const labelText = `${d.class.toUpperCase()} · ${alert?.closenessScore || 0}% close [${d.position}]`
        ctx.font = 'bold 12px Inter, system-ui, sans-serif'
        const textW = ctx.measureText(labelText).width
        const ly = y > 26 ? y - 26 : y + 4

        ctx.fillStyle = color
        ctx.globalAlpha = 0.9
        ctx.beginPath()
        ctx.roundRect(x, ly, textW + 12, 20, 4)
        ctx.fill()
        ctx.globalAlpha = 1.0

        ctx.fillStyle = '#0a0e1a'
        ctx.textBaseline = 'top'
        ctx.fillText(labelText, x + 6, ly + 4)
      })
    },
    []
  )

  // Real-time detection & proximity loop
  const detectLoop = useCallback(async () => {
    const video = videoRef.current
    if (!cameraActive || !video || video.readyState < 2 || video.videoWidth === 0) {
      animationRef.current = requestAnimationFrame(detectLoop)
      return
    }

    try {
      const detections = await detectObjects(video)
      const proximityAlerts = processDetectionsForProximity(
        detections,
        video.videoWidth,
        video.videoHeight
      )

      setAlerts(proximityAlerts)
      setProximityState(getProximityState())
      drawProximityOverlay(detections, proximityAlerts)
    } catch {
      /* frame skip */
    }

    animationRef.current = requestAnimationFrame(detectLoop)
  }, [cameraActive, drawProximityOverlay])

  useEffect(() => {
    if (cameraActive && modelStatus === 'ready') {
      animationRef.current = requestAnimationFrame(detectLoop)
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [cameraActive, modelStatus, detectLoop])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCameraFeed(videoRef.current)
    }
  }, [])

  const currentBadge = STATE_BADGES[proximityState]

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
                Person & Obstacle <span className="gradient-text">Proximity Engine</span>
              </h1>
              <p className="text-gray-400 text-sm">
                Visual proximity estimation with Web Audio alarm beeps & optional ToF hardware
              </p>
            </div>

            {/* State Machine Badge */}
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-full border ${currentBadge.bg} ${currentBadge.border} ${currentBadge.text} font-mono text-xs font-bold tracking-wide shadow-lg`}
            >
              <span>{currentBadge.icon}</span>
              <span>{currentBadge.label}</span>
            </div>
          </div>
        </motion.div>

        {/* Status & Diagnostics Strip */}
        <div className="glass-card p-4 mb-6 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                modelStatus === 'ready'
                  ? 'bg-green-400'
                  : modelStatus === 'loading'
                  ? 'bg-yellow-400 animate-pulse'
                  : 'bg-red-400'
              }`}
            />
            <span className="text-gray-300">
              AI Vision Model: <strong className="text-white">{modelStatus.toUpperCase()}</strong>
            </span>
            <span className="text-gray-600">|</span>
            <span className="text-cyan-400 font-mono">
              Alerts: {soundEnabled ? 'AUDIO ON' : 'MUTED'}
            </span>
            <span className="text-gray-600">|</span>
            <span className="text-purple-400 font-mono">
              State: {proximityState}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 transition-colors"
            >
              {showDiagnostics ? 'Hide Camera Diagnostics' : 'Camera Diagnostics'}
            </button>
            <button
              onClick={() => {
                unlockAudioContext()
                playTestBeep('CRITICAL')
              }}
              className="flex items-center gap-1.5 px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 rounded-lg font-semibold transition-all"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Test Beep
            </button>
          </div>
        </div>

        {/* Diagnostics View */}
        {showDiagnostics && (
          <CameraDiagnostics
            telemetry={telemetry}
            onRetry={() => startCamera()}
            onSwitchCamera={(id) => startCamera(id)}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Main Viewfinder */}
          <div className="lg:col-span-2">
            <div className="glass-card overflow-hidden">
              <div className="relative bg-[#070b14] aspect-video rounded-xl overflow-hidden flex items-center justify-center">
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

                {/* Standby Placeholder */}
                {!cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0a0e1a]/95 text-center p-6">
                    <div className="w-16 h-16 rounded-full bg-cyan-400/10 flex items-center justify-center mb-1">
                      <Eye className="w-8 h-8 text-cyan-400/60" />
                    </div>
                    <h3 className="font-semibold text-white">Camera Standby</h3>
                    <p className="text-gray-400 text-xs max-w-sm">
                      Start the camera to activate real-time monocular proximity tracking and audio warnings.
                    </p>
                  </div>
                )}

                {/* Critical Alert Flasher */}
                {proximityState === 'PERSON_APPEARS_CLOSE' && cameraActive && (
                  <div className="absolute inset-0 border-4 border-red-500 pointer-events-none animate-pulse bg-red-500/10" />
                )}
              </div>

              {/* Viewfinder Bottom Toolbar */}
              <div className="p-4 flex flex-wrap items-center justify-between gap-3 bg-[#0d1222]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={cameraActive ? stopCamera : () => startCamera()}
                    disabled={isStartingCamera}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-xs transition-all ${
                      cameraActive
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                        : 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-500/30'
                    }`}
                  >
                    {cameraActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                    {isStartingCamera ? 'Connecting...' : cameraActive ? 'Stop Camera' : 'Start Camera'}
                  </button>

                  <button
                    onClick={() => {
                      unlockAudioContext()
                      setSoundEnabled(!soundEnabled)
                    }}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold border transition-all ${
                      soundEnabled
                        ? 'bg-green-500/20 text-green-300 border-green-500/40'
                        : 'bg-white/5 text-gray-400 border-white/10'
                    }`}
                  >
                    {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    {soundEnabled ? 'Alert Beeps ON' : 'Alerts Muted'}
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Volume1 className="w-4 h-4 text-cyan-400" />
                  <span className="text-[11px]">Vol:</span>
                  <input
                    type="range"
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-20 accent-cyan-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Configuration & Alerts List */}
          <div className="space-y-4">
            {/* Sensitivity & Controls */}
            <div className="glass-card p-5">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-white">
                <Shield className="w-4 h-4 text-cyan-400" /> Alert Sensitivity
              </h3>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {(['low', 'medium', 'high'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setSensitivity(lvl)}
                    className={`py-2 rounded-xl text-xs font-semibold capitalize border transition-all ${
                      sensitivity === lvl
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-md'
                        : 'bg-white/[0.02] border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              <div className="space-y-2 text-xs border-t border-white/10 pt-3">
                <label className="flex items-center justify-between text-gray-300 cursor-pointer">
                  <span>Voice Announcements</span>
                  <input
                    type="checkbox"
                    checked={voiceOn}
                    onChange={(e) => setVoiceOn(e.target.checked)}
                    className="accent-cyan-400 rounded"
                  />
                </label>

                <label className="flex items-center justify-between text-gray-300 cursor-pointer">
                  <span>Haptic Vibration</span>
                  <input
                    type="checkbox"
                    checked={vibrationOn}
                    onChange={(e) => setVibrationOn(e.target.checked)}
                    className="accent-cyan-400 rounded"
                  />
                </label>
              </div>
            </div>

            {/* Live Detected Targets */}
            <div className="glass-card p-5">
              <h3 className="font-semibold text-sm mb-3 flex items-center justify-between text-white">
                <span className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" /> Tracked Targets
                </span>
                <span className="font-mono text-xs text-cyan-400">{alerts.length} in frame</span>
              </h3>

              {alerts.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-6">
                  {cameraActive ? 'No obstacles detected in view.' : 'Start camera to begin monitoring.'}
                </p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {alerts.map((a, i) => (
                    <div
                      key={i}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                        a.level === 'CRITICAL'
                          ? 'bg-red-500/10 border-red-500/30 text-red-300'
                          : a.level === 'DANGER'
                          ? 'bg-orange-500/10 border-orange-500/30 text-orange-300'
                          : 'bg-white/[0.02] border-white/5 text-gray-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="capitalize text-white">{a.objectClass}</strong>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-white/10">
                            {a.position}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 block mt-0.5">
                          {a.direction} · {a.zone} zone
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-bold text-sm block">
                          {a.closenessScore}%
                        </span>
                        <span className="text-[9px] uppercase tracking-wider text-gray-400">
                          Closeness
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Safety Disclaimer */}
        <div className="glass-card p-4 border-amber-500/20 bg-amber-500/5 text-xs text-amber-300 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Safety Advisory: Camera-based visual proximity calculations are approximate monocular estimates based on bounding box proportions. They do not represent calibrated metric distances (metres/centimetres). Lack of an audible warning does not verify a completely unobstructed environment.
          </p>
        </div>
      </div>
    </div>
  )
}
