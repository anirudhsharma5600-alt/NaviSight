/**
 * NaviAble AI 3.0 — Voice Engine (Central Voice Coordinator)
 * 
 * Orchestrates:
 * - SpeechInput (Recognition) & SpeechOutput (Synthesis).
 * - Anti-Echo loop management (suspends microphone during TTS).
 * - Wake-word recognition ("Hey Navi", "Hello Navi", "हे नवी").
 * - Tap-to-talk and opt-in always-listening modes.
 * - Instant speech interruption (barge-in).
 */

import { SpeechInput } from './SpeechInput'
import { SpeechOutput } from './SpeechOutput'
import { VoiceActivityDetector } from './VoiceActivityDetector'
import { VoiceLanguageManager } from './VoiceLanguageManager'
import { VoiceStateManager, type AssistantLanguage, type VoiceState } from './VoiceStateManager'

type CommandHandler = (transcript: string) => Promise<void>

export class VoiceEngineClass {
  private isInitialized = false
  private commandHandler: CommandHandler | null = null
  private wakeWordWindowTimer: any = null

  private readonly WAKE_PATTERNS = [
    /\b(hey|hay|hi|hello|ok|okay)\s*(navi|navvy|navy|navie)\b/i,
    /\b(हे|हाय|नमस्ते|ओह)\s*(नवी|नेवी|नावी)\b/i,
    /\b(ਹੇ|ਹਾਏ|ਸਤਿ\s*ਸ੍ਰੀ\s*ਅਕਾਲ)\s*(ਨਵੀ|ਨੇਵੀ)\b/i,
  ]

  public init(handler: CommandHandler) {
    if (this.isInitialized) return
    this.commandHandler = handler
    this.isInitialized = true

    // ─── 1. Anti-Echo Feedback Management ───
    SpeechOutput.onSpeechStart(() => {
      // Suspend speech input to prevent Navi from transcribing its own synthesized voice
      SpeechInput.suspendListening()
    })

    SpeechOutput.onSpeechEnd(() => {
      // Re-enable speech input cleanly after acoustic dissipation
      SpeechInput.resumeListening()
      if (VoiceStateManager.getState() === 'SPEAKING') {
        const cur = VoiceStateManager.getSnapshot()
        VoiceStateManager.setState(cur.isWakeWordEnabled || cur.wakeWordDetected ? 'LISTENING' : 'IDLE')
      }
    })

    // ─── 2. Final Transcript Processing ───
    SpeechInput.onFinalTranscript((text) => {
      this.handleFinalTranscript(text)
    })

    // ─── 3. Voice Activity Detection for Barge-In Interruption ───
    VoiceActivityDetector.onSpeechStart(() => {
      if (SpeechOutput.getIsSpeaking()) {
        console.log('[VoiceEngine] User barge-in detected. Interrupting active speech.')
        this.interruptSpeech()
      }
    })
  }

  /**
   * Handle complete final utterance from user
   */
  private async handleFinalTranscript(rawText: string) {
    const text = rawText.trim()
    if (!text) return

    const snapshot = VoiceStateManager.getSnapshot()

    // 1. Check for wake-word if in passive wake-word mode
    if (snapshot.isWakeWordEnabled && !snapshot.wakeWordDetected && snapshot.state !== 'AWAITING_CLARIFICATION') {
      const hasWakeWord = this.WAKE_PATTERNS.some(p => p.test(text))
      if (hasWakeWord) {
        console.log(`[VoiceEngine] Wake phrase detected in: "${text}"`)
        VoiceStateManager.setWakeWordDetected(true)

        // Strip wake phrase to check for inline command (e.g., "Hey Navi open camera")
        let cleanText = text
        for (const p of this.WAKE_PATTERNS) {
          cleanText = cleanText.replace(p, '').trim()
        }

        if (cleanText.length > 2) {
          // Direct inline command following wake word
          await this.executeUserUtterance(cleanText)
          return
        }

        // Acknowledge wake word
        await this.acknowledgeWakeWord(snapshot.language)
        return
      }

      // In passive wake-word standby mode, discard speech without wake word
      return
    }

    // 2. Active command processing
    await this.executeUserUtterance(text)
  }

  private async acknowledgeWakeWord(lang: AssistantLanguage) {
    const prompt = VoiceLanguageManager.localizeResponse({
      en: "Yes, I'm listening.",
      hi: 'हाँ, मैं सुन रहा हूँ।',
      pa: 'ਹਾਂ, ਮੈਂ ਸੁਣ ਰਿਹਾ ਹਾਂ।',
    })

    VoiceStateManager.setState('SPEAKING')
    VoiceStateManager.addTurn('navi', prompt)
    await SpeechOutput.speak(prompt, 'HIGH')

    // Open active command window for 8 seconds
    clearTimeout(this.wakeWordWindowTimer)
    this.wakeWordWindowTimer = setTimeout(() => {
      const cur = VoiceStateManager.getSnapshot()
      if (cur.wakeWordDetected && cur.state === 'LISTENING') {
        VoiceStateManager.setWakeWordDetected(false)
        if (!cur.isWakeWordEnabled) {
          VoiceStateManager.setState('IDLE')
        }
      }
    }, 8000)
  }

  private async executeUserUtterance(text: string) {
    clearTimeout(this.wakeWordWindowTimer)
    VoiceStateManager.setState('PROCESSING')
    VoiceStateManager.addTurn('user', text)

    try {
      if (this.commandHandler) {
        await this.commandHandler(text)
      }
    } catch (err: any) {
      console.error('[VoiceEngine] Command handling error:', err)
      VoiceStateManager.setError(`Error processing command: ${err.message}`)
    } finally {
      VoiceStateManager.setWakeWordDetected(false)
    }
  }

  /**
   * User taps microphone button (Tap-to-Talk)
   */
  public async tapToTalk(): Promise<boolean> {
    const state = VoiceStateManager.getState()

    // If currently speaking, tap immediately silences speech
    if (state === 'SPEAKING' || SpeechOutput.getIsSpeaking()) {
      this.interruptSpeech()
      return true
    }

    // If already listening, tap cancels listening
    if (state === 'LISTENING') {
      SpeechInput.stop()
      VoiceStateManager.setState('IDLE')
      return false
    }

    // Request permission if needed
    const permitted = await SpeechInput.requestMicrophonePermission()
    if (!permitted) return false

    VoiceStateManager.setWakeWordDetected(true)
    VoiceStateManager.setState('LISTENING')
    return SpeechInput.startListening()
  }

  /**
   * Enable or disable opt-in always-listening mode
   */
  public async setAlwaysListening(enabled: boolean): Promise<boolean> {
    VoiceStateManager.setWakeWordEnabled(enabled)

    if (enabled) {
      const permitted = await SpeechInput.requestMicrophonePermission()
      if (!permitted) {
        VoiceStateManager.setWakeWordEnabled(false)
        return false
      }

      VoiceStateManager.setState('LISTENING')
      return SpeechInput.startListening()
    } else {
      SpeechInput.stop()
      VoiceStateManager.setState('IDLE')
      return true
    }
  }

  /**
   * Instantly interrupt Navi speech (Barge-in / Silence)
   */
  public interruptSpeech() {
    SpeechOutput.stopSpeaking()
    VoiceStateManager.setState('INTERRUPTED')
    setTimeout(() => {
      const cur = VoiceStateManager.getSnapshot()
      VoiceStateManager.setState(cur.isWakeWordEnabled ? 'LISTENING' : 'IDLE')
    }, 200)
  }

  public setLanguage(lang: AssistantLanguage) {
    VoiceStateManager.setLanguage(lang)
    if (SpeechInput.getIsListening()) {
      // Restart speech input with new language tag
      SpeechInput.startListening()
    }
  }
}

export const VoiceEngine = new VoiceEngineClass()
