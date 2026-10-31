import { emit } from '../integration/bus'
import { VoiceManager, type AnnouncementPriority } from './VoiceAnnouncementManager'

// ─── Types ───

export type SpeechStatus = 'idle' | 'speaking' | 'paused'
type SpeechListener = (status: SpeechStatus) => void

// ─── Status Management ───

export function setSpeechVolume(vol: number) {
  VoiceManager.setVolume(vol)
}

export function getSpeechVolume(): number {
  return VoiceManager.getVolume()
}

export function onSpeechStatusChange(fn: SpeechListener): () => void {
  return VoiceManager.subscribe((st) => {
    fn(st.isSpeaking ? 'speaking' : 'idle')
  })
}

export function getSpeechStatus(): SpeechStatus {
  return VoiceManager.getStatus().isSpeaking ? 'speaking' : 'idle'
}

// ─── Core Functions ───

export function speak(
  text: string,
  lang = 'en-US',
  volume?: number,
  priority: AnnouncementPriority = 'LOW'
): void {
  if (typeof volume === 'number') {
    VoiceManager.setVolume(volume)
  }

  try { emit('speech', { text, t: performance.now() }) } catch { /* Preserve speech behavior if event reporting fails. */ }
  const langShort = lang.startsWith('hi') ? 'hi' : lang.startsWith('pa') ? 'pa' : 'en'
  VoiceManager.announce(text, priority, {
    lang: langShort,
    force: priority === 'HIGH' || priority === 'MEDIUM',
  })
}

export function queueSpeak(text: string): void {
  speak(text, 'en-US', undefined, 'LOW')
}

export function stopSpeaking(): void {
  VoiceManager.stopAllSpeech()
}

export function pauseSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.pause()
  }
}

export function resumeSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.resume()
  }
}

export function repeatLast(): void {
  VoiceManager.repeatLast()
}

export function getLastSpokenText(): string {
  return VoiceManager.getStatus().lastSpokenText
}

export function isSpeaking(): boolean {
  return VoiceManager.getStatus().isSpeaking
}

// ─── Browser Support Check ───

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function isSpeechRecognitionSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  )
}

// ─── Legacy Compatibility ───

export function describeDetections(
  detections: Array<{ class: string; position: string; score: number }>
): string {
  if (detections.length === 0) return 'No objects detected in your surroundings.'

  const descriptions = detections
    .filter((d) => d.score > 0.45)
    .map((d) => {
      const pos = d.position === 'CENTRE' ? 'in the centre' : `on your ${d.position.toLowerCase()}`
      return `${d.class} detected ${pos}`
    })

  if (descriptions.length === 0) return 'No clear objects detected.'
  return descriptions.join('. ') + '.'
}
