/**
 * NaviAble AI 2.0 — Floating Navi Voice Assistant Component
 *
 * Accessible floating widget available across all views:
 * - Large high-contrast microphone button
 * - Animated wake-word listening status indicator
 * - Live transcript banner
 * - Quick intent shortcuts
 * - Trilingual language selector (EN, HI, PA)
 */

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, MicOff, Volume2, Square, Sparkles, AlertCircle, ChevronUp, ChevronDown, Globe
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { NaviAssistant } from '../assistant/NaviAssistant'
import { AssistantState, type AssistantStateData, type AssistantLanguage } from '../assistant/AssistantState'

export default function NaviFloatingAssistant() {
  const [state, setState] = useState<AssistantStateData>(AssistantState.getState())
  const [isExpanded, setIsExpanded] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    NaviAssistant.init(navigate)
    const unsubscribe = AssistantState.subscribe(setState)
    return () => unsubscribe()
  }, [navigate])

  const handleToggleEnable = () => {
    if (state.isEnabled) {
      NaviAssistant.disableAssistant()
    } else {
      NaviAssistant.enableAssistant()
    }
  }

  const handleMicClick = () => {
    NaviAssistant.tapToTalk()
  }

  const handleLanguageChange = (lang: AssistantLanguage) => {
    AssistantState.updateState({ language: lang })
  }

  const getStatusLabel = () => {
    if (!state.isEnabled && !state.isListening) return 'Navi Standby'
    if (state.status === 'wake_word_detected') return 'Listening for command...'
    if (state.status === 'processing') return 'Thinking...'
    if (state.status === 'speaking') return 'Navi Speaking...'
    if (state.isListening) return "Listening for 'Hey Navi'..."
    return 'Navi Ready'
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end">
      {/* Expanded Quick Controls Card */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            className="mb-3 w-80 max-w-[calc(100vw-32px)] bg-[#0d1222]/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-4 shadow-2xl shadow-cyan-500/10 text-white"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-semibold text-sm">Navi Assistant</span>
              </div>
              <div className="flex items-center gap-1">
                {(['en', 'hi', 'pa'] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => handleLanguageChange(l)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                      state.language === l
                        ? 'bg-cyan-500 text-black font-bold'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {l === 'en' ? 'EN' : l === 'hi' ? 'HI' : 'PA'}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversation Preview */}
            <div className="max-h-36 overflow-y-auto space-y-2 mb-3 text-xs pr-1">
              {state.conversation.slice(-3).map((msg) => (
                <div
                  key={msg.id}
                  className={`p-2 rounded-xl ${
                    msg.sender === 'user'
                      ? 'bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 ml-4'
                      : 'bg-white/5 border border-white/10 text-gray-200 mr-4'
                  }`}
                >
                  <span className="font-semibold block text-[10px] text-gray-400 mb-0.5">
                    {msg.sender === 'user' ? 'You' : 'Navi'}
                  </span>
                  {msg.text}
                </div>
              ))}
            </div>

            {/* Quick Action Chips */}
            <div className="grid grid-cols-2 gap-1.5 text-[11px] font-medium">
              <button
                onClick={() => NaviAssistant.handleTranscriptReceived('check how much money this is', true)}
                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-cyan-500/20 hover:border-cyan-400/40 text-left transition-all"
              >
                💵 Scan Currency
              </button>
              <button
                onClick={() => NaviAssistant.handleTranscriptReceived('describe my surroundings', true)}
                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-cyan-500/20 hover:border-cyan-400/40 text-left transition-all"
              >
                👁️ Describe Scene
              </button>
              <button
                onClick={() => NaviAssistant.handleTranscriptReceived('detect potholes', true)}
                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-cyan-500/20 hover:border-cyan-400/40 text-left transition-all"
              >
                🚧 Check Hazards
              </button>
              <button
                onClick={() => NaviAssistant.stopSpeaking()}
                className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 text-left transition-all"
              >
                ⏹️ Stop Speaking
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Pill & Large Mic Button */}
      <div className="flex items-center gap-2 bg-[#0a0e1a]/95 backdrop-blur-xl border border-cyan-500/30 rounded-full p-1.5 shadow-xl shadow-cyan-500/15">
        {/* Status Pill Button */}
        <button
          onClick={handleToggleEnable}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            state.isEnabled
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
              : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white'
          }`}
          title={state.isEnabled ? "Click to disable 'Hey Navi' listening" : "Click to enable 'Hey Navi' listening"}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              state.status === 'wake_word_detected'
                ? 'bg-purple-400 animate-ping'
                : state.isListening
                ? 'bg-emerald-400 animate-pulse'
                : 'bg-gray-500'
            }`}
          />
          <span className="hidden sm:inline font-mono">{getStatusLabel()}</span>
          <span className="sm:hidden font-mono">{state.isEnabled ? 'NAVI ON' : 'NAVI OFF'}</span>
        </button>

        {/* Expand Toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 text-gray-400 hover:text-white transition-colors"
          title="Toggle Navi details"
          aria-label="Toggle assistant details"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>

        {/* Large Accessible Push-to-Talk Mic Button */}
        <button
          onClick={handleMicClick}
          aria-label="Talk to Navi Assistant"
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95 ${
            state.wakeWordActive
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-purple-500/40 scale-105 animate-pulse'
              : state.isListening
              ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-black shadow-cyan-500/30'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          title="Tap to speak to Navi"
        >
          <Mic className="w-6 h-6" />
        </button>
      </div>
    </div>
  )
}

