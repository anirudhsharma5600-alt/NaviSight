/**
 * NaviAble AI 3.0 — Central Navi Assistant Controller
 * 
 * Facade coordinating:
 * - VoiceEngine 3.0 (Wake-word, Anti-Echo suspension, Barge-in)
 * - NaviConversationManager & CommandRouter
 * - AssistantState reactive bridge
 */

import { AssistantState, type AssistantLanguage } from './AssistantState'
import { VoiceEngine } from './voice/VoiceEngine'
import { VoiceStateManager, type VoiceStateSnapshot } from './voice/VoiceStateManager'
import { NaviConversationManager } from './NaviConversationManager'
import { SpeechOutput } from './voice/SpeechOutput'
import { VoiceLanguageManager } from './voice/VoiceLanguageManager'

class NaviAssistantController {
  private isInitialized = false
  private navigateFn: ((path: string) => void) | null = null

  public init(navigate?: (path: string) => void) {
    if (this.isInitialized) return
    this.navigateFn = navigate || null
    this.isInitialized = true

    // Initialize conversation manager with navigation
    NaviConversationManager.init(this.navigateFn || undefined)

    // Mirror VoiceStateManager snapshots to AssistantState for UI components
    VoiceStateManager.subscribe((snap: VoiceStateSnapshot) => {
      this.syncToAssistantState(snap)
    })

    // Auto-resume if enabled by user
    const state = AssistantState.getState()
    if (state.isEnabled) {
      VoiceEngine.setAlwaysListening(true)
    }
  }

  private syncToAssistantState(snap: VoiceStateSnapshot) {
    let assistantStatus: any = 'idle'
    if (snap.state === 'LISTENING') assistantStatus = 'listening'
    else if (snap.state === 'PROCESSING' || snap.state === 'EXECUTING_COMMAND') assistantStatus = 'processing'
    else if (snap.state === 'SPEAKING') assistantStatus = 'speaking'
    else if (snap.state === 'ERROR') assistantStatus = 'error'

    AssistantState.updateState({
      status: assistantStatus,
      isListening: snap.isMicrophoneActive,
      wakeWordActive: snap.wakeWordDetected,
      language: snap.language,
      lastTranscript: snap.lastTranscript,
      lastResponse: snap.lastResponse,
      lastError: snap.lastError,
      permissionState: snap.permissionState,
      conversation: snap.conversationHistory.map(turn => ({
        id: turn.id,
        sender: turn.speaker,
        text: turn.text,
        timestamp: turn.timestamp,
        intent: turn.intent,
        success: turn.actionSuccess,
      })),
    })
  }

  public setNavigate(navigate: (path: string) => void) {
    this.navigateFn = navigate
    NaviConversationManager.init(navigate)
  }

  /**
   * User enables Navi Voice Assistant (Opt-in toggle)
   */
  public async enableAssistant(): Promise<boolean> {
    AssistantState.updateState({ isEnabled: true })
    const lang = VoiceStateManager.getLanguage()

    const welcome = VoiceLanguageManager.localizeResponse({
      en: "Voice assistant activated. I'm listening.",
      hi: 'आवाज़ सहायक सक्रिय है। मैं सुन रहा हूँ।',
      pa: 'ਆਵਾਜ਼ ਸਹਾਇਕ ਕਿਰਿਆਸ਼ੀਲ ਹੈ। ਮੈਂ ਸੁਣ ਰਿਹਾ ਹਾਂ।',
    })

    VoiceStateManager.addTurn('navi', welcome)
    await SpeechOutput.speak(welcome, 'HIGH')

    return await VoiceEngine.setAlwaysListening(true)
  }

  /**
   * User disables Navi Voice Assistant
   */
  public disableAssistant() {
    VoiceEngine.setAlwaysListening(false)
    SpeechOutput.stopSpeaking()
    AssistantState.updateState({
      isEnabled: false,
      isListening: false,
      wakeWordActive: false,
      status: 'idle',
    })
  }

  /**
   * Direct Tap-to-Talk activation
   */
  public async tapToTalk(): Promise<boolean> {
    return await VoiceEngine.tapToTalk()
  }

  /**
   * Manually process text (e.g. from text fallback input in UI)
   */
  public async handleTranscriptReceived(transcript: string, isFinal: boolean) {
    if (!transcript || !isFinal) return
    await NaviConversationManager.processUtterance(transcript)
  }

  /**
   * Stop speaking immediately (Barge-in / Silence)
   */
  public stopSpeaking() {
    VoiceEngine.interruptSpeech()
  }
}

export const NaviAssistant = new NaviAssistantController()
