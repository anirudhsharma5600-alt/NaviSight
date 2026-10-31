import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Camera, AlertCircle, Info, Eye, Loader2, Volume2, CheckCircle2, XCircle, ScanText
} from 'lucide-react'
import {
  getCurrencyModelInfo, loadCurrencyModel, getCurrencyModelStatus,
  SUPPORTED_DENOMINATIONS, DENOMINATION_COLORS, CURRENCY_DISCLAIMER,
  type CurrencyModelStatus,
} from '../services/currencyDetection'

const DENOMINATION_DETAILS: { value: string; color: string; name: string; note: string }[] = [
  { value: '₹10', color: '#8B4513', name: 'Chocolate Brown', note: '' },
  { value: '₹20', color: '#9ACD32', name: 'Greenish Yellow', note: '' },
  { value: '₹50', color: '#00BFFF', name: 'Fluorescent Blue', note: '' },
  { value: '₹100', color: '#E6E6FA', name: 'Lavender', note: '' },
  { value: '₹200', color: '#FFD700', name: 'Bright Yellow', note: '' },
  { value: '₹500', color: '#808080', name: 'Stone Grey', note: '' },
  { value: '₹2000', color: '#FF00FF', name: 'Magenta', note: 'Being withdrawn from circulation' },
]

export default function CurrencyPage() {
  const [modelStatus, setModelStatus] = useState<CurrencyModelStatus>('not_trained')
  const [modelInfo, setModelInfo] = useState(getCurrencyModelInfo())

  useEffect(() => {
    loadCurrencyModel().then(() => {
      setModelStatus(getCurrencyModelStatus())
      setModelInfo(getCurrencyModelInfo())
    })
  }, [])

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            Currency <span className="gradient-text">Reader</span>
          </h1>
          <p className="text-gray-400">Identify Indian currency notes using AI</p>
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
                    The currency recognition AI model has not been trained yet. Once trained,
                    it will identify Indian Rupee denominations from camera images.
                  </p>
                  <div className="bg-white/[0.03] rounded-lg p-4 text-sm space-y-2">
                    <p className="text-gray-400 font-medium">To train the model:</p>
                    <ol className="list-decimal list-inside space-y-1 text-gray-400 text-xs">
                      <li>Open Google Colab with GPU runtime (free)</li>
                      <li>Upload the training script from <code className="text-cyan-400">ml/currency_recognition/train_currency_model.py</code></li>
                      <li>Download the Indian Currency Dataset from Kaggle</li>
                      <li>Run training (~20 epochs, ~30 minutes on Colab GPU)</li>
                      <li>Export model to ONNX format</li>
                      <li>Place <code className="text-cyan-400">model.onnx</code> in <code className="text-cyan-400">models/currency/</code></li>
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

          {modelStatus === 'ready' && (
            <div className="glass-card p-4 mb-6 border-green-500/20">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Currency Recognition Model Ready</span>
              </div>
            </div>
          )}

          {modelStatus === 'error' && (
            <div className="glass-card p-4 mb-6 border-red-500/20">
              <div className="flex items-center gap-2 text-red-400">
                <XCircle className="w-5 h-5" />
                <span className="font-medium">Model failed to load</span>
              </div>
            </div>
          )}
        </motion.div>

        {/* Scanner Section */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
          <div className="glass-card overflow-hidden mb-8">
            <div className="relative bg-navy-900 aspect-video rounded-xl overflow-hidden flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-cyan-400/10 flex items-center justify-center mb-4">
                <ScanText className="w-10 h-10 text-cyan-400/40" />
              </div>
              {modelStatus === 'not_trained' ? (
                <div className="text-center px-8">
                  <p className="text-gray-400 font-medium mb-2">Currency Scanner</p>
                  <p className="text-gray-500 text-sm">
                    The scanner will be available once the AI model has been trained.
                    Point your camera at an Indian banknote and the AI will identify its denomination.
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-gray-400 font-medium mb-2">Ready to Scan</p>
                  <button className="flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-400/20 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/30 font-medium">
                    <Camera className="w-5 h-5" /> Start Camera
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Supported Denominations */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-cyan-400" /> Supported Denominations
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8">
            {DENOMINATION_DETAILS.map(d => (
              <div key={d.value} className="glass-card p-4 text-center group hover:border-cyan-400/20 transition-colors">
                <div
                  className="w-16 h-10 rounded-lg mx-auto mb-3 flex items-center justify-center text-white font-bold text-sm shadow-lg"
                  style={{ backgroundColor: d.color }}
                >
                  {d.value}
                </div>
                <p className="text-white font-medium text-sm">{d.value}</p>
                <p className="text-gray-500 text-xs mt-1">{d.name}</p>
                {d.note && (
                  <p className="text-yellow-500/70 text-xs mt-1 italic">{d.note}</p>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* How It Works */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="glass-card p-6 mb-8">
            <h3 className="font-display text-lg font-semibold mb-4">How It Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { step: '1', title: 'Point Camera', desc: 'Hold a banknote in front of your camera' },
                { step: '2', title: 'AI Analyzes', desc: 'MobileNetV3 identifies the denomination' },
                { step: '3', title: 'Hear Result', desc: 'The denomination is spoken aloud' },
              ].map(s => (
                <div key={s.step} className="text-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-3 text-white font-bold">
                    {s.step}
                  </div>
                  <h4 className="text-white font-medium text-sm mb-1">{s.title}</h4>
                  <p className="text-gray-500 text-xs">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Safety Disclaimer */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="glass-card p-4 border-yellow-500/20">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-yellow-400 font-semibold text-sm mb-1">Disclaimer</h4>
              <p className="text-gray-400 text-xs leading-relaxed">{CURRENCY_DISCLAIMER}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
