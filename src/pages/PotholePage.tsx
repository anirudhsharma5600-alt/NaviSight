import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, Info, Eye, Activity, Shield } from 'lucide-react'
import {
  getPotholeModelInfo, loadPotholeModel, getPotholeModelStatus,
  POTHOLE_DISCLAIMER, SUPPORTED_HAZARDS,
  type PotholeModelStatus,
} from '../services/potholeDetection'

const HAZARD_CARDS = [
  { type: 'Pothole', desc: 'Depression or hole in road surface', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20' },
  { type: 'Longitudinal Crack', desc: 'Linear cracks along road direction', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20' },
  { type: 'Transverse Crack', desc: 'Cracks perpendicular to road', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
  { type: 'Alligator Crack', desc: 'Network of interconnected cracks', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20' },
]

export default function PotholePage() {
  const [modelStatus, setModelStatus] = useState<PotholeModelStatus>('not_trained')
  const [modelInfo, setModelInfo] = useState(getPotholeModelInfo())

  useEffect(() => {
    loadPotholeModel().then(() => {
      setModelStatus(getPotholeModelStatus())
      setModelInfo(getPotholeModelInfo())
    })
  }, [])

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            Road Hazard <span className="gradient-text">Detection</span>
          </h1>
          <p className="text-gray-400">AI-powered pothole and road damage detection for safer navigation</p>
        </motion.div>

        {/* Model Status Banner */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          {modelStatus === 'not_trained' && (
            <div className="glass-card p-5 mb-6 border-yellow-500/20">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-yellow-400 font-semibold mb-2">Model Training Required</h3>
                  <p className="text-gray-300 text-sm mb-3">
                    The road hazard detection model needs to be trained on the RDD2022 (Road Damage Dataset)
                    before it can detect potholes and cracks.
                  </p>
                  <div className="bg-white/[0.03] rounded-lg p-4 text-sm space-y-2">
                    <p className="text-gray-400 font-medium">Training Steps:</p>
                    <ol className="list-decimal list-inside space-y-1 text-gray-400 text-xs">
                      <li>Open Google Colab with GPU runtime (free)</li>
                      <li>Upload <code className="text-cyan-400">ml/pothole_detection/train_pothole_model.py</code></li>
                      <li>Download RDD2022 dataset from GitHub (sekilab/RoadDamageDetector)</li>
                      <li>Convert annotations to YOLO format</li>
                      <li>Train YOLOv8n (~50 epochs, ~1 hour on Colab GPU)</li>
                      <li>Export to ONNX and place in <code className="text-cyan-400">models/pothole/</code></li>
                    </ol>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                    <Info className="w-3.5 h-3.5" />
                    <span>Model: {modelInfo.modelName} · Status: {modelInfo.trainingStatus}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Camera Preview Placeholder */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
          <div className="glass-card overflow-hidden mb-8">
            <div className="relative bg-navy-900 aspect-video rounded-xl overflow-hidden flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-cyan-400/10 flex items-center justify-center mb-4">
                <Shield className="w-10 h-10 text-cyan-400/40" />
              </div>
              <div className="text-center px-8">
                <p className="text-gray-400 font-medium mb-2">Road Hazard Scanner</p>
                <p className="text-gray-500 text-sm">
                  {modelStatus === 'not_trained'
                    ? 'The scanner will be available once the AI model has been trained. Point your camera at the road surface and the AI will identify potholes, cracks, and other hazards.'
                    : 'Ready to scan road surface for hazards.'}
                </p>
              </div>

              {/* Preview overlay showing what detections look like */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-3 opacity-40">
                <div className="px-3 py-1 rounded-full bg-orange-400/20 border border-orange-400/30 text-orange-400 text-xs">
                  Pothole detected
                </div>
                <div className="px-3 py-1 rounded-full bg-yellow-400/20 border border-yellow-400/30 text-yellow-400 text-xs">
                  Crack found
                </div>
                <div className="px-3 py-1 rounded-full bg-red-400/20 border border-red-400/30 text-red-400 text-xs">
                  Hazard ahead
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Hazard Types */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-cyan-400" /> Detectable Hazard Types
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {HAZARD_CARDS.map(h => (
              <div key={h.type} className={`glass-card p-5 ${h.border} hover:scale-[1.02] transition-transform`}>
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl ${h.bg} flex items-center justify-center flex-shrink-0`}>
                    <Activity className={`w-6 h-6 ${h.color}`} />
                  </div>
                  <div>
                    <h3 className={`font-semibold ${h.color} mb-1`}>{h.type}</h3>
                    <p className="text-gray-400 text-sm">{h.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Dataset Info */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="glass-card p-6 mb-8">
            <h3 className="font-display text-lg font-semibold mb-4">Training Dataset: RDD2022</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {[
                { label: 'Countries', value: '6' },
                { label: 'Damage Types', value: '4' },
                { label: 'Base Model', value: 'YOLOv8n' },
                { label: 'Export', value: 'ONNX' },
              ].map(s => (
                <div key={s.label} className="bg-white/[0.03] rounded-xl p-4">
                  <div className="text-2xl font-bold text-cyan-400 mb-1">{s.value}</div>
                  <div className="text-gray-500 text-xs">{s.label}</div>
                </div>
              ))}
            </div>
            <p className="text-gray-500 text-xs mt-4">
              RDD2022 covers road damage images from Japan, India, Czech Republic, Norway, USA, and China.
              Source: github.com/sekilab/RoadDamageDetector
            </p>
          </div>
        </motion.div>

        {/* Safety Disclaimer */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="glass-card p-4 border-red-500/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-red-400 font-semibold text-sm mb-1">Safety Warning</h4>
              <p className="text-gray-400 text-xs leading-relaxed">{POTHOLE_DISCLAIMER}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
