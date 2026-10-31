import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Camera as CameraIcon, CameraOff, AlertCircle } from 'lucide-react'

type CameraState = 'idle' | 'requesting' | 'active' | 'denied' | 'error'

interface CameraProps {
  onStreamReady: (video: HTMLVideoElement) => void
  onStreamStop: () => void
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}

export default function Camera({ onStreamReady, onStreamStop, videoRef, canvasRef }: CameraProps) {
  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const streamRef = useRef<MediaStream | null>(null)

  const startCamera = useCallback(async () => {
    setCameraState('requesting')
    setErrorMsg('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
          setCameraState('active')
          if (videoRef.current) onStreamReady(videoRef.current)
        }
      }
    } catch (err) {
      const error = err as Error
      if (error.name === 'NotAllowedError') {
        setCameraState('denied')
        setErrorMsg('Camera access denied. Please allow camera permissions.')
      } else {
        setCameraState('error')
        setErrorMsg(error.message || 'Failed to access camera.')
      }
    }
  }, [onStreamReady, videoRef])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraState('idle')
    onStreamStop()
  }, [onStreamStop, videoRef])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      {/* Camera viewport */}
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-navy-800/60 border border-white/10">
        {cameraState === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
            <motion.div
              animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400/20 to-neon-purple/20 flex items-center justify-center"
            >
              <CameraIcon className="w-10 h-10 text-cyan-400/60" />
            </motion.div>
            <p className="text-white/50 text-sm font-medium">Camera is off</p>
          </div>
        )}

        {cameraState === 'requesting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              className="w-12 h-12 rounded-full border-2 border-transparent border-t-cyan-400 border-r-cyan-400"
            />
            <p className="text-cyan-400 text-sm font-medium">Requesting camera access...</p>
          </div>
        )}

        {(cameraState === 'denied' || cameraState === 'error') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 px-6">
            <AlertCircle className="w-12 h-12 text-red-400" />
            <p className="text-red-300 text-sm text-center font-medium">{errorMsg}</p>
          </div>
        )}

        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          style={{ display: cameraState === 'active' ? 'block' : 'none' }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ display: cameraState === 'active' ? 'block' : 'none' }}
        />

        {/* Live badge */}
        {cameraState === 'active' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/80 backdrop-blur-sm"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-white text-xs font-bold tracking-wider">LIVE</span>
          </motion.div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        {cameraState !== 'active' ? (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={startCamera}
            disabled={cameraState === 'requesting'}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-neon-blue font-semibold text-navy-900 transition-all hover:shadow-lg hover:shadow-cyan-400/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CameraIcon className="w-5 h-5" />
            Start Camera
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={stopCamera}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 font-semibold text-white transition-all hover:shadow-lg hover:shadow-red-500/25"
          >
            <CameraOff className="w-5 h-5" />
            Stop Camera
          </motion.button>
        )}
      </div>
    </div>
  )
}
