import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, Eye, Camera, Mic, Volume2, BookOpen, Brain,
  Wifi, WifiOff, CheckCircle, XCircle, Loader2, AlertTriangle,
  Cpu, HardDrive,
} from 'lucide-react'
import { getFullStatus, onStatusChange, type AIServiceStatus } from '../services/modelManager'
import { COCO_CLASSES } from '../services/objectDetection'

type StatusLevel = 'active' | 'ready' | 'available' | 'loading' | 'idle' | 'inactive' | 'disabled' | 'unsupported' | 'not_installed' | 'error'

function StatusIcon({ level }: { level: StatusLevel }) {
  switch (level) {
    case 'active':
    case 'ready':
    case 'available':
      return <CheckCircle className="w-4 h-4 text-green-400" />
    case 'loading':
      return <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
    case 'idle':
    case 'inactive':
    case 'disabled':
      return <div className="w-4 h-4 rounded-full border-2 border-gray-500" />
    case 'unsupported':
    case 'not_installed':
      return <XCircle className="w-4 h-4 text-gray-500" />
    case 'error':
      return <AlertTriangle className="w-4 h-4 text-red-400" />
    default:
      return <div className="w-4 h-4 rounded-full border-2 border-gray-600" />
  }
}

function statusColor(level: StatusLevel): string {
  switch (level) {
    case 'active':
    case 'ready':
    case 'available':
      return 'text-green-400'
    case 'loading':
      return 'text-yellow-400'
    case 'error':
      return 'text-red-400'
    default:
      return 'text-gray-500'
  }
}

interface ServiceCard {
  name: string
  description: string
  status: StatusLevel
  icon: typeof Eye
  details?: string
}

export default function AIStatusDashboard() {
  const [aiStatus, setAiStatus] = useState<AIServiceStatus>(getFullStatus())

  useEffect(() => {
    setAiStatus(getFullStatus())
    return onStatusChange(setAiStatus)
  }, [])

  const services: ServiceCard[] = [
    {
      name: 'Object Detection',
      description: 'COCO-SSD MobileNet v2 — Real-time object recognition',
      status: aiStatus.objectDetection as StatusLevel,
      icon: Eye,
      details: `${COCO_CLASSES.length} classes · TensorFlow.js · Browser-local inference`,
    },
    {
      name: 'OCR Engine',
      description: 'Tesseract.js — Text recognition from images',
      status: aiStatus.ocrEngine as StatusLevel,
      icon: BookOpen,
      details: 'English, Hindi, Punjabi · Image preprocessing · Browser-local',
    },
    {
      name: 'Camera',
      description: 'MediaDevices API — Live video feed',
      status: aiStatus.camera as StatusLevel,
      icon: Camera,
      details: 'Environment-facing preferred · 640×480 for detection · 1280×720 for OCR',
    },
    {
      name: 'Microphone',
      description: 'MediaDevices API — Voice input',
      status: aiStatus.microphone as StatusLevel,
      icon: Mic,
      details: 'Used by voice assistant for speech recognition',
    },
    {
      name: 'Voice Recognition',
      description: 'Web Speech API — Speech to text',
      status: aiStatus.voiceRecognition as StatusLevel,
      icon: Mic,
      details: 'Chrome/Edge supported · Click-to-talk interface',
    },
    {
      name: 'Text to Speech',
      description: 'SpeechSynthesis API — Spoken responses',
      status: aiStatus.textToSpeech as StatusLevel,
      icon: Volume2,
      details: 'Queue-based TTS · Pause/resume · Adjustable rate',
    },
    {
      name: 'Wake Word Detection',
      description: '"Hey Navi" — Hands-free activation',
      status: aiStatus.wakeWord as StatusLevel,
      icon: Mic,
      details: 'Coming soon — requires local audio model',
    },
    {
      name: 'Road Intelligence',
      description: 'Pothole & hazard detection',
      status: aiStatus.roadIntelligence as StatusLevel,
      icon: AlertTriangle,
      details: 'Coming soon — requires specialized model training',
    },
    {
      name: 'Sound Intelligence',
      description: 'Environmental sound classification',
      status: aiStatus.soundIntelligence as StatusLevel,
      icon: Volume2,
      details: 'Coming soon — YAMNet audio classification',
    },
  ]

  const activeCount = services.filter(
    (s) => ['active', 'ready', 'available'].includes(s.status)
  ).length
  const totalCount = services.length

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            AI <span className="gradient-text">Status Dashboard</span>
          </h1>
          <p className="text-gray-400">
            Real-time health monitor for all NaviAble AI services
          </p>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'Services Active',
              value: `${activeCount}/${totalCount}`,
              icon: Activity,
              color: 'text-green-400',
            },
            {
              label: 'AI Model',
              value: aiStatus.objectDetection === 'ready' ? 'Loaded' : aiStatus.objectDetection,
              icon: Brain,
              color: aiStatus.objectDetection === 'ready' ? 'text-green-400' : 'text-yellow-400',
            },
            {
              label: 'Runtime',
              value: 'TensorFlow.js',
              icon: Cpu,
              color: 'text-cyan-400',
            },
            {
              label: 'Processing',
              value: 'Local Only',
              icon: HardDrive,
              color: 'text-neon-purple',
            },
          ].map((card) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-4 text-center"
            >
              <card.icon className={`w-6 h-6 mx-auto mb-2 ${card.color}`} />
              <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
              <p className="text-xs text-gray-500 mt-1">{card.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Privacy Badge */}
        <div className="glass-card p-4 mb-8 bg-green-500/5 border-green-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-400/10 flex items-center justify-center">
              <WifiOff className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-green-400 font-medium text-sm">100% Local Processing</p>
              <p className="text-gray-500 text-xs">
                All AI inference runs in your browser. No data is sent to external servers.
                Your camera feed, voice, and detected objects never leave your device.
              </p>
            </div>
          </div>
        </div>

        {/* Service Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service, i) => (
            <motion.div
              key={service.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-5 hover:border-cyan-400/20 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <service.icon className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-medium text-sm">{service.name}</h3>
                </div>
                <StatusIcon level={service.status} />
              </div>
              <p className="text-gray-500 text-xs mb-3">{service.description}</p>
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    service.status === 'active' || service.status === 'ready' || service.status === 'available'
                      ? 'border-green-400/20 bg-green-400/5 text-green-400'
                      : service.status === 'loading'
                        ? 'border-yellow-400/20 bg-yellow-400/5 text-yellow-400'
                        : service.status === 'error'
                          ? 'border-red-400/20 bg-red-400/5 text-red-400'
                          : 'border-gray-600/20 bg-gray-600/5 text-gray-500'
                  }`}
                >
                  {service.status}
                </span>
              </div>
              {service.details && (
                <p className="text-gray-600 text-xs mt-3 leading-relaxed">
                  {service.details}
                </p>
              )}
            </motion.div>
          ))}
        </div>

        {/* Model Details */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="glass-card p-6 mt-8"
        >
          <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-cyan-400" /> Model Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">
                Object Detection
              </p>
              <p className="text-white font-medium">COCO-SSD (MobileNet v2)</p>
              <p className="text-gray-400 text-xs mt-1">
                {COCO_CLASSES.length} object classes · Pre-trained on MS COCO ·
                Apache 2.0 license
              </p>
              <p className="text-gray-500 text-xs mt-2">
                Source: TensorFlow.js Models (@tensorflow-models/coco-ssd)
              </p>
            </div>
            <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">
                Text Recognition
              </p>
              <p className="text-white font-medium">Tesseract.js v5</p>
              <p className="text-gray-400 text-xs mt-1">
                100+ languages · Image preprocessing · Apache 2.0 license
              </p>
              <p className="text-gray-500 text-xs mt-2">
                Source: tesseract.js (npm)
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
