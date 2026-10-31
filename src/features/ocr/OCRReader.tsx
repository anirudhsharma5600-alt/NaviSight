import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Camera, Loader2, Copy, Volume2, VolumeX, RefreshCw, Upload,
  CheckCircle, AlertCircle, Pause, Play, Languages,
} from 'lucide-react'
import Tesseract from 'tesseract.js'
import { speak, stopSpeaking, pauseSpeaking, resumeSpeaking } from '../../services/speechService'
import { setOCRStatus } from '../../services/modelManager'

type OCRStatus = 'idle' | 'camera' | 'processing' | 'done' | 'error'

const LANGUAGES: { code: string; name: string }[] = [
  { code: 'eng', name: 'English' },
  { code: 'hin', name: 'Hindi' },
  { code: 'pan', name: 'Punjabi' },
  { code: 'eng+hin', name: 'English + Hindi' },
]

// ─── Image Preprocessing ───

function preprocessImage(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  options: { grayscale: boolean; highContrast: boolean; sharpen: boolean }
): void {
  if (!options.grayscale && !options.highContrast) return

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]

    // Grayscale conversion
    if (options.grayscale) {
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
      r = g = b = gray
    }

    // Increase contrast
    if (options.highContrast) {
      const factor = 1.5 // contrast factor
      r = Math.min(255, Math.max(0, factor * (r - 128) + 128))
      g = Math.min(255, Math.max(0, factor * (g - 128) + 128))
      b = Math.min(255, Math.max(0, factor * (b - 128) + 128))
    }

    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
  }

  ctx.putImageData(imageData, 0, 0)
}

export default function OCRReader() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [cameraActive, setCameraActive] = useState(false)
  const [recognizedText, setRecognizedText] = useState('')
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<OCRStatus>('idle')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [language, setLanguage] = useState('eng')
  const [preprocessing, setPreprocessing] = useState({ grayscale: true, highContrast: true, sharpen: false })
  const [speechPaused, setSpeechPaused] = useState(false)
  const [confidence, setConfidence] = useState(0)
  const [wordCount, setWordCount] = useState(0)

  const startCamera = async () => {
    setError('')
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera API is not supported in this browser context (requires HTTPS or localhost).')
      setStatus('error')
      return
    }

    // Stop existing stream if any
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    let stream: MediaStream | null = null
    let lastError: any = null

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
    } catch (err: any) {
      lastError = err
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        lastError = null
      } catch (retryErr: any) {
        lastError = retryErr
      }
    }

    if (!stream) {
      const errName = lastError?.name || 'Error'
      setError(
        errName === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera permissions.'
          : 'Could not access camera. Check if another app is using it.'
      )
      setStatus('error')
      return
    }

    streamRef.current = stream
    const video = videoRef.current
    if (video) {
      video.srcObject = stream
      video.muted = true
      video.defaultMuted = true
      video.playsInline = true
      video.autoplay = true
      video.setAttribute('playsinline', 'true')
      video.setAttribute('webkit-playsinline', 'true')

      // Wait for loadedmetadata
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
        setTimeout(resolve, 2000)
      })

      try {
        const playPromise = video.play()
        if (playPromise !== undefined) {
          await playPromise
        }
      } catch (playErr) {
        console.warn('[OCR Camera] play() rejected:', playErr)
      }
    }

    setCameraActive(true)
    setStatus('camera')
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraActive(false)
    if (status === 'camera') setStatus('idle')
  }

  const processOCR = useCallback(async (source: HTMLCanvasElement | File) => {
    setStatus('processing')
    setOCRStatus('loading')
    setProgress(0)
    setError('')

    try {
      // Apply preprocessing for canvas sources
      if (source instanceof HTMLCanvasElement) {
        const ctx = source.getContext('2d')
        if (ctx) {
          preprocessImage(source, ctx, preprocessing)
        }
        // Show preprocessed preview
        const preview = previewCanvasRef.current
        if (preview) {
          preview.width = source.width
          preview.height = source.height
          const pCtx = preview.getContext('2d')
          pCtx?.drawImage(source, 0, 0)
        }
      }

      const result = await Tesseract.recognize(source, language, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100))
          }
        },
      })

      const text = result.data.text.trim()
      const conf = Math.round(result.data.confidence)
      const words = text.split(/\s+/).filter(Boolean).length

      setConfidence(conf)
      setWordCount(words)

      if (text) {
        setRecognizedText(text)
        setStatus('done')
        setOCRStatus('ready')
      } else {
        setRecognizedText('')
        setError('No text found in the image. Try pointing at clearer text with better lighting.')
        setStatus('error')
        setOCRStatus('error')
      }
    } catch {
      setError('OCR processing failed. Please try again.')
      setStatus('error')
      setOCRStatus('error')
    }
  }, [language, preprocessing])

  const captureAndRead = useCallback(async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)
    stopCamera()
    processOCR(canvas)
  }, [processOCR])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    processOCR(file)
  }

  const readAloud = () => {
    if (!recognizedText) return
    setSpeechPaused(false)
    speak(recognizedText)
  }

  const togglePause = () => {
    if (speechPaused) {
      resumeSpeaking()
      setSpeechPaused(false)
    } else {
      pauseSpeaking()
      setSpeechPaused(true)
    }
  }

  const stopReading = () => {
    stopSpeaking()
    setSpeechPaused(false)
  }

  const copyText = () => {
    navigator.clipboard.writeText(recognizedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const reset = () => {
    setStatus('idle')
    setRecognizedText('')
    setProgress(0)
    setError('')
    setConfidence(0)
    setWordCount(0)
    stopCamera()
    stopSpeaking()
    setOCRStatus('idle')
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            Smart <span className="gradient-text">OCR Reader</span>
          </h1>
          <p className="text-gray-400">Capture text from signs, labels, and documents · Powered by Tesseract.js</p>
        </motion.div>

        {/* Settings Bar */}
        <div className="glass-card p-4 mb-6 flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-cyan-400" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-400/40"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-navy-900">
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={preprocessing.grayscale}
              onChange={(e) => setPreprocessing(p => ({ ...p, grayscale: e.target.checked }))}
              className="accent-cyan-400"
            />
            <span className="text-gray-400">Grayscale</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={preprocessing.highContrast}
              onChange={(e) => setPreprocessing(p => ({ ...p, highContrast: e.target.checked }))}
              className="accent-cyan-400"
            />
            <span className="text-gray-400">High Contrast</span>
          </label>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Camera / Capture Area */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="glass-card overflow-hidden">
              <div className="relative aspect-video bg-navy-900">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
                <canvas ref={canvasRef} className="hidden" />
                <canvas
                  ref={previewCanvasRef}
                  className="absolute inset-0 w-full h-full object-cover z-20"
                  style={{ display: status === 'done' || status === 'processing' ? 'block' : 'none' }}
                />

                {!cameraActive && status !== 'processing' && status !== 'done' && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-navy-900/95">
                    <Camera className="w-12 h-12 text-cyan-400/40" />
                    <p className="text-gray-500 text-sm">Start camera or upload an image</p>
                  </div>
                )}

                {status === 'processing' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-navy-900/80">
                    <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
                    <p className="text-cyan-400 text-sm">Reading text... {progress}%</p>
                    <div className="w-48 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-neon-blue rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-gray-500 text-xs">
                      Language: {LANGUAGES.find((l) => l.code === language)?.name}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 flex flex-wrap gap-3">
                {!cameraActive ? (
                  <>
                    <button
                      onClick={startCamera}
                      disabled={status === 'processing'}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm bg-cyan-400/20 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/30 transition-all disabled:opacity-40"
                    >
                      <Camera className="w-4 h-4" /> Start Camera
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={status === 'processing'}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm bg-neon-purple/20 text-neon-purple border border-neon-purple/30 hover:bg-neon-purple/30 transition-all disabled:opacity-40"
                    >
                      <Upload className="w-4 h-4" /> Upload Image
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </>
                ) : (
                  <>
                    <button
                      onClick={captureAndRead}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm bg-green-500/20 text-green-400 border border-green-400/30 hover:bg-green-500/30 transition-all"
                    >
                      <Camera className="w-4 h-4" /> Capture & Read
                    </button>
                    <button
                      onClick={stopCamera}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm border border-gray-600/30 hover:bg-white/5 transition-all text-gray-400"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>

          {/* Results */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
            <div className="glass-card p-6 h-full flex flex-col">
              <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
                {status === 'done' ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <Camera className="w-5 h-5 text-cyan-400" />
                )}
                Recognized Text
              </h3>

              {recognizedText ? (
                <>
                  {/* Stats */}
                  <div className="flex gap-3 mb-3 text-xs">
                    <span className="bg-white/[0.03] px-3 py-1 rounded-full text-gray-400">
                      {wordCount} words
                    </span>
                    <span className="bg-white/[0.03] px-3 py-1 rounded-full text-gray-400">
                      {confidence}% confidence
                    </span>
                    <span className="bg-white/[0.03] px-3 py-1 rounded-full text-gray-400">
                      {LANGUAGES.find((l) => l.code === language)?.name}
                    </span>
                  </div>

                  <div className="flex-1 bg-white/[0.03] rounded-xl p-4 border border-white/5 mb-4 overflow-y-auto max-h-64">
                    <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                      {recognizedText}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={readAloud}
                      className="flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-neon-purple/20 text-neon-purple border border-neon-purple/30 hover:bg-neon-purple/30 transition-all"
                    >
                      <Volume2 className="w-4 h-4" /> Read Aloud
                    </button>
                    <button
                      onClick={togglePause}
                      className="flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                    >
                      {speechPaused ? (
                        <Play className="w-4 h-4 text-green-400" />
                      ) : (
                        <Pause className="w-4 h-4" />
                      )}
                      {speechPaused ? 'Resume' : 'Pause'}
                    </button>
                    <button
                      onClick={stopReading}
                      className="flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                    >
                      <VolumeX className="w-4 h-4" /> Stop
                    </button>
                    <button
                      onClick={copyText}
                      className="flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                    >
                      {copied ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={reset}
                      className="flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                    >
                      <RefreshCw className="w-4 h-4" /> New Scan
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                  {error ? (
                    <div className="text-center">
                      <AlertCircle className="w-8 h-8 text-red-400/50 mx-auto mb-2" />
                      <p className="text-red-400">{error}</p>
                      <button
                        onClick={reset}
                        className="mt-3 text-cyan-400 hover:text-cyan-300 text-xs underline"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <p>Capture an image to extract text</p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
