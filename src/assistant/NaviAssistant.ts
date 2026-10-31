/**
 * NaviAble AI 2.0 — Central Navi Assistant Facade
 *
 * Implements the Alexa-like conversational AI controller:
 * 1. Opt-in always-listening mode:
 *    User enables Navi -> Navi says: "Voice assistant activated. I'm listening."
 * 2. Wake-word detection:
 *    User: "Hey Navi."
 *    Navi: "Yes, how can I help?"
 *    User: "Describe what's in front of me."
 *    Navi: Executes real detection and speaks short natural summary.
 * 3. Currency scanning:
 *    User: "Hey Navi, check how much money this is."
 *    Navi: Captures frame, runs MobileNetV3 currency model, speaks: "This is a 500-rupee note."
 * 4. Silence control:
 *    User: "Stop speaking" / "Be quiet" -> Stops audio immediately.
 */

import { AssistantState, type AssistantLanguage, type AssistantStatus } from './AssistantState'
import { VoiceRecognition } from './VoiceRecognition'
import { IntentClassifier } from './IntentClassifier'
import { VoiceCommandRouter } from './VoiceCommandRouter'
import { VoiceResponse } from './VoiceResponse'
import { VoiceManager } from '../services/VoiceAnnouncementManager'

class NaviAssistantController {
  private isInitialized = false
  private navigateFn: ((path: string) => void) | null = null
  private commandTimeout: any = null

  public init(navigate?: (path: string) => void) {
    if (this.isInitialized) return
    this.navigateFn = navigate || null
    this.isInitialized = true

    // Bind VoiceRecognition callbacks
    VoiceRecognition.onWakeWord(() => {
      this.handleWakeWordTriggered()
    })

    VoiceRecognition.onTranscript((transcript, isFinal) => {
      this.handleTranscriptReceived(transcript, isFinal)
    })

    VoiceRecognition.onError((err) => {
      console.warn('[NaviAssistant] Voice recognition error:', err)
      AssistantState.updateState({ status: 'error', lastError: err })
    })

    // If previously enabled by user, resume listening
    const state = AssistantState.getState()
    if (state.isEnabled) {
      VoiceRecognition.startListening(true, state.language)
    }
  }

  public setNavigate(navigate: (path: string) => void) {
    this.navigateFn = navigate
  }

  /**
   * User enables Navi Voice Assistant (Opt-in toggle)
   */
  public async enableAssistant(): Promise<boolean> {
    AssistantState.updateState({ isEnabled: true, status: 'listening' })

    // Unlock speech synthesis on user touch/click
    VoiceManager.unlockVoice()

    const state = AssistantState.getState()
    const welcomeSpeech =
      state.language === 'hi'
        ? 'आवाज़ सहायक सक्रिय है। मैं सुन रहा हूँ।'
        : state.language === 'pa'
        ? 'ਆਵਾਜ਼ ਸਹਾਇਕ ਕਿਰਿਆਸ਼ੀਲ ਹੈ। ਮੈਂ ਸੁਣ ਰਿਹਾ ਹਾਂ।'
        : "Voice assistant activated. I'm listening."

    VoiceManager.announce(welcomeSpeech, 'HIGH', { force: true, lang: state.language })
    AssistantState.addMessage('navi', welcomeSpeech)

    const started = VoiceRecognition.startListening(true, state.language)
    return started
  }

  /**
   * User disables Navi Voice Assistant
   */
  public disableAssistant() {
    VoiceRecognition.stop()
    VoiceManager.stopAllSpeech()
    clearTimeout(this.commandTimeout)
    AssistantState.updateState({
      isEnabled: false,
      isListening: false,
      wakeWordActive: false,
      status: 'idle',
    })
  }

  /**
   * Direct Tap-to-Talk activation (Accessible button fallback)
   */
  public tapToTalk() {
    VoiceManager.unlockVoice()
    const state = AssistantState.getState()

    if (state.isListening && !state.wakeWordActive) {
      // Tap while listening stops
      VoiceRecognition.stop()
      return
    }

    AssistantState.updateState({
      wakeWordActive: true,
      status: 'listening',
    })

    VoiceRecognition.startListening(false, state.language)
  }

  /**
   * "Hey Navi" wake phrase recognized
   */
  private handleWakeWordTriggered() {
    clearTimeout(this.commandTimeout)
    const state = AssistantState.getState()

    // Speak wake acknowledgment prompt: "Yes, how can I help?"
    const prompt = VoiceResponse.getWakeResponse(state.language)
    VoiceManager.announce(prompt, 'HIGH', { force: true, lang: state.language })
    AssistantState.addMessage('navi', prompt)

    AssistantState.updateState({
      wakeWordActive: true,
      status: 'wake_word_detected',
    })

    // Listen for follow-up command for 8 seconds before returning to passive wake-word mode
    this.commandTimeout = setTimeout(() => {
      if (AssistantState.getState().wakeWordActive) {
        console.log('[NaviAssistant] Command window expired; returning to wake-word standby.')
        AssistantState.updateState({
          wakeWordActive: false,
          status: 'listening',
        })
      }
    }, 8000)
  }

  /**
   * Process spoken utterance from user
   */
  public async handleTranscriptReceived(transcript: string, isFinal: boolean) {
    const cleanText = transcript.trim()
    if (!cleanText) return

    const state = AssistantState.getState()

    // If waiting for command after wake word or explicit tap-to-talk
    if (state.wakeWordActive || !state.isEnabled) {
      if (!isFinal) {
        AssistantState.updateState({ lastTranscript: cleanText })
        return
      }

      clearTimeout(this.commandTimeout)
      AssistantState.updateState({
        wakeWordActive: false,
        status: 'processing',
      })

      // Add user transcript to history
      AssistantState.addMessage('user', cleanText)

      // 1. Classify Intent
      const parsedIntent = IntentClassifier.classify(cleanText)
      console.log(`[NaviAssistant] Parsed Intent:`, parsedIntent)

      // 2. Execute Command via Router
      const result = await VoiceCommandRouter.execute(
        parsedIntent,
        state.language,
        this.navigateFn || undefined
      )

      // 3. Announce Response
      if (result.spokenText) {
        AssistantState.addMessage('navi', result.spokenText, parsedIntent.intent, result.success)
        AssistantState.updateState({ status: 'speaking' })
        VoiceManager.announce(result.spokenText, 'HIGH', {
          force: true,
          lang: state.language,
        })
      }

      // Resume passive wake-word listening if assistant is enabled
      setTimeout(() => {
        const cur = AssistantState.getState()
        if (cur.isEnabled) {
          VoiceRecognition.startListening(true, cur.language)
        } else {
          AssistantState.updateState({ status: 'idle' })
        }
      }, 1000)
    }
  }

  public stopSpeaking() {
    VoiceManager.stopAllSpeech()
    AssistantState.updateState({ status: 'idle' })
  }
}

export const NaviAssistant = new NaviAssistantController()
