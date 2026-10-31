/**
 * NaviAble AI 3.0 — Navi Conversation Manager
 * 
 * Bridges natural conversational AI (Gemini Live Multimodal Companion)
 * with the deterministic on-device Command Router and Voice State Machine.
 */

import { VoiceEngine } from './voice/VoiceEngine'
import { IntentClassifier } from './commands/IntentClassifier'
import { CommandRouter } from './commands/CommandRouter'
import { CommandExecutor } from './commands/CommandExecutor'
import { VoiceStateManager } from './voice/VoiceStateManager'
import { NaviLiveSession } from './NaviLiveSession'

export class NaviConversationManagerClass {
  private isInitialized = false

  public init(navigate?: (path: string) => void) {
    if (this.isInitialized) return
    this.isInitialized = true

    if (navigate) {
      CommandExecutor.setNavigate(navigate)
    }

    // Initialize VoiceEngine with conversation handler
    VoiceEngine.init(async (transcript) => {
      await this.processUtterance(transcript)
    })
  }

  /**
   * Process incoming user voice transcript
   */
  public async processUtterance(rawText: string): Promise<string> {
    const text = (rawText || '').trim()
    if (!text) return ''

    // 1. First run on-device IntentClassifier
    const parsedIntent = IntentClassifier.classify(text)

    // Emergency silence command always bypasses cloud
    if (parsedIntent.intent === 'ASSISTANT_STOP_SPEAKING') {
      await CommandRouter.route(parsedIntent)
      return ''
    }

    // 2. If confidence is high or intent is an exact application operation, execute deterministically
    if (parsedIntent.confidence >= 0.75 || parsedIntent.intent !== 'UNKNOWN_QUERY') {
      const res = await CommandRouter.route(parsedIntent)
      return res.spokenResponse
    }

    // 3. If Gemini Live session is configured with an API key, use multimodal companion for conversational nuance
    if (NaviLiveSession.getApiKey()) {
      try {
        console.log('[ConversationManager] Delegating query to Gemini Live:', text)
        const spoken = await NaviLiveSession.sendMessage(text)
        VoiceStateManager.addTurn('navi', spoken, 'GEMINI_CONVERSATIONAL', true)
        return spoken
      } catch (err) {
        console.warn('[ConversationManager] Gemini Live request failed, using on-device fallback:', err)
      }
    }

    // 4. Fallback to on-device command routing for unknown/low-confidence query
    const fallbackRes = await CommandRouter.route(parsedIntent)
    return fallbackRes.spokenResponse
  }
}

export const NaviConversationManager = new NaviConversationManagerClass()
