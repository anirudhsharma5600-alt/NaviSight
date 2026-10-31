import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, CameraOff, Volume2, RotateCcw, ScanText, CheckCircle2,
  AlertCircle, History, Info, ShieldAlert, Sliders, RefreshCw, Eye
} from 'lucide-react'
import {
  loadCurrencyModel, recognizeBanknote, getCurrencyModelInfo,
  CLASS_METADATA, CURRENCY_CLASSES, CURRENCY_DISCLAIMER,
  type CurrencyRecognitionResult, type CurrencyModelInfo,
} from '../services/currencyDetection'
import {
  startCameraFeed, stopCameraFeed, enumerateVideoCameras,
  queryCameraPermission, type CameraTelemetry, getCameraTelemetry,
} from '../services/cameraManager'
import CameraDiagnostics from '../components/CameraDiagnostics'
import { speak } from '../services/speechService'

export default function CurrencyPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [telemetry, setTelemetry] = useState<CameraTelemetry>(getCameraTelemetry())
  const [showDiagnostics, setShowDiagnostics] = useState(false)

  // Recognition state
  const [modelInfo, setModelInfo] = useState<CurrencyModelInfo>(getCurrencyModelInfo())
  const [isScanning, setIsScanning] = useState(false)
  const [latestResult, setLatestResult] = useState<CurrencyRecognitionResult | null>(null)
  const [history, setHistory] = useState<CurrencyRecognitionResult[]>([])
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'hi' | 'pa'>('en')
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [isCaptured, setIsCaptured] = useState(false)

  // Load currency model on mount
  useEffect(() => {
    loadCurrencyModel().then(() => {
      setModelInfo(getCurrencyModelInfo())
    })
    queryCameraPermission().then(() => setTelemetry(getCameraTelemetry()))
    enumerateVideoCameras().then(() => setTelemetry(getCameraTelemetry()))
  }, [])

  // Start Camera Feed
  const handleStartCamera = useCallback(async (deviceId?: string) => {
    if (!videoRef.current) return
    setIsStarting(true)
    setIsCaptured(false)

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
    setTelemetry(getCameraTelemetry())
  }, [])

  // Capture & Scan Note
  const handleScanNote = useCallback(async () => {
    if (!videoRef.current || !cameraActive || isScanning) return
    setIsScanning(true)

    const result = await recognizeBanknote(videoRef.current, {
      language: selectedLanguage,
      autoSpeak,
    })

    setIsScanning(false)
    setLatestResult(result)
    setIsCaptured(true)
    setModelInfo(getCurrencyModelInfo())

    if (result.amount > 0) {
      setHistory((prev) => [result, ...prev.slice(0, 9)])
    }
  }, [cameraActive, isScanning, selectedLanguage, autoSpeak])

  // Repeat scan (unfreeze and rescan)
  const handleRepeatScan = useCallback(() => {
    setIsCaptured(false)
    setLatestResult(null)
    if (videoRef.current && cameraActive) {
      videoRef.current.play().catch(() => {})
    }
  }, [cameraActive])

  // Re-speak last result
  const handleRespeak = useCallback(() => {
    if (!latestResult) return
    const langCode = selectedLanguage === 'hi' ? 'hi-IN' : 'en-US'
    speak(latestResult.spokenFeedback, langCode)
  }, [latestResult, selectedLanguage])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCameraFeed(videoRef.current)
    }
  }, [])

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
                Indian Currency <span className="gradient-text">Reader</span>
              </h1>
              <p className="text-gray-400 text-sm">
                Optical note inspection & ONNX MobileNetV3 deep learning recognition
              </p>
            </div>

            {/* Language Selector */}
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full p-1 text-xs">
              <span className="text-gray-400 px-2 text-[11px]">Speech:</span>
              {(['en', 'hi', 'pa'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`px-3 py-1 rounded-full font-medium transition-all ${
                    selectedLanguage === lang
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/30'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {lang === 'en' ? 'English' : lang === 'hi' ? 'हिन्दी' : 'ਪੰਜਾਬੀ'}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Model Telemetry Banner */}
        <div className="glass-card p-4 mb-6 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                modelInfo.status === 'ready'
                  ? 'bg-green-400'
                  : modelInfo.status === 'loading'
                  ? 'bg-yellow-400 animate-pulse'
                  : 'bg-red-400'
              }`}
            />
            <span className="text-gray-300 font-medium">
              Model: <span className="text-white">{modelInfo.modelName}</span>
            </span>
            <span className="text-gray-500">|</span>
            <span className="text-cyan-400 font-mono">
              Provider: {modelInfo.executionProvider.toUpperCase()}
            </span>
            {modelInfo.lastInferenceMs > 0 && (
              <>
                <span className="text-gray-500">|</span>
                <span className="text-purple-400 font-mono">
                  Latency: {modelInfo.lastInferenceMs}ms
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 transition-colors"
            >
              {showDiagnostics ? 'Hide Diagnostics' : 'Camera Telemetry'}
            </button>
          </div>
        </div>

        {/* Diagnostics Panel if toggled */}
        {showDiagnostics && (
          <CameraDiagnostics
            telemetry={telemetry}
            onRetry={() => handleStartCamera()}
            onSwitchCamera={(id) => handleStartCamera(id)}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Camera Viewfinder */}
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

                {/* Banknote Alignment Guide Overlay */}
                {cameraActive && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                    <div className="relative w-4/5 h-3/5 border-2 border-cyan-400/60 rounded-xl bg-cyan-500/5 shadow-[0_0_30px_rgba(0,229,255,0.15)] flex flex-col justify-between p-3">
                      <div className="flex justify-between items-center text-[10px] uppercase font-mono tracking-wider text-cyan-300/80">
                        <span>Align Note Here</span>
                        <span>RBI Standard</span>
                      </div>
                      <div className="text-center">
                        <span className="text-[11px] font-medium text-white/70 bg-black/40 px-3 py-1 rounded-full">
                          Hold note flat & steady
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-cyan-400/60 font-mono">
                        <span>[Front / Back]</span>
                        <span>₹10 - ₹2000</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Standby Placeholder */}
                {!cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0a0e1a]/95 text-center p-6">
                    <div className="w-16 h-16 rounded-full bg-cyan-400/10 flex items-center justify-center mb-1">
                      <ScanText className="w-8 h-8 text-cyan-400/60" />
                    </div>
                    <h3 className="font-semibold text-white">Banknote Scanner Ready</h3>
                    <p className="text-gray-400 text-xs max-w-sm">
                      Start the camera to position your banknote inside the alignment guide for
                      deep learning denomination identification.
                    </p>
                  </div>
                )}

                {/* Scanning Spinner */}
                {isScanning && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-semibold text-cyan-300">
                      Analyzing Banknote Features...
                    </span>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="p-4 flex flex-wrap items-center justify-between gap-3 bg-[#0d1222]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={cameraActive ? handleStopCamera : () => handleStartCamera()}
                    disabled={isStarting}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-xs transition-all ${
                      cameraActive
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                        : 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-500/30'
                    }`}
                  >
                    {cameraActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                    {isStarting ? 'Starting...' : cameraActive ? 'Stop Camera' : 'Start Camera'}
                  </button>

                  {cameraActive && (
                    <button
                      onClick={handleScanNote}
                      disabled={isScanning}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-xs bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-105 active:scale-95 transition-all"
                    >
                      <ScanText className="w-4 h-4" />
                      Scan Note
                    </button>
                  )}

                  {isCaptured && (
                    <button
                      onClick={handleRepeatScan}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-colors"
                      title="Clear & rescan note"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Repeat Scan
                    </button>
                  )}
                </div>

                {latestResult && (
                  <button
                    onClick={handleRespeak}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-400/30 hover:bg-purple-500/30 transition-colors"
                  >
                    <Volume2 className="w-4 h-4" />
                    Speak Amount
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div>
            <div className="glass-card p-5 h-full flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  Recognition Result
                </h3>

                {latestResult ? (
                  <div className="space-y-4">
                    {/* Denomination Card */}
                    <div
                      className="p-5 rounded-2xl border text-center transition-all"
                      style={{
                        backgroundColor: `${CLASS_METADATA[latestResult.denomination].color}20`,
                        borderColor: `${CLASS_METADATA[latestResult.denomination].color}60`,
                      }}
                    >
                      <div
                        className="text-4xl font-extrabold font-display mb-1"
                        style={{ color: CLASS_METADATA[latestResult.denomination].color }}
                      >
                        {latestResult.displayName}
                      </div>
                      <div className="text-xs font-medium text-gray-300">
                        {latestResult.colorName} · {latestResult.noteTheme}
                      </div>
                    </div>

                    {/* Confidence Meter */}
                    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-gray-400">Model Confidence</span>
                        <span
                          className={`font-mono font-bold ${
                            latestResult.isConfident ? 'text-green-400' : 'text-amber-400'
                          }`}
                        >
                          {latestResult.confidence}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            latestResult.isConfident
                              ? 'bg-gradient-to-r from-cyan-400 to-green-400'
                              : 'bg-amber-400'
                          }`}
                          style={{ width: `${Math.max(5, latestResult.confidence)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-2 italic">
                        "{latestResult.spokenFeedback}"
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500 text-xs">
                    <ScanText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No note scanned yet. Align a banknote inside the camera viewfinder and click "Scan Note".
                  </div>
                )}
              </div>

              {/* Recent Scan History */}
              {history.length > 0 && (
                <div className="border-t border-white/10 pt-4 mt-4">
                  <h4 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" /> Recent Scans
                  </h4>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {history.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs bg-white/[0.02] border border-white/5 rounded-lg px-2.5 py-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: CLASS_METADATA[item.denomination].color }}
                          />
                          <strong className="text-white">{item.displayName}</strong>
                        </div>
                        <span className="font-mono text-cyan-400 text-[11px]">
                          {item.confidence}% ({new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Supported Denominations Reference Grid */}
        <div className="mb-8">
          <h2 className="font-semibold text-base mb-3 flex items-center gap-2 text-white">
            <Eye className="w-4 h-4 text-cyan-400" /> Supported Indian Rupee Denominations
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
