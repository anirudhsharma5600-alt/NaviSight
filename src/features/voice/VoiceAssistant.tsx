import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, MicOff, Volume2, Square, HelpCircle, Loader2, Eye, Camera,
  BookOpen, Sparkles, AlertTriangle, ShieldCheck, RefreshCw, VolumeX, Globe
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { NaviAssistant } from '../../assistant/NaviAssistant'
import { AssistantState, type AssistantStateData, type AssistantLanguage } from '../../assistant/AssistantState'
import { VoiceManager } from '../../services/VoiceAnnouncementManager'

export default function VoiceAssistant() {
  const [state, setState] = useState<AssistantStateData>(AssistantState.getState())
  const [manualInput, setManualInput] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    NaviAssistant.init(navigate)
    const unsubscribe = AssistantState.subscribe(setState)
    return () => unsubscribe()
  }, [navigate])

  const handleToggleEnable = async () => {
    if (state.isEnabled) {
      NaviAssistant.disableAssistant()
    } else {
      await NaviAssistant.enableAssistant()
    }
  }

  const handleMicClick = () => {
    NaviAssistant.tapToTalk()
  }

  const handleLanguageSelect = (lang: AssistantLanguage) => {
    AssistantState.updateState({ language: lang })
    VoiceManager.setLanguage(lang)
  }

  const handleStopAll = () => {
    NaviAssistant.stopSpeaking()
  }

  const handleQuickCommand = async (cmd: string) => {
    await NaviAssistant.handleTranscriptReceived(cmd, true)
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualInput.trim()) return
    const text = manualInput
    setManualInput('')
    await NaviAssistant.handleTranscriptReceived(text, true)
  }

  return (
    <div className="min-h-screen pt-20 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 text-xs font-mono uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Alexa-Style Conversational AI
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold mb-3">
            Hey <span className="gradient-text">Navi</span>
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto">
            Hands-free voice companion for visually impaired users. Say <span className="text-cyan-300 font-semibold font-mono">"Hey Navi"</span> or tap the microphone to control your camera, read currency, and check road conditions.
          </p>
        </motion.div>

        {/* Master Control Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6 sm:p-8 mb-8 border border-cyan-500/25 bg-gradient-to-b from-cyan-950/20 to-black/40 shadow-2xl relative overflow-hidden"
        >
          {/* Top Status & Language Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
            {/* Master Toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleEnable}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-xs tracking-wide transition-all ${
                  state.isEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-sm shadow-emerald-500/20'
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    state.isEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
                  }`}
                />
                {state.isEnabled ? 'Navi Always-Listening: ON' : 'Enable Navi (Wake-Word)'}
              </button>

              <span className="text-xs text-gray-400 font-mono hidden sm:inline">
                Say: "Hey Navi"
              </span>
            </div>

            {/* Language Selector */}
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full p-1 text-xs">
              <Globe className="w-3.5 h-3.5 text-gray-400 ml-1.5" />
              {(['en', 'hi', 'pa'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => handleLanguageSelect(lang)}
                  className={`px-3 py-1 rounded-full font-medium transition-all ${
                    state.language === lang
                      ? 'bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/20'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {lang === 'en' ? 'English' : lang === 'hi' ? 'हिन्दी' : 'ਪੰਜਾਬੀ'}
                </button>
              ))}
            </div>
          </div>

          {/* Central Interactive Voice Orb */}
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="relative mb-6">
              {/* Outer Pulse Rings */}
              {state.wakeWordActive && (
                <motion.div
                  animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0.1, 0.6] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-purple-500/30 blur-md -m-4"
                />
              )}
              {state.isListening && !state.wakeWordActive && (
                <motion.div
                  animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-cyan-500/25 blur-md -m-3"
                />
              )}

              {/* Large Push-to-Talk Mic Button */}
              <button
                onClick={handleMicClick}
                aria-label="Activate voice listening"
                className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center transition-all shadow-2xl active:scale-95 ${
                  state.wakeWordActive
                    ? 'bg-gradient-to-tr from-purple-600 to-pink-500 text-white shadow-purple-500/50 scale-105'
                    : state.status === 'processing'
                    ? 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-amber-500/30'
                    : state.status === 'speaking'
                    ? 'bg-gradient-to-tr from-blue-600 to-cyan-400 text-white shadow-cyan-500/30'
                    : state.isListening
                    ? 'bg-gradient-to-tr from-cyan-400 to-blue-600 text-black shadow-cyan-500/40'
                    : 'bg-white/10 text-gray-300 border-2 border-white/20 hover:bg-white/15'
                }`}
              >
                {state.status === 'processing' ? (
                  <Loader2 className="w-12 h-12 animate-spin text-white" />
                ) : state.status === 'speaking' ? (
                  <Volume2 className="w-12 h-12 animate-pulse text-white" />
                ) : (
                  <Mic className="w-12 h-12" />
                )}
              </button>
            </div>

            {/* Status Feedback Heading */}
            <h2 className="text-xl font-bold font-display text-white mb-1">
              {state.wakeWordActive
                ? 'Yes, how can I help?'
                : state.status === 'processing'
                ? 'Processing command...'
                : state.status === 'speaking'
                ? 'Speaking response...'
                : state.isListening
                ? "Listening for 'Hey Navi'..."
                : 'Tap to speak or enable wake-word'}
            </h2>
            <p className="text-gray-400 text-xs sm:text-sm max-w-md">
              {state.wakeWordActive
                ? 'Speak your request clearly (e.g. "Check how much money this is")'
                : state.isListening
                ? 'Say "Hey Navi" at any time, or click the microphone to speak immediately.'
                : 'Microphone is standby. Tap the button or enable always-listening.'}
            </p>
          </div>

          {/* Action Bar (Stop Audio, Silence, Repeat) */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-white/10">
            <button
              onClick={handleStopAll}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 transition-all"
            >
              <Square className="w-3.5 h-3.5" /> Stop Speaking
            </button>
            <button
              onClick={() => handleQuickCommand('repeat')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition-all"
            >
              <Volume2 className="w-3.5 h-3.5" /> Repeat Last Response
            </button>
          </div>
        </motion.div>

        {/* Live Conversation Stream */}
        <div className="glass-card p-6 mb-8 border border-white/10">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" /> Interactive Conversation
            </h3>
            <span className="text-xs text-gray-500 font-mono">Real AI Interaction</span>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto pr-1 mb-4">
            {state.conversation.length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-4">
                No commands yet. Say "Hey Navi, describe surroundings" to begin.
              </p>
            ) : (
              state.conversation.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3.5 rounded-2xl text-sm ${
                    msg.sender === 'user'
                      ? 'bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 ml-8'
                      : 'bg-white/5 border border-white/10 text-gray-200 mr-8'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 mb-1">
                    <span>{msg.sender === 'user' ? '👤 You' : '🤖 Navi'}</span>
                    <span className="font-mono text-[10px] text-gray-500">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="leading-relaxed">{msg.text}</p>
                </div>
              ))
            )}
          </div>

          {/* Text Command Fallback Input */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Or type a command (e.g. 'check how much money this is', 'describe road')..."
              className="flex-1 bg-black/40 border border-white/10 rounded-full px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 hover:bg-cyan-500/30 rounded-full text-xs font-semibold transition-all"
            >
              Send
            </button>
          </form>
        </div>

        {/* Command Reference by Category */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              Natural Voice Commands (Tap any to test)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category 1: Currency Commands */}
            <div className="glass-card p-4 border border-cyan-500/20 bg-cyan-950/10">
              <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                💵 Indian Currency Commands
              </h4>
              <div className="space-y-1.5 text-xs">
                <button
                  onClick={() => handleQuickCommand('check how much money this is')}
                  className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-cyan-500/20 border border-white/5 transition-all text-gray-300"
                >
                  <span className="text-cyan-400 font-mono">"Hey Navi, check how much money this is"</span>
                  <p className="text-[11px] text-gray-400 mt-0.5">Scans live camera frame & speaks ₹10 to ₹2000 denomination</p>
                </button>
                <button
                  onClick={() => handleQuickCommand('read this note')}
                  className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-cyan-500/20 border border-white/5 transition-all text-gray-300"
                >
                  <span className="text-cyan-400 font-mono">"Hey Navi, read this note"</span>
                </button>
                <button
                  onClick={() => handleQuickCommand('repeat the amount')}
                  className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-cyan-500/20 border border-white/5 transition-all text-gray-300"
                >
                  <span className="text-cyan-400 font-mono">"Repeat the amount"</span>
                </button>
              </div>
            </div>

            {/* Category 2: Scene & Road Intelligence */}
            <div className="glass-card p-4 border border-blue-500/20 bg-blue-950/10">
              <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                👁️ Scene & Road Narration
              </h4>
              <div className="space-y-1.5 text-xs">
                <button
                  onClick={() => handleQuickCommand('describe my surroundings')}
                  className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-blue-500/20 border border-white/5 transition-all text-gray-300"
                >
                  <span className="text-blue-300 font-mono">"Hey Navi, describe my surroundings"</span>
                  <p className="text-[11px] text-gray-400 mt-0.5">Narrates vehicles, obstacles, signs, and pedestrians</p>
                </button>
                <button
                  onClick={() => handleQuickCommand('is there a vehicle nearby')}
                  className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-blue-500/20 border border-white/5 transition-all text-gray-300"
                >
                  <span className="text-blue-300 font-mono">"Is there a vehicle nearby?"</span>
                </button>
                <button
                  onClick={() => handleQuickCommand('tell me what is on the road')}
                  className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-blue-500/20 border border-white/5 transition-all text-gray-300"
                >
                  <span className="text-blue-300 font-mono">"Tell me what's on the road"</span>
                </button>
              </div>
            </div>

            {/* Category 3: Road Hazards & Potholes */}
            <div className="glass-card p-4 border border-amber-500/20 bg-amber-950/10">
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                🚧 Road Hazards & Potholes
              </h4>
              <div className="space-y-1.5 text-xs">
                <button
                  onClick={() => handleQuickCommand('detect potholes')}
                  className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-amber-500/20 border border-white/5 transition-all text-gray-300"
                >
                  <span className="text-amber-300 font-mono">"Hey Navi, detect potholes"</span>
                  <p className="text-[11px] text-gray-400 mt-0.5">Checks surface texture & pavement cracks</p>
                </button>
                <button
                  onClick={() => handleQuickCommand('describe road conditions')}
                  className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-amber-500/20 border border-white/5 transition-all text-gray-300"
                >
                  <span className="text-amber-300 font-mono">"Describe road conditions"</span>
                </button>
              </div>
            </div>

            {/* Category 4: Camera & System Controls */}
            <div className="glass-card p-4 border border-purple-500/20 bg-purple-950/10">
              <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                ⚙️ Camera & Assistant Controls
              </h4>
              <div className="space-y-1.5 text-xs">
                <button
                  onClick={() => handleQuickCommand('start camera')}
                  className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-purple-500/20 border border-white/5 transition-all text-gray-300"
                >
                  <span className="text-purple-300 font-mono">"Hey Navi, start camera"</span>
                </button>
                <button
                  onClick={() => handleQuickCommand('switch to rear camera')}
                  className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-purple-500/20 border border-white/5 transition-all text-gray-300"
                >
                  <span className="text-purple-300 font-mono">"Switch to rear camera"</span>
                </button>
                <button
                  onClick={() => handleQuickCommand('speak slower')}
                  className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-purple-500/20 border border-white/5 transition-all text-gray-300"
                >
                  <span className="text-purple-300 font-mono">"Speak slower"</span>
                </button>
                <button
                  onClick={() => handleQuickCommand('stop speaking')}
                  className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/5 transition-all text-red-300"
                >
                  <span className="text-red-400 font-mono">"Be quiet" / "Stop speaking"</span>
                </button>
              </div>
            </div>

            {/* Category 5: Remember & Personal Memory */}
            <div className="glass-card p-4 border border-emerald-500/20 bg-emerald-950/10 md:col-span-2">
              <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                🧠 Remember: Routes, Places & Personal Memory
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => handleQuickCommand('remember this route')}
                  className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-emerald-500/20 border border-white/5 transition-all text-gray-300"
                >
                  <span className="text-emerald-400 font-mono">"Hey Navi, remember this route"</span>
                  <p className="text-[11px] text-gray-400 mt-0.5">Starts GPS breadcrumb recording with landmark voice notes</p>
                </button>
                <button
                  onClick={() => handleQuickCommand('save this route')}
                  className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-emerald-500/20 border border-white/5 transition-all text-gray-300"
                >
                  <span className="text-emerald-400 font-mono">"Hey Navi, save this route"</span>
                  <p className="text-[11px] text-gray-400 mt-0.5">Computes distance, duration, and saves to IndexedDB</p>
                </button>
                <button
                  onClick={() => handleQuickCommand('remember this place')}
                  className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-emerald-500/20 border border-white/5 transition-all text-gray-300"
                >
                  <span className="text-emerald-400 font-mono">"Hey Navi, remember this place"</span>
                  <p className="text-[11px] text-gray-400 mt-0.5">Pins current GPS coordinates with custom name</p>
                </button>
                <button
                  onClick={() => handleQuickCommand('remember what this looks like')}
                  className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-emerald-500/20 border border-white/5 transition-all text-gray-300"
                >
                  <span className="text-emerald-400 font-mono">"Hey Navi, remember what this looks like"</span>
                  <p className="text-[11px] text-gray-400 mt-0.5">Stores visual scene signature and detected object tags</p>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
