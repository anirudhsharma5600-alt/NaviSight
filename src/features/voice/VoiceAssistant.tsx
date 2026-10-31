import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, MicOff, Volume2, Square, HelpCircle, Loader2, Eye, Camera,
  BookOpen, Sparkles, AlertTriangle, ShieldCheck, RefreshCw, VolumeX, Globe,
  CheckCircle2, Radio, Info
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { NaviAssistant } from '../../assistant/NaviAssistant'
import { VoiceStateManager, type VoiceStateSnapshot, type VoiceState } from '../../assistant/voice/VoiceStateManager'
import { VoiceEngine } from '../../assistant/voice/VoiceEngine'
import { VoiceLanguageManager } from '../../assistant/voice/VoiceLanguageManager'
import type { AssistantLanguage } from '../../assistant/AssistantState'

export default function VoiceAssistant() {
  const [snapshot, setSnapshot] = useState<VoiceStateSnapshot>(VoiceStateManager.getSnapshot())
  const [manualInput, setManualInput] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    NaviAssistant.init(navigate)
    const unsubscribe = VoiceStateManager.subscribe(setSnapshot)
    return () => unsubscribe()
  }, [navigate])

  const handleToggleEnable = async () => {
    if (snapshot.isWakeWordEnabled) {
      await VoiceEngine.setAlwaysListening(false)
    } else {
      await VoiceEngine.setAlwaysListening(true)
    }
  }

  const handleMicClick = () => {
    VoiceEngine.tapToTalk()
  }

  const handleLanguageSelect = (lang: AssistantLanguage) => {
    VoiceEngine.setLanguage(lang)
  }

  const handleStopAll = () => {
    VoiceEngine.interruptSpeech()
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

  // State badge styling and label
  const getStateBadge = (state: VoiceState) => {
    switch (state) {
      case 'LISTENING':
        return { label: 'LISTENING (MIC ACTIVE)', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40 animate-pulse' }
      case 'SPEAKING':
        return { label: 'SPEAKING RESPONSE', color: 'bg-blue-500/20 text-blue-300 border-blue-400/40 animate-pulse' }
      case 'PROCESSING':
        return { label: 'PROCESSING INTENT', color: 'bg-amber-500/20 text-amber-300 border-amber-400/40' }
      case 'EXECUTING_COMMAND':
        return { label: 'EXECUTING ACTION', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40' }
      case 'AWAITING_CLARIFICATION':
        return { label: 'AWAITING CLARIFICATION', color: 'bg-purple-500/20 text-purple-300 border-purple-400/40 animate-pulse' }
      case 'INTERRUPTED':
        return { label: 'SPEECH INTERRUPTED', color: 'bg-rose-500/20 text-rose-300 border-rose-400/40' }
      case 'REQUESTING_PERMISSION':
        return { label: 'REQUESTING PERMISSION', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/40' }
      case 'ERROR':
        return { label: 'VOICE ERROR', color: 'bg-red-500/20 text-red-300 border-red-400/40' }
      case 'RECONNECTING':
        return { label: 'RECONNECTING MIC', color: 'bg-orange-500/20 text-orange-300 border-orange-400/40' }
      case 'IDLE':
      default:
        return { label: 'STANDBY (IDLE)', color: 'bg-slate-800 text-gray-400 border-slate-700' }
    }
  }

  const stateBadge = getStateBadge(snapshot.state)

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
            <Sparkles className="w-3.5 h-3.5" /> Navi Voice Assistant 3.0
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold mb-3">
            Hey <span className="gradient-text">Navi</span>
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto">
            Reliable voice companion for visually impaired individuals. Speak naturally in English, Hindi, Hinglish, or Punjabi to control the camera, read currency, and navigate routes.
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
            {/* Master Toggle & State Badge */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleToggleEnable}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-xs tracking-wide transition-all ${
                  snapshot.isWakeWordEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-sm shadow-emerald-500/20'
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white'
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    snapshot.isWakeWordEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
                  }`}
                />
                {snapshot.isWakeWordEnabled ? 'Wake-Word Active ("Hey Navi")' : 'Enable Wake-Word ("Hey Navi")'}
              </button>

              <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono uppercase font-bold border ${stateBadge.color}`}>
                {stateBadge.label}
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
                    snapshot.language === lang
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
              {snapshot.state === 'LISTENING' && (
                <motion.div
                  animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0.1, 0.6] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-cyan-500/30 blur-md -m-4"
                />
              )}
              {snapshot.state === 'SPEAKING' && (
                <motion.div
                  animate={{ scale: [1, 1.25, 1], opacity: [0.7, 0.2, 0.7] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-blue-500/35 blur-md -m-3"
                />
              )}

              {/* Large Push-to-Talk Mic Button */}
              <button
                onClick={handleMicClick}
                aria-label="Activate voice listening"
                className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center transition-all shadow-2xl active:scale-95 ${
                  snapshot.state === 'SPEAKING'
                    ? 'bg-gradient-to-tr from-blue-600 to-cyan-400 text-white shadow-cyan-500/30'
                    : snapshot.state === 'PROCESSING' || snapshot.state === 'EXECUTING_COMMAND'
                    ? 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-amber-500/30'
                    : snapshot.state === 'AWAITING_CLARIFICATION'
                    ? 'bg-gradient-to-tr from-purple-600 to-pink-500 text-white shadow-purple-500/40'
                    : snapshot.isMicrophoneActive
                    ? 'bg-gradient-to-tr from-cyan-400 to-blue-600 text-black shadow-cyan-500/40'
                    : 'bg-white/10 text-gray-300 border-2 border-white/20 hover:bg-white/15'
                }`}
              >
                {snapshot.state === 'PROCESSING' || snapshot.state === 'EXECUTING_COMMAND' ? (
                  <Loader2 className="w-12 h-12 animate-spin text-white" />
                ) : snapshot.state === 'SPEAKING' ? (
                  <Volume2 className="w-12 h-12 animate-pulse text-white" />
                ) : (
                  <Mic className="w-12 h-12" />
                )}
              </button>
            </div>

            {/* Status Feedback Heading */}
            <h2 className="text-xl font-bold font-display text-white mb-1">
              {snapshot.state === 'SPEAKING'
                ? 'Navi is speaking...'
                : snapshot.state === 'PROCESSING'
                ? 'Analyzing request...'
                : snapshot.state === 'EXECUTING_COMMAND'
                ? 'Executing command...'
                : snapshot.state === 'AWAITING_CLARIFICATION'
                ? 'Navi needs clarification'
                : snapshot.isMicrophoneActive
                ? "Listening... speak now"
                : snapshot.isWakeWordEnabled
                ? "Listening for 'Hey Navi'..."
                : 'Tap microphone to speak'}
            </h2>
            <p className="text-gray-400 text-xs sm:text-sm max-w-md">
              {snapshot.isMicrophoneActive
                ? 'Speak naturally (e.g. "Check how much money this is", "Describe road ahead")'
                : snapshot.isWakeWordEnabled
                ? 'Keep page active in foreground to detect "Hey Navi" at any moment.'
                : 'Microphone is standby. Tap button above to talk or enable wake-word.'}
            </p>

            {/* Interim Transcript Live Display */}
            {snapshot.interimTranscript && (
              <div className="mt-3 px-4 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
                "{snapshot.interimTranscript}..."
              </div>
            )}
          </div>

          {/* Clarification Box (Disambiguation) */}
          {snapshot.state === 'AWAITING_CLARIFICATION' && snapshot.clarificationPrompt && (
            <div className="my-4 p-4 rounded-xl bg-purple-950/40 border border-purple-500/40 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-purple-400 shrink-0" />
                <span className="text-sm font-semibold text-purple-200">{snapshot.clarificationPrompt}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleQuickCommand('stop camera')}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                >
                  Stop Camera
                </button>
                <button
                  onClick={() => handleQuickCommand('stop speaking')}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
                >
                  Stop Speaking
                </button>
              </div>
            </div>
          )}

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
            {snapshot.conversationHistory.length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-4">
                No commands yet. Say "Hey Navi, describe surroundings" to begin.
              </p>
            ) : (
              snapshot.conversationHistory.map((turn) => (
                <div
                  key={turn.id}
                  className={`p-3.5 rounded-2xl text-sm ${
                    turn.speaker === 'user'
                      ? 'bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 ml-8'
                      : 'bg-white/5 border border-white/10 text-gray-200 mr-8'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 mb-1">
                    <span>{turn.speaker === 'user' ? '👤 You' : '🤖 Navi'}</span>
                    <span className="font-mono text-[10px] text-gray-500">
                      {new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="leading-relaxed">{turn.text}</p>
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
                  onClick={() => handleQuickCommand('what is in front of me')}
                  className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-blue-500/20 border border-white/5 transition-all text-gray-300"
                >
                  <span className="text-blue-300 font-mono">"What is in front of me?"</span>
                </button>
                <button
                  onClick={() => handleQuickCommand('what is on my left')}
                  className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-blue-500/20 border border-white/5 transition-all text-gray-300"
                >
                  <span className="text-blue-300 font-mono">"What is on my left?"</span>
                </button>
              </div>
            </div>

            {/* Category 3: Road Hazard Detection */}
            <div className="glass-card p-4 border border-amber-500/20 bg-amber-950/10">
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                ⚠️ Road Hazards & Safety
              </h4>
              <div className="space-y-1.5 text-xs">
                <button
                  onClick={() => handleQuickCommand('detect potholes')}
                  className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-amber-500/20 border border-white/5 transition-all text-gray-300"
                >
                  <span className="text-amber-400 font-mono">"Hey Navi, detect potholes"</span>
                  <p className="text-[11px] text-gray-400 mt-0.5">Scans walking path for surface cracks and potholes</p>
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
