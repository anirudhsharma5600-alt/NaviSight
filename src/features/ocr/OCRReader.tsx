import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Camera, Loader2, Copy, Volume2, RefreshCw, Upload, CheckCircle, AlertCircle } from 'lucide-react'
import Tesseract from 'tesseract.js'

export default function OCRReader() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [cameraActive, setCameraActive] = useState(false)
  const [recognizedText, setRecognizedText] = useState('')
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<'idle' | 'camera' | 'processing' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const startCamera = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)
      setStatus('camera')
    } catch {
      setError('Could not access camera. Please grant permission.')
      setStatus('error')
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraActive(false)
    if (status === 'camera') setStatus('idle')
  }

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

    setStatus('processing')
    setProgress(0)

    try {
      const result = await Tesseract.recognize(canvas, 'eng', {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100))
          }
        },
      })

      const text = result.data.text.trim()
      if (text) {
        setRecognizedText(text)
        setStatus('done')
      } else {
        setRecognizedText('')
        setError('No text found in the image. Try pointing at clearer text.')
        setStatus('error')
      }
    } catch {
      setError('OCR processing failed. Please try again.')
      setStatus('error')
    }
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setStatus('processing')
    setProgress(0)
    setError('')

    try {
      const result = await Tesseract.recognize(file, 'eng', {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100))
          }
        },
      })

      const text = result.data.text.trim()
      if (text) {
        setRecognizedText(text)
        setStatus('done')
      } else {
        setError('No text found in the image.')
        setStatus('error')
      }
    } catch {
      setError('Failed to process the image.')
      setStatus('error')
    }
  }

  const readAloud = () => {
    if (!recognizedText || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(recognizedText)
    utterance.rate = 0.85
    utterance.lang = 'en-US'
    window.speechSynthesis.speak(utterance)
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
    stopCamera()
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            Smart <span className="gradient-text">OCR Reader</span>
          </h1>
          <p className="text-gray-400">Capture text from signs, labels, and documents</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Camera / Capture Area */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="glass-card overflow-hidden">
              <div className="relative aspect-video bg-navy-900">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  style={{ display: cameraActive ? 'block' : 'none' }}
                />
                <canvas ref={canvasRef} className="hidden" />

                {!cameraActive && status !== 'processing' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <Camera className="w-12 h-12 text-cyan-400/40" />
                    <p className="text-gray-500 text-sm">Start camera or upload an image</p>
                  </div>
                )}

                {status === 'processing' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-navy-900/80">
                    <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
                    <p className="text-cyan-400 text-sm">Reading text... {progress}%</p>
                    <div className="w-48 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-400 to-neon-blue rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 flex flex-wrap gap-3">
                {!cameraActive ? (
                  <>
                    <button onClick={startCamera} className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm bg-cyan-400/20 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/30 transition-all">
                      <Camera className="w-4 h-4" /> Start Camera
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm bg-neon-purple/20 text-neon-purple border border-neon-purple/30 hover:bg-neon-purple/30 transition-all">
                      <Upload className="w-4 h-4" /> Upload Image
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                  </>
                ) : (
                  <>
                    <button onClick={captureAndRead} className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm bg-green-500/20 text-green-400 border border-green-400/30 hover:bg-green-500/30 transition-all">
                      <Camera className="w-4 h-4" /> Capture & Read
                    </button>
                    <button onClick={stopCamera} className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm border border-gray-600/30 hover:bg-white/5 transition-all text-gray-400">
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
                {status === 'done' ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Camera className="w-5 h-5 text-cyan-400" />}
                Recognized Text
              </h3>

              {recognizedText ? (
                <>
                  <div className="flex-1 bg-white/[0.03] rounded-xl p-4 border border-white/5 mb-4 overflow-y-auto max-h-64">
                    <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{recognizedText}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={readAloud} className="flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-neon-purple/20 text-neon-purple border border-neon-purple/30 hover:bg-neon-purple/30 transition-all">
                      <Volume2 className="w-4 h-4" /> Read Aloud
                    </button>
                    <button onClick={copyText} className="flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                      {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button onClick={reset} className="flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
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
                      <button onClick={reset} className="mt-3 text-cyan-400 hover:text-cyan-300 text-xs underline">Try Again</button>
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

