// ─── Types ───

export type SpeechStatus = 'idle' | 'speaking' | 'paused'
type SpeechListener = (status: SpeechStatus) => void

// ─── State ───

let status: SpeechStatus = 'idle'
let lastSpokenText = ''
let currentUtterance: SpeechSynthesisUtterance | null = null
const speechQueue: string[] = []
let processing = false
const listeners: Set<SpeechListener> = new Set()

// ─── Status Management ───

function setStatus(s: SpeechStatus) {
  status = s
  listeners.forEach(fn => fn(s))
}

export function onSpeechStatusChange(fn: SpeechListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getSpeechStatus(): SpeechStatus {
  return status
}

// ─── Core Functions ───

export function speak(text: string, lang = 'en-US'): void {
  if (!window.speechSynthesis) {
    console.warn('[Speech] SpeechSynthesis not supported')
    return
  }
  if (!text.trim()) return

  window.speechSynthesis.cancel()
  speechQueue.length = 0 // Clear queue on new speak

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  utterance.rate = 0.9
  utterance.pitch = 1.0

  utterance.onstart = () => {
    setStatus('speaking')
    lastSpokenText = text
  }
  utterance.onend = () => {
    currentUtterance = null
    processQueue()
  }
  utterance.onerror = () => {
    currentUtterance = null
    setStatus('idle')
  }

  currentUtterance = utterance
  window.speechSynthesis.speak(utterance)
}

export function queueSpeak(text: string): void {
  if (!text.trim()) return
  speechQueue.push(text)
  if (!processing && status === 'idle') {
    processQueue()
  }
}

function processQueue(): void {
  if (speechQueue.length === 0) {
    processing = false
    setStatus('idle')
    return
  }
  processing = true
  const next = speechQueue.shift()!
  speak(next)
}

export function stopSpeaking(): void {
  window.speechSynthesis?.cancel()
  speechQueue.length = 0
  currentUtterance = null
  processing = false
  setStatus('idle')
}

export function pauseSpeaking(): void {
  window.speechSynthesis?.pause()
  setStatus('paused')
}

export function resumeSpeaking(): void {
  window.speechSynthesis?.resume()
  setStatus('speaking')
}

export function repeatLast(): void {
  if (lastSpokenText) {
    speak(lastSpokenText)
  }
}

export function getLastSpokenText(): string {
  return lastSpokenText
}

export function isSpeaking(): boolean {
  return status === 'speaking'
}

// ─── Browser Support Check ───

export function isSpeechSynthesisSupported(): boolean {
  return 'speechSynthesis' in window
}

export function isSpeechRecognitionSupported(): boolean {
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
}

// ─── Legacy Compatibility ───

export function describeDetections(
  detections: Array<{ class: string; position: string; score: number }>
): string {
  if (detections.length === 0) return 'No objects detected in your surroundings.'

  const descriptions = detections
    .filter(d => d.score > 0.45)
    .map(d => {
      const pos = d.position === 'CENTRE' ? 'in the centre' : `on your ${d.position.toLowerCase()}`
      return `${d.class} detected ${pos}`
    })

  if (descriptions.length === 0) return 'No clear objects detected.'
  return descriptions.join('. ') + '.'
}
