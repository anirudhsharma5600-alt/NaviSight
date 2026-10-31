import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Volume2, Square, HelpCircle, Loader2, Eye, Camera, BookOpen } from 'lucide-react'
import { speak, stopSpeaking, repeatLast, getLastSpokenText } from '../../services/speechService'
import { generateSceneDescription } from '../../services/contextEngine'
import { getLatestDetections, naviEmit } from '../../services/naviEventBus'
import { getFullStatus } from '../../services/modelManager'

type Status = 'idle' | 'listening' | 'processing' | 'speaking' | 'error'

// Check browser support
const SpeechRecognitionAPI =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

// ─── Intent Matching ───

interface Intent {
  name: string
  patterns: RegExp[]
  handler: () => string
}

function createIntents(navigate: (path: string) => void): Intent[] {
  return [
    {
      name: 'greet',
      patterns: [/\b(hello|hi|hey)\b/i],
      handler: () =>
        "Hello! I'm Navi, your AI accessibility assistant. I can describe your surroundings, read text, and help you navigate. Say 'help' to learn more!",
    },
    {
      name: 'help',
      patterns: [/\b(help|commands?|what can you|what do you)\b/i],
      handler: () =>
        "Here's what I can do: Say 'describe surroundings' to know what's around you. " +
        "Say 'what objects' to list detected objects. " +
        "Say 'start camera' or 'stop camera' to control the camera. " +
        "Say 'read text' to go to the OCR reader. " +
        "Say 'navigate' for directions. " +
        "Say 'status' to check AI system status. " +
        "Say 'stop' to silence me. Say 'repeat' to hear my last response.",
    },
    {
      name: 'describe_surroundings',
      patterns: [
        /\b(describe|surroundings?|what.*see|what.*around|what.*front|scene|environment)\b/i,
      ],
      handler: () => {
        const detections = getLatestDetections()
        if (detections.length === 0) {
          return "I don't see any objects right now. Make sure the camera is active on the AI Vision Dashboard. Say 'start camera' to turn it on."
        }
        const scene = generateSceneDescription(detections)
        return scene.text
      },
    },
    {
      name: 'what_objects',
      patterns: [/\b(what objects|list.*objects|nearby|what.*detect|objects.*near)\b/i],
      handler: () => {
        const detections = getLatestDetections()
        if (detections.length === 0) {
          return "No objects detected right now. Make sure the camera is active."
        }
        const items = detections.map(
          (d) =>
            `${d.class} (${Math.round(d.score * 100)}% confidence, ${d.position.toLowerCase()})`
        )
        return `I can see ${detections.length} object${detections.length > 1 ? 's' : ''}: ${items.join(', ')}.`
      },
    },
    {
      name: 'find_object',
      patterns: [/\b(find|where.*is|look.*for|locate)\s+(?:a\s+|the\s+)?(\w+)/i],
      handler: () => {
        // We'll extract the object name in processCommand
        return '' // Handled specially below
      },
    },
    {
      name: 'start_camera',
      patterns: [/\b(start|open|turn on|enable).*camera\b/i],
      handler: () => {
        naviEmit('camera:start')
        return "Starting the camera now. I'll begin detecting objects once the AI model is ready."
      },
    },
    {
      name: 'stop_camera',
      patterns: [/\b(stop|close|turn off|disable).*camera\b/i],
      handler: () => {
        naviEmit('camera:stop')
        return 'Camera stopped. Say "start camera" to turn it back on.'
      },
    },
    {
      name: 'read_text',
      patterns: [/\b(read|text|sign|ocr|scan|label)\b/i],
      handler: () => {
        navigate('/ocr')
        return "Opening the Smart OCR Reader. You can capture text from signs, labels, and documents there."
      },
    },
    {
      name: 'proximity_alerts',
      patterns: [/\b(proximity|distance|how close|beep|alarm)\b/i],
      handler: () => {
        navigate('/proximity')
        return "Opening Proximity Alerts. You will hear dynamic audio beeps and vibration warnings as objects approach."
      },
    },
    {
      name: 'currency_reader',
      patterns: [/\b(currency|rupee|note|money|cash|banknote)\b/i],
      handler: () => {
        navigate('/currency')
        return "Opening Indian Currency Reader. Point your camera at a banknote to inspect its denomination."
      },
    },
    {
      name: 'pothole_detection',
      patterns: [/\b(pothole|potholes|road hazard|crack|road damage)\b/i],
      handler: () => {
        navigate('/pothole')
        return "Opening Road Hazard Detection. You can monitor the road ahead for potholes, cracks, and obstacles."
      },
    },
    {
      name: 'navigate',
      patterns: [/\b(navigate|direction|where|map|location|gps)\b/i],
      handler: () => {
        navigate('/navigation')
        return "Opening the Navigation page. You can see your location and search for destinations there."
      },
    },
    {
      name: 'go_dashboard',
      patterns: [/\b(dashboard|vision|detection|camera.*page)\b/i],
      handler: () => {
        navigate('/dashboard')
        return 'Opening the AI Vision Dashboard.'
      },
    },
    {
      name: 'status',
      patterns: [/\b(status|system|health|check)\b/i],
      handler: () => {
        const s = getFullStatus()
        const lines: string[] = []
        lines.push(`Object detection: ${s.objectDetection}.`)
        lines.push(`Camera: ${s.camera}.`)
        lines.push(`Voice recognition: ${s.voiceRecognition}.`)
        lines.push(`Text to speech: ${s.textToSpeech}.`)
        lines.push(`OCR engine: ${s.ocrEngine}.`)
        return `AI System Status. ${lines.join(' ')}`
      },
    },
    {
      name: 'stop',
      patterns: [/\b(stop|quiet|silence|shut|hush|mute)\b/i],
      handler: () => {
        stopSpeaking()
        return "Okay, I'll be quiet now."
      },
    },
    {
      name: 'repeat',
      patterns: [/\b(repeat|again|say.*again|what.*say)\b/i],
      handler: () => {
        const last = getLastSpokenText()
        if (last) {
          repeatLast()
          return last
        }
        return "I haven't said anything yet."
      },
    },
    {
      name: 'thanks',
      patterns: [/\b(thank|thanks|thank you)\b/i],
      handler: () => "You're welcome! I'm always here to help.",
    },
    {
      name: 'identity',
      patterns: [/\b(who.*you|your.*name|introduce)\b/i],
      handler: () =>
        "I'm Navi, your AI-powered accessibility assistant built by NaviAble AI. I help visually impaired people understand their surroundings using computer vision, voice interaction, and smart navigation.",
    },
  ]
}

export default function VoiceAssistant() {
  const [status, setStatus] = useState<Status>('idle')
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [error, setError] = useState('')
  const [history, setHistory] = useState<Array<{ user: string; navi: string; time: string }>>([])
  const recognitionRef = useRef<any>(null)
  const [detectionCount, setDetectionCount] = useState(0)

  // Poll detection count for display
  useEffect(() => {
    const interval = setInterval(() => {
      setDetectionCount(getLatestDetections().length)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Simple navigate function (uses window.location for lazy-loaded routes)
  const navigateTo = useCallback((path: string) => {
    // Use pushState + dispatch to trigger React Router
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, [])

  const intents = useRef(createIntents(navigateTo)).current

  const processCommand = useCallback(
    (text: string): string => {
      const lower = text.toLowerCase().trim()

      // Special: "find <object>" pattern
      const findMatch = lower.match(
        /\b(?:find|where.*is|look.*for|locate)\s+(?:a\s+|the\s+)?(\w+)/i
      )
      if (findMatch) {
        const target = findMatch[1]
        const detections = getLatestDetections()
        const found = detections.filter(
          (d) => d.class.toLowerCase().includes(target)
        )
        if (found.length > 0) {
          const positions = found.map(
            (d) => `${d.position.toLowerCase()} (${Math.round(d.score * 100)}%)`
          )
          return `I found ${found.length} ${target}${found.length > 1 ? 's' : ''}: ${positions.join(', ')}.`
        }
        return `I don't see any ${target} right now. Make sure the camera is active and pointing at the area.`
      }

      // Try each intent
      for (const intent of intents) {
        if (intent.name === 'find_object') continue // handled above
        for (const pattern of intent.patterns) {
          if (pattern.test(lower)) {
            return intent.handler()
          }
        }
      }

      return `I heard: "${text}". I'm not sure what you need. Say 'help' to learn what I can do!`
    },
    [intents]
  )

  const speakResponse = useCallback((text: string) => {
    setStatus('speaking')
    speak(text)
    // Listen for speech end to reset status
    const checkInterval = setInterval(() => {
      if (!window.speechSynthesis?.speaking) {
        setStatus('idle')
        clearInterval(checkInterval)
      }
    }, 200)
  }, [])

  const startListening = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      setError(
        'Speech recognition is not supported in this browser. Please use Chrome or Edge.'
      )
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

        const now = new Date()
        const timeStr = now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
        setHistory((prev) => [
          ...prev.slice(-9),
          { user: text, navi: reply, time: timeStr },
        ])

        setTimeout(() => speakResponse(reply), 300)
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        setError('No speech detected. Please try again.')
      } else if (event.error === 'not-allowed') {
        setError(
          'Microphone permission denied. Please allow microphone access.'
        )
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
    stopSpeaking()
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            Navi <span className="gradient-text">Voice Assistant</span>
          </h1>
          <p className="text-gray-400">
            Your intelligent AI companion — just talk!
          </p>
        </motion.div>

        {/* Live Detection Indicator */}
        <div className="flex justify-center mb-6">
          <div className="glass-card px-4 py-2 flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-gray-400">
                Live Objects:{' '}
                <span className={detectionCount > 0 ? 'text-cyan-400' : 'text-gray-600'}>
                  {detectionCount}
                </span>
              </span>
            </div>
            <span className="text-gray-700">|</span>
            <span className="text-gray-500">
              Say{' '}
              <span className="text-cyan-400">"describe surroundings"</span> to
              use live AI
            </span>
          </div>
        </div>

        {/* Main Mic Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col items-center mb-12"
        >
          <button
            onClick={
              status === 'idle' || status === 'error'
                ? startListening
                : stopEverything
            }
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

          <p
            className={`mt-4 text-sm font-medium ${status === 'error' ? 'text-red-400' : 'text-gray-400'}`}
          >
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
                  transition={{
                    duration: 0.5 + Math.random() * 0.3,
                    repeat: Infinity,
                    delay: i * 0.08,
                  }}
                />
              ))}
            </div>
          )}

          {/* Stop button when speaking */}
          {status === 'speaking' && (
            <button
              onClick={stopEverything}
              className="mt-4 flex items-center gap-2 px-5 py-2 rounded-full bg-red-500/20 text-red-400 border border-red-400/30 hover:bg-red-500/30 text-sm"
            >
              <Square className="w-4 h-4" /> Stop Speaking
            </button>
          )}
        </motion.div>

        {/* Transcript & Response */}
        <AnimatePresence>
          {(transcript || response) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="glass-card p-6 mb-8 max-w-2xl mx-auto"
            >
              {transcript && (
                <div className="mb-4">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">
                    You said:
                  </span>
                  <p className="text-white mt-1">"{transcript}"</p>
                </div>
              )}
              {response && (
                <div>
                  <span className="text-xs text-cyan-400 uppercase tracking-wider">
                    Navi says:
                  </span>
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
            <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-3">
              Conversation History
            </h3>
            <div className="space-y-3">
              {history.map((h, i) => (
                <div key={i} className="glass-card p-4 bg-white/[0.02]">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-sm text-gray-300">
                      <span className="text-cyan-400">You:</span> {h.user}
                    </p>
                    <span className="text-xs text-gray-600 ml-2 flex-shrink-0">
                      {h.time}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    <span className="text-neon-purple">Navi:</span> {h.navi}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Command Reference */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto"
        >
          <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <HelpCircle className="w-4 h-4" /> Available Commands
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                cmd: '"Describe my surroundings"',
                desc: 'AI-powered scene description from live camera',
                icon: Eye,
              },
              {
                cmd: '"What objects are nearby?"',
                desc: 'List all detected objects with positions',
                icon: Eye,
              },
              {
                cmd: '"Find a chair"',
                desc: 'Locate a specific object in the camera view',
                icon: Eye,
              },
              {
                cmd: '"Start / Stop camera"',
                desc: 'Control the camera remotely',
                icon: Camera,
              },
              {
                cmd: '"Read this text"',
                desc: 'Go to OCR text recognition',
                icon: BookOpen,
              },
              {
                cmd: '"Proximity alerts"',
                desc: 'Open proximity detection & audio beeps',
                icon: Eye,
              },
              {
                cmd: '"Read currency"',
                desc: 'Identify Indian currency notes',
                icon: BookOpen,
              },
              {
                cmd: '"Detect potholes"',
                desc: 'Scan road for surface hazards',
                icon: Eye,
              },
              {
                cmd: '"Help"',
                desc: 'List all available commands',
                icon: HelpCircle,
              },
              {
                cmd: '"Status"',
                desc: 'Check AI system health',
                icon: HelpCircle,
              },
              {
                cmd: '"Stop" / "Repeat"',
                desc: 'Control Navi voice output',
                icon: Volume2,
              },
            ].map((c) => (
              <div key={c.cmd} className="glass-card p-3 bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-0.5">
                  <c.icon className="w-3.5 h-3.5 text-cyan-400/60 flex-shrink-0" />
                  <p className="text-cyan-400 text-sm font-medium">{c.cmd}</p>
                </div>
                <p className="text-gray-500 text-xs ml-5.5">{c.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
