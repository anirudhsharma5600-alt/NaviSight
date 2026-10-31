let speaking = false

export function speak(text: string, lang = 'en-US'): void {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  utterance.rate = 0.9
  utterance.pitch = 1.0
  utterance.onstart = () => { speaking = true }
  utterance.onend = () => { speaking = false }
  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking(): void {
  window.speechSynthesis?.cancel()
  speaking = false
}

export function isSpeaking(): boolean {
  return speaking
}

export function describeDetections(
  detections: Array<{ class: string; position: string; score: number }>
): string {
  if (detections.length === 0) return 'No objects detected in your surroundings.'

  const descriptions = detections
    .filter(d => d.score > 0.5)
    .map(d => {
      const pos = d.position === 'CENTRE' ? 'in the centre' : `on your ${d.position.toLowerCase()}`
      return `${d.class} detected ${pos}`
    })

  if (descriptions.length === 0) return 'No clear objects detected.'
  return descriptions.join('. ') + '.'
}
