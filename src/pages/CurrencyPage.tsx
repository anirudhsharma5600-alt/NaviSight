import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Camera, CameraOff, Volume2, VolumeX, RotateCcw, ScanText, CheckCircle2,
  AlertCircle, History, ShieldAlert, RefreshCw, Eye,
  Layers, Layers2, Sparkles, AlertTriangle, Cpu
} from 'lucide-react'
import {
  loadCurrencyModel, recognizeBanknote, recognizeMultipleNotes, getCurrencyModelInfo,
  CLASS_METADATA, CURRENCY_CLASSES, CURRENCY_DISCLAIMER,
  type CurrencyRecognitionResult, type MultiNoteRecognitionResult, type CurrencyModelInfo,
} from '../services/currencyDetection'
import {
  startCameraFeed, stopCameraFeed, enumerateVideoCameras,
  queryCameraPermission, type CameraTelemetry, getCameraTelemetry,
} from '../services/cameraManager'
import CameraDiagnostics from '../components/CameraDiagnostics'
import { VoiceManager, type VoiceStatus } from '../services/VoiceAnnouncementManager'

export default function CurrencyPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [telemetry, setTelemetry] = useState<CameraTelemetry>(getCameraTelemetry())
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>(VoiceManager.getStatus())

  // Operating Mode: Single Note (Mode A) vs Multiple Notes (Mode B)
  const [scanMode, setScanMode] = useState<'single' | 'multi'>('single')
  const [modelInfo, setModelInfo] = useState<CurrencyModelInfo>(getCurrencyModelInfo())
  const [isScanning, setIsScanning] = useState(false)
  const [isLiveScanning, setIsLiveScanning] = useState(false)

  // Results
  const [singleResult, setSingleResult] = useState<CurrencyRecognitionResult | null>(null)
  const [multiResult, setMultiResult] = useState<MultiNoteRecognitionResult | null>(null)
  const [isCaptured, setIsCaptured] = useState(false)

  // Voice & Language Controls
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'hi' | 'pa'>('en')
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [speechVolumeLevel, setSpeechVolumeLevel] = useState(VoiceManager.getVolume())

  // Privacy: History only saved if user permits
  const [permitHistory, setPermitHistory] = useState(false)
  const [history, setHistory] = useState<Array<{
    mode: 'single' | 'multi'
    summary: string
    amount: number
    confidence: number
    timestamp: number
  }>>([])

  // Setup Voice Mode & Subscriptions on mount
  useEffect(() => {
    // Mode-based audio control: switch to currency_reading mode to suppress background person shouting
    VoiceManager.setMode('currency_reading')
    const unsubscribeVoice = VoiceManager.subscribe(setVoiceStatus)

    loadCurrencyModel().then(() => {
      setModelInfo(getCurrencyModelInfo())
    })
    queryCameraPermission().then(() => setTelemetry(getCameraTelemetry()))
    enumerateVideoCameras().then(() => setTelemetry(getCameraTelemetry()))

    return () => {
      // Revert to general assistance when leaving currency page
      VoiceManager.setMode('general_assistance')
      unsubscribeVoice()
      stopCameraFeed(videoRef.current)
      VoiceManager.stopAllSpeech()
    }
  }, [])

  // Start Camera Feed
  const handleStartCamera = useCallback(async (deviceId?: string) => {
    if (!videoRef.current) return
    setIsStarting(true)
    setIsCaptured(false)

    // Unlock speech on user interaction
    VoiceManager.unlockVoice()

    const res = await startCameraFeed({
      targetVideoElement: videoRef.current,
      preferredFacingMode: 'environment',
      deviceId,
      onTelemetryChange: setTelemetry,
    })

    setIsStarting(false)
    if (res.success) {
      setCameraActive(true)
    }
  }, [])

  // Stop Camera Feed
  const handleStopCamera = useCallback(() => {
    stopCameraFeed(videoRef.current)
    setCameraActive(false)
    setIsCaptured(false)
    setIsLiveScanning(false)
    setTelemetry(getCameraTelemetry())
  }, [])

  // Switch Camera
  const handleSwitchCamera = useCallback(() => {
    const devices = telemetry.availableCameras
    if (devices.length < 2) return
    const currentId = telemetry.selectedCameraId
    const nextDevice = devices.find((d: { deviceId: string; label: string }) => d.deviceId !== currentId) || devices[0]
    handleStartCamera(nextDevice.deviceId)
  }, [telemetry.availableCameras, telemetry.selectedCameraId, handleStartCamera])

  // Single Note Scan
  const executeSingleScan = useCallback(async (isContinuous = false) => {
    if (!videoRef.current || !cameraActive) return
    if (!isContinuous) setIsScanning(true)

    // Ensure audio unlocked on user gesture
    if (!isContinuous) {
      VoiceManager.unlockVoice()
    }

    const result = await recognizeBanknote(videoRef.current, {
      language: selectedLanguage,
      autoSpeak,
      speechVolume: speechVolumeLevel,
      forceAnnouncement: !isContinuous,
    })

    if (!isContinuous) setIsScanning(false)
    setSingleResult(result)
    if (!isContinuous) setIsCaptured(true)
    setModelInfo(getCurrencyModelInfo())

    if (permitHistory && result.amount > 0 && result.isConfident) {
      setHistory((prev) => [
        {
          mode: 'single',
          summary: `${result.displayName} note`,
          amount: result.amount,
          confidence: result.confidence,
          timestamp: Date.now(),
        },
        ...prev.slice(0, 9),
      ])
    }
  }, [cameraActive, selectedLanguage, autoSpeak, speechVolumeLevel, permitHistory])

  // Multiple Notes Scan
  const executeMultiScan = useCallback(async (isContinuous = false) => {
    if (!videoRef.current || !cameraActive) return
    if (!isContinuous) setIsScanning(true)

    if (!isContinuous) {
      VoiceManager.unlockVoice()
    }

    const result = await recognizeMultipleNotes(videoRef.current, {
      language: selectedLanguage,
      autoSpeak,
      speechVolume: speechVolumeLevel,
      forceAnnouncement: !isContinuous,
    })

    if (!isContinuous) setIsScanning(false)
    setMultiResult(result)
    if (!isContinuous) setIsCaptured(true)
    setModelInfo(getCurrencyModelInfo())

    if (permitHistory && result.totalAmount > 0 && result.isConfident) {
      setHistory((prev) => [
        {
          mode: 'multi',
          summary: result.breakdown || `${result.noteCount} notes`,
          amount: result.totalAmount,
          confidence: result.notes.length > 0 ? Math.round(result.notes.reduce((s, n) => s + n.confidence, 0) / result.notes.length) : 0,
          timestamp: Date.now(),
        },
        ...prev.slice(0, 9),
      ])
    }
  }, [cameraActive, selectedLanguage, autoSpeak, speechVolumeLevel, permitHistory])

  // General Scan handler based on active mode
  const handleScanAction = useCallback(() => {
    if (scanMode === 'single') {
      executeSingleScan(false)
    } else {
      executeMultiScan(false)
    }
  }, [scanMode, executeSingleScan, executeMultiScan])

  // Continuous Live Scan Loop
  useEffect(() => {
    if (!isLiveScanning || !cameraActive) return

    const interval = setInterval(() => {
      if (!isScanning) {
        if (scanMode === 'single') {
          executeSingleScan(true)
        } else {
          executeMultiScan(true)
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isLiveScanning, cameraActive, isScanning, scanMode, executeSingleScan, executeMultiScan])

  // Repeat scan (unfreeze and rescan)
  const handleRepeatScan = useCallback(() => {
    setIsCaptured(false)
    setSingleResult(null)
    setMultiResult(null)
    if (videoRef.current && cameraActive) {
      videoRef.current.play().catch(() => {})
    }
  }, [cameraActive])

  // Re-speak last announcement
  const handleRespeak = useCallback(() => {
    VoiceManager.repeatLast()
  }, [])

  // Stop current speech
  const handleStopSpeaking = useCallback(() => {
    VoiceManager.stopAllSpeech()
  }, [])

  // Update volume
  const handleVolumeChange = useCallback((newVol: number) => {
    setSpeechVolumeLevel(newVol)
    VoiceManager.setVolume(newVol)
  }, [])

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
                Indian Banknote <span className="gradient-text">Reader</span>
              </h1>
              <p className="text-gray-400 text-sm">
                Real MobileNetV3 deep learning recognition for ₹10 to ₹2000 with prioritized speech announcements
              </p>
            </div>

            {/* Mode & Language Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Single vs Multi Note Mode Selector */}
              <div className="flex items-center bg-white/5 border border-white/10 rounded-full p-1 text-xs">
                <button
                  onClick={() => {
                    setScanMode('single')
                    handleRepeatScan()
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-medium transition-all ${
                    scanMode === 'single'
                      ? 'bg-cyan-500 text-black font-semibold shadow-md shadow-cyan-500/20'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" /> Single Note
                </button>
                <button
                  onClick={() => {
                    setScanMode('multi')
                    handleRepeatScan()
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-medium transition-all ${
                    scanMode === 'multi'
                      ? 'bg-purple-500 text-white font-semibold shadow-md shadow-purple-500/20'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Layers2 className="w-3.5 h-3.5" /> Multiple Notes
                </button>
              </div>

              {/* Language Selector */}
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-1 text-xs">
                {(['en', 'hi', 'pa'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => {
                      setSelectedLanguage(lang)
                      VoiceManager.setLanguage(lang)
                    }}
                    className={`px-2.5 py-1 rounded-full font-medium transition-all ${
                      selectedLanguage === lang
                        ? 'bg-white/20 text-white border border-white/20'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {lang === 'en' ? 'English' : lang === 'hi' ? 'हिन्दी' : 'ਪੰਜਾਬੀ'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Currency AI Diagnostics Panel (Requirement 1 & Part 1) */}
        <div className="glass-card p-4 mb-6 border border-cyan-500/20 bg-cyan-950/10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-white/10">
            <span className="font-semibold text-xs text-cyan-300 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Currency AI & Speech Diagnostics Panel
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => VoiceManager.testVoice()}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm hover:scale-105 active:scale-95 transition-all"
                title="Click to unlock SpeechSynthesis on mobile browsers"
              >
                <Volume2 className="w-3.5 h-3.5" /> Enable / Test Voice
              </button>

              <button
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 transition-colors text-[11px]"
              >
                {showDiagnostics ? 'Hide Camera Stats' : 'Camera Telemetry'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-xs">
            <div className="bg-black/40 p-2.5 rounded-lg border border-white/5">
              <span className="text-[10px] text-gray-400 uppercase font-mono block">Model Status</span>
              <span className={`font-semibold capitalize ${modelInfo.status === 'ready' ? 'text-green-400' : 'text-amber-400'}`}>
                {modelInfo.status}
              </span>
            </div>
            <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 col-span-2">
              <span className="text-[10px] text-gray-400 uppercase font-mono block">Architecture</span>
              <span className="font-semibold text-white truncate block">{modelInfo.modelName}</span>
            </div>
            <div className="bg-black/40 p-2.5 rounded-lg border border-white/5">
              <span className="text-[10px] text-gray-400 uppercase font-mono block">Input Dims</span>
              <span className="font-mono text-cyan-300">{modelInfo.inputShape}</span>
            </div>
            <div className="bg-black/40 p-2.5 rounded-lg border border-white/5">
              <span className="text-[10px] text-gray-400 uppercase font-mono block">Inference</span>
              <span className={`font-semibold ${isScanning ? 'text-amber-400 animate-pulse' : 'text-green-400'}`}>
                {isScanning ? 'Inferring...' : modelInfo.lastInferenceMs > 0 ? `${modelInfo.lastInferenceMs}ms` : 'Ready'}
              </span>
            </div>
            <div className="bg-black/40 p-2.5 rounded-lg border border-white/5">
              <span className="text-[10px] text-gray-400 uppercase font-mono block">Predicted Class</span>
              <span className="font-mono font-bold text-cyan-400">{modelInfo.lastPredictedClass}</span>
            </div>
            <div className="bg-black/40 p-2.5 rounded-lg border border-white/5">
              <span className="text-[10px] text-gray-400 uppercase font-mono block">Raw Confidence</span>
              <span className="font-mono font-bold text-purple-400">{modelInfo.lastRawConfidence}%</span>
            </div>
            <div className="bg-black/40 p-2.5 rounded-lg border border-white/5">
              <span className="text-[10px] text-gray-400 uppercase font-mono block">Speech Status</span>
              <span className={`font-semibold truncate block ${voiceStatus.lastError ? 'text-red-400' : voiceStatus.isSpeaking ? 'text-cyan-400' : 'text-green-400'}`}>
                {voiceStatus.lastError ? 'Error' : voiceStatus.isSpeaking ? 'Speaking' : voiceStatus.voiceUnlocked ? 'Unlocked' : 'Locked'}
              </span>
            </div>
          </div>
        </div>

        {/* Camera Diagnostics Panel if toggled */}
        {showDiagnostics && (
          <CameraDiagnostics
            telemetry={telemetry}
            onRetry={() => handleStartCamera()}
            onSwitchCamera={(id) => handleStartCamera(id)}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Camera Viewfinder & Controls */}
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

                {/* Overlays */}
                {cameraActive && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
                    {scanMode === 'single' ? (
                      /* True Banknote Aspect Ratio Guide (~2.25:1) */
                      <div className="relative w-[85%] max-w-[480px] aspect-[2.25/1] border-2 border-cyan-400/80 rounded-xl bg-cyan-500/5 shadow-[0_0_35px_rgba(0,229,255,0.18)] flex flex-col justify-between p-3 transition-all">
                        <div className="flex justify-between items-center text-[10px] uppercase font-mono tracking-wider text-cyan-300">
                          <span>Hold 1 Note Flat</span>
                          <span>₹10 - ₹2000</span>
                        </div>
                        <div className="text-center">
                          <span className="text-[11px] font-medium text-white/90 bg-black/60 px-3 py-1 rounded-full border border-white/10 shadow-sm">
                            Fit full banknote inside frame
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] text-cyan-400/80 font-mono">
                          <span>[Front or Reverse]</span>
                          <span>₹500 · ₹100 · ₹200 · ₹50</span>
                        </div>
                      </div>
                    ) : (
                      /* Multiple Notes Multi-Zone Grid Overlay */
                      <div className="w-full h-full border border-dashed border-purple-400/40 rounded-xl flex items-center justify-center p-4">
                        <div className="grid grid-cols-2 gap-4 w-full h-full">
                          <div className="border border-purple-400/50 rounded-lg bg-purple-500/5 flex flex-col justify-between p-2">
                            <span className="text-[10px] text-purple-300 font-mono">Zone 1 (Left Note)</span>
                            <span className="text-[10px] text-center text-gray-400">Place note here</span>
                            <span className="text-[9px] text-purple-400/60 font-mono text-right">No overlap</span>
                          </div>
                          <div className="border border-purple-400/50 rounded-lg bg-purple-500/5 flex flex-col justify-between p-2">
                            <span className="text-[10px] text-purple-300 font-mono">Zone 2 (Right Note)</span>
                            <span className="text-[10px] text-center text-gray-400">Place note here</span>
                            <span className="text-[9px] text-purple-400/60 font-mono text-right">No overlap</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Standby Placeholder */}
                {!cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0a0e1a]/95 text-center p-6">
                    <div className="w-16 h-16 rounded-full bg-cyan-400/10 flex items-center justify-center mb-1">
                      <ScanText className="w-8 h-8 text-cyan-400/70" />
                    </div>
                    <h3 className="font-semibold text-white">Indian Currency Scanner Ready</h3>
                    <p className="text-gray-400 text-xs max-w-sm">
                      Start your camera to identify Indian banknotes. Place single notes inside the guide, or switch to Multiple Notes mode to calculate totals.
                    </p>
                  </div>
                )}

                {/* Scanning Spinner */}
                {isScanning && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-semibold text-cyan-300">
                      Analyzing Banknote Features with MobileNetV3...
                    </span>
                  </div>
                )}
              </div>

              {/* Viewfinder Controls Bar */}
              <div className="p-4 flex flex-wrap items-center justify-between gap-3 bg-[#0d1222] border-t border-white/5">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={cameraActive ? handleStopCamera : () => handleStartCamera()}
                    disabled={isStarting}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-xs transition-all ${
                      cameraActive
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                        : 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-500/30'
                    }`}
                  >
                    {cameraActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                    {isStarting ? 'Starting...' : cameraActive ? 'Stop Camera' : 'Start Camera'}
                  </button>

                  {cameraActive && telemetry.availableCameras.length > 1 && (
                    <button
                      onClick={handleSwitchCamera}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-colors"
                      title="Switch rear/front camera"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Switch
                    </button>
                  )}

                  {cameraActive && (
                    <button
                      onClick={handleScanAction}
                      disabled={isScanning}
                      className={`flex items-center gap-2 px-5 py-2 rounded-full font-semibold text-xs text-white shadow-lg transition-all active:scale-95 ${
                        scanMode === 'single'
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-600 shadow-cyan-500/25 hover:shadow-cyan-500/40'
                          : 'bg-gradient-to-r from-purple-500 to-indigo-600 shadow-purple-500/25 hover:shadow-purple-500/40'
                      }`}
                    >
                      <ScanText className="w-4 h-4" />
                      {scanMode === 'single' ? 'Scan Note' : 'Scan Currency'}
                    </button>
                  )}

                  {cameraActive && (
                    <button
                      onClick={() => setIsLiveScanning(!isLiveScanning)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs transition-colors ${
                        isLiveScanning
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                          : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10'
                      }`}
                      title="Continuously scan camera frames"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {isLiveScanning ? 'Live Scanning ON' : 'Live Scan'}
                    </button>
                  )}

                  {isCaptured && (
                    <button
                      onClick={handleRepeatScan}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-colors"
                      title="Clear & rescan note"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Scan Again
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Volume Slider */}
                  <div className="flex items-center gap-1.5 text-gray-400 text-[11px] mr-1">
                    <Volume2 className="w-3.5 h-3.5" />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={speechVolumeLevel}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="w-14 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                      title={`Volume: ${Math.round(speechVolumeLevel * 100)}%`}
                    />
                  </div>

                  {(singleResult || multiResult) && (
                    <>
                      <button
                        onClick={handleRespeak}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-400/30 hover:bg-purple-500/30 transition-colors"
                        title="Repeat spoken announcement"
                      >
                        <Volume2 className="w-3.5 h-3.5" /> Repeat Result
                      </button>
                      <button
                        onClick={handleStopSpeaking}
                        className="flex items-center gap-1.5 px-2.5 py-2 rounded-full text-xs bg-white/5 text-gray-400 hover:text-white border border-white/10 transition-colors"
                        title="Stop speaking immediately"
                      >
                        <VolumeX className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div>
            <div className="glass-card p-5 h-full flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-sm mb-4 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                    {scanMode === 'single' ? 'Single Note Result' : 'Multi-Note Calculation'}
                  </span>
                  <span className="text-[11px] font-mono text-gray-400 uppercase bg-white/5 px-2 py-0.5 rounded-full">
                    {scanMode.toUpperCase()} MODE
                  </span>
                </h3>

                {/* MODE A: SINGLE NOTE VIEW */}
                {scanMode === 'single' && (
                  <>
                    {singleResult ? (
                      <div className="space-y-4">
                        {/* Denomination Card */}
                        <div
                          className="p-5 rounded-2xl border text-center transition-all"
                          style={{
                            backgroundColor: singleResult.isConfident
                              ? `${CLASS_METADATA[singleResult.denomination].color}20`
                              : 'rgba(239, 68, 68, 0.1)',
                            borderColor: singleResult.isConfident
                              ? `${CLASS_METADATA[singleResult.denomination].color}60`
                              : 'rgba(239, 68, 68, 0.3)',
                          }}
                        >
                          <div
                            className="text-4xl font-extrabold font-display mb-1"
                            style={{
                              color: singleResult.isConfident
                                ? CLASS_METADATA[singleResult.denomination].color
                                : '#f87171',
                            }}
                          >
                            {singleResult.isConfident ? singleResult.displayName : 'Uncertain'}
                          </div>
                          <div className="text-xs font-medium text-gray-300">
                            {singleResult.isConfident
                              ? `${singleResult.colorName} · ${singleResult.noteTheme}`
                              : 'Banknote not clearly recognised'}
                          </div>
                        </div>

                        {/* Confidence Meter */}
                        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-gray-400">Classification Confidence</span>
                            <span
                              className={`font-mono font-bold ${
                                singleResult.isConfident ? 'text-green-400' : 'text-amber-400'
                              }`}
                            >
                              {singleResult.confidence}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                singleResult.isConfident
                                  ? 'bg-gradient-to-r from-cyan-400 to-green-400'
                                  : 'bg-amber-400'
                              }`}
                              style={{ width: `${Math.max(5, singleResult.confidence)}%` }}
                            />
                          </div>

                          <div className="mt-3 p-2 rounded-lg bg-black/30 border border-white/5">
                            <span className="text-[10px] text-gray-400 uppercase font-mono block mb-1">
                              Spoken Announcement:
                            </span>
                            <p className="text-xs text-cyan-200 italic leading-relaxed">
                              "{singleResult.spokenFeedback}"
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500 text-xs">
                        <ScanText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        No note scanned yet. Align one Indian banknote in the camera viewfinder and click "Scan Note".
                      </div>
                    )}
                  </>
                )}

                {/* MODE B: MULTIPLE NOTES VIEW */}
                {scanMode === 'multi' && (
                  <>
                    {multiResult ? (
                      <div className="space-y-4">
                        {/* Overlap Warning Alert */}
                        {multiResult.overlappingWarning && (
                          <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>Notes appear overlapping. Please place them apart and scan again.</span>
                          </div>
                        )}

                        {/* Total Calculation Card */}
                        <div className="p-5 rounded-2xl border border-purple-500/40 bg-purple-500/15 text-center">
                          <span className="text-[11px] font-mono uppercase text-purple-300 tracking-wider block mb-1">
                            Total Value ({multiResult.noteCount} {multiResult.noteCount === 1 ? 'Note' : 'Notes'})
                          </span>
                          <div className="text-4xl font-extrabold font-display text-white mb-1">
                            ₹{multiResult.totalAmount}
                          </div>
                          <div className="text-xs text-purple-200 font-medium">
                            {multiResult.breakdown || 'No notes detected'}
                          </div>
                        </div>

                        {/* Itemized Detected Notes List */}
                        {multiResult.notes.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                              Detected Notes ({multiResult.notes.length}):
                            </span>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {multiResult.notes.map((note) => (
                                <div
                                  key={note.id}
                                  className="flex items-center justify-between text-xs bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="w-3 h-3 rounded-md"
                                      style={{ backgroundColor: note.color }}
                                    />
                                    <strong className="text-white text-sm">{note.displayName}</strong>
                                    <span className="text-[10px] text-gray-400">({note.regionLabel})</span>
                                  </div>
                                  <span className="font-mono text-cyan-400 text-xs">
                                    {note.confidence}% conf
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                          <span className="text-[10px] text-gray-400 uppercase font-mono block mb-1">
                            Spoken Announcement:
                          </span>
                          <p className="text-xs text-purple-200 italic leading-relaxed">
                            "{multiResult.spokenFeedback}"
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500 text-xs">
                        <Layers2 className="w-8 h-8 mx-auto mb-2 opacity-40 text-purple-400" />
                        Place multiple banknotes on a surface side-by-side without overlapping, then click "Scan Currency".
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* History & Privacy Toggle */}
              <div className="border-t border-white/10 pt-4 mt-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-gray-400 flex items-center gap-1.5 font-semibold">
                    <History className="w-3.5 h-3.5" /> Recent Scans
                  </span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-400 hover:text-white">
                    <input
                      type="checkbox"
                      checked={permitHistory}
                      onChange={(e) => setPermitHistory(e.target.checked)}
                      className="rounded accent-cyan-400 w-3.5 h-3.5"
                    />
                    <span>Save History</span>
                  </label>
                </div>

                {permitHistory ? (
                  history.length > 0 ? (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {history.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs bg-white/[0.02] border border-white/5 rounded-lg px-2.5 py-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{item.summary}</span>
                            <span className="text-cyan-400 font-mono text-[11px]">₹{item.amount}</span>
                          </div>
                          <span className="text-gray-500 text-[10px]">
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-500 italic">No saved scans in this session.</p>
                  )
                ) : (
                  <p className="text-[11px] text-gray-500 italic">
                    Scan history is disabled to protect privacy. Check "Save History" above to enable.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Supported Denominations Reference Grid */}
        <div className="mb-8">
          <h2 className="font-semibold text-base mb-3 flex items-center gap-2 text-white">
            <Eye className="w-4 h-4 text-cyan-400" /> Supported Indian Rupee Denominations (Mahatma Gandhi New Series)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            {CURRENCY_CLASSES.map((cls) => {
              const meta = CLASS_METADATA[cls]
              return (
                <div
                  key={cls}
                  className="glass-card p-3 text-center border-white/5 hover:border-cyan-400/30 transition-all"
                >
                  <div
                    className="w-12 h-7 rounded-md mx-auto mb-2 flex items-center justify-center font-bold text-xs text-white shadow-md"
                    style={{ backgroundColor: meta.color }}
                  >
                    {meta.displayName}
                  </div>
                  <strong className="text-xs text-white block">{meta.displayName}</strong>
                  <span className="text-[10px] text-gray-400 block truncate">{meta.colorName}</span>
                  <span className="text-[9px] text-cyan-400/80 block truncate mt-0.5">{meta.motif}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="glass-card p-4 border-amber-500/20 bg-amber-500/5 text-xs text-amber-300 flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">{CURRENCY_DISCLAIMER}</p>
        </div>
      </div>
    </div>
  )
}
