import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Volume2, Square, HelpCircle, Loader2 } from 'lucide-react'

type Status = 'idle' | 'listening' | 'processing' | 'speaking' | 'error'

// Check browser support
const SpeechRecognitionAPI =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

export default function VoiceAssistant() {
  const [status, setStatus] = useState<Status>('idle')
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [error, setError] = useState('')
  const [history, setHistory] = useState<Array<{ user: string; navi: string }>>([])
  const recognitionRef = useRef<any>(null)
  const lastResponseRef = useRef('')

  const processCommand = useCallback((text: string): string => {
    const lower = text.toLowerCase().trim()

    if (/\b(hello|hi|hey)\b/.test(lower))
      return "Hello! I'm Navi, your AI assistant. I can help you see the world around you. Say 'help' to learn what I can do!"

    if (/\b(help|commands?|what can you)\b/.test(lower))
      return "Here's what I can do: Say 'describe surroundings' to know what's around you. Say 'read text' to read signs. Say 'navigate' for directions. Say 'stop' to silence me. Say 'repeat' to hear my last response again."

    if (/\b(describe|surroundings?|what.*see|what.*around|what.*front)\b/.test(lower))
      return "I can describe your surroundings when the camera is active. Please go to the AI Vision Dashboard to use real-time object detection."

    if (/\b(read|text|sign|ocr|scan)\b/.test(lower))
      return "I can read text for you! Please go to the Smart OCR Reader page where I can capture and read text from signs, labels, and documents."

    if (/\b(navigate|direction|where|map|location)\b/.test(lower))
      return "I can help with navigation! Please go to the Navigation page to see your location on the map and get directions."

    if (/\b(stop|quiet|silence|shut)\b/.test(lower)) {
      window.speechSynthesis?.cancel()
      return "Okay, I'll be quiet now."
    }

    if (/\b(repeat|again|say.*again)\b/.test(lower))
      return lastResponseRef.current || "I haven't said anything yet."

    if (/\b(thank|thanks)\b/.test(lower))
      return "You're welcome! I'm always here to help."

    if (/\b(who.*you|your.*name)\b/.test(lower))
      return "I'm Navi, your AI-powered accessibility assistant. I was built to help visually impaired people understand their surroundings using artificial intelligence."

    return `I heard you say: "${text}". Try saying 'help' to learn what I can do!`
  }, [])

  const speakResponse = useCallback((text: string) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    setStatus('speaking')
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.9
    utterance.pitch = 1.0
    utterance.lang = 'en-US'
    utterance.onend = () => setStatus('idle')
    utterance.onerror = () => setStatus('idle')
    window.speechSynthesis.speak(utterance)
    lastResponseRef.current = text
  }, [])

  const startListening = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.')
      setStatus('error')
      return
    }

    setError('')
    setTranscript('')

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => setStatus('listening')

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1]
      setTranscript(result[0].transcript)

      if (result.isFinal) {
        setStatus('processing')
        const text = result[0].transcript
        const reply = processCommand(text)
        setResponse(reply)
        setHistory(prev => [...prev.slice(-4), { user: text, navi: reply }])
        setTimeout(() => speakResponse(reply), 300)
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        setError('No speech detected. Please try again.')
      } else if (event.error === 'not-allowed') {
        setError('Microphone permission denied. Please allow microphone access.')
      } else {
        setError(`Speech recognition error: ${event.error}`)
      }
      setStatus('error')
    }

    recognition.onend = () => {
      if (status === 'listening') setStatus('idle')
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [processCommand, speakResponse, status])

  const stopEverything = () => {
    recognitionRef.current?.stop()
    window.speechSynthesis?.cancel()
    setStatus('idle')
  }

  const statusColors = {
    idle: 'from-cyan-400/20 to-neon-blue/20 border-cyan-400/30',
    listening: 'from-green-400/20 to-emerald-500/20 border-green-400/50',
    processing: 'from-yellow-400/20 to-amber-500/20 border-yellow-400/40',
    speaking: 'from-neon-purple/20 to-violet-500/20 border-neon-purple/50',
    error: 'from-red-400/20 to-red-500/20 border-red-400/40',
  }

  const statusText = {
    idle: 'Tap to talk to Navi',
    listening: 'Navi is listening...',
    processing: 'Processing...',
    speaking: 'Navi is speaking...',
    error: 'Something went wrong',
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            Navi <span className="gradient-text">Voice Assistant</span>
          </h1>
          <p className="text-gray-400">Your intelligent AI companion — just talk!</p>
        </motion.div>

        {/* Main Mic Button */}
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="flex flex-col items-center mb-12">
          <button
            onClick={status === 'idle' || status === 'error' ? startListening : stopEverything}
            className={`relative w-32 h-32 rounded-full bg-gradient-to-br ${statusColors[status]} border-2 transition-all duration-500 group hover:scale-105 focus:outline-none focus:ring-4 focus:ring-cyan-400/30`}
            aria-label={status === 'idle' ? 'Start listening' : 'Stop'}
          >
            {/* Pulse rings */}
            {status === 'listening' && (
              <>
                <span className="absolute inset-0 rounded-full border-2 border-green-400/40 animate-ping" />
                <span className="absolute -inset-3 rounded-full border border-green-400/20 animate-pulse" />
              </>
            )}
            {status === 'speaking' && (
              <span className="absolute -inset-2 rounded-full border border-neon-purple/30 animate-pulse" />
            )}

            <div className="relative z-10 flex items-center justify-center h-full">
              {status === 'listening' ? (
                <Mic className="w-12 h-12 text-green-400 animate-pulse" />
              ) : status === 'processing' ? (
                <Loader2 className="w-12 h-12 text-yellow-400 animate-spin" />
              ) : status === 'speaking' ? (
                <Volume2 className="w-12 h-12 text-neon-purple animate-pulse" />
              ) : (
                <Mic className="w-12 h-12 text-cyan-400 group-hover:text-white transition-colors" />
              )}
            </div>
          </button>

          <p className={`mt-4 text-sm font-medium ${status === 'error' ? 'text-red-400' : 'text-gray-400'}`}>
            {statusText[status]}
          </p>

          {/* Waveform animation */}
          {(status === 'listening' || status === 'speaking') && (
            <div className="flex items-end gap-1 mt-4 h-8">
              {[...Array(7)].map((_, i) => (
                <motion.div
                  key={i}
                  className={`w-1 rounded-full ${status === 'listening' ? 'bg-green-400' : 'bg-neon-purple'}`}
                  animate={{ height: [8, 20 + Math.random() * 16, 8] }}
                  transition={{ duration: 0.5 + Math.random() * 0.3, repeat: Infinity, delay: i * 0.08 }}
                />
              ))}
            </div>
          )}

          {/* Stop button when speaking */}
          {status === 'speaking' && (
            <button onClick={stopEverything} className="mt-4 flex items-center gap-2 px-5 py-2 rounded-full bg-red-500/20 text-red-400 border border-red-400/30 hover:bg-red-500/30 text-sm">
              <Square className="w-4 h-4" /> Stop Speaking
            </button>
          )}
        </motion.div>

        {/* Transcript & Response */}
        <AnimatePresence>
          {(transcript || response) && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass-card p-6 mb-8 max-w-2xl mx-auto">
              {transcript && (
                <div className="mb-4">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">You said:</span>
                  <p className="text-white mt-1">"{transcript}"</p>
                </div>
              )}
              {response && (
                <div>
                  <span className="text-xs text-cyan-400 uppercase tracking-wider">Navi says:</span>
                  <p className="text-gray-300 mt-1">{response}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <div className="glass-card p-4 mb-8 max-w-2xl mx-auto bg-red-500/5 border-red-500/20">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Conversation History */}
        {history.length > 0 && (
          <div className="max-w-2xl mx-auto mb-8">
            <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-3">Conversation</h3>
            <div className="space-y-3">
              {history.map((h, i) => (
                <div key={i} className="glass-card p-4 bg-white/[0.02]">
                  <p className="text-sm text-gray-300"><span className="text-cyan-400">You:</span> {h.user}</p>
                  <p className="text-sm text-gray-400 mt-1"><span className="text-neon-purple">Navi:</span> {h.navi}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Command Reference */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="max-w-2xl mx-auto">
          <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <HelpCircle className="w-4 h-4" /> Available Commands
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { cmd: '"Describe my surroundings"', desc: 'Get AI-powered scene description' },
              { cmd: '"Read this text"', desc: 'OCR text recognition' },
              { cmd: '"Navigate"', desc: 'Get directions and maps' },
              { cmd: '"Help"', desc: 'List all commands' },
              { cmd: '"Stop"', desc: 'Stop Navi from speaking' },
              { cmd: '"Repeat"', desc: 'Hear the last response again' },
            ].map((c) => (
              <div key={c.cmd} className="glass-card p-3 bg-white/[0.02]">
                <p className="text-cyan-400 text-sm font-medium">{c.cmd}</p>
                <p className="text-gray-500 text-xs mt-0.5">{c.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

