/**
 * NaviAble AI 3.0 — Voice State Manager
 * 
 * Single authoritative state machine managing all voice states:
 * IDLE, REQUESTING_PERMISSION, LISTENING, PROCESSING, AWAITING_CLARIFICATION,
 * EXECUTING_COMMAND, SPEAKING, INTERRUPTED, RECONNECTING, ERROR.
 */

export type VoiceState =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'LISTENING'
  | 'PROCESSING'
  | 'AWAITING_CLARIFICATION'
  | 'EXECUTING_COMMAND'
  | 'SPEAKING'
  | 'INTERRUPTED'
  | 'RECONNECTING'
  | 'ERROR'

export type AssistantLanguage = 'en' | 'hi' | 'pa'

export interface ConversationTurn {
  id: string
  speaker: 'user' | 'navi'
  text: string
  timestamp: number
  intent?: string
  confidence?: number
  actionSuccess?: boolean
}

export interface VoiceStateSnapshot {
  state: VoiceState
  isWakeWordEnabled: boolean
  wakeWordDetected: boolean
  language: AssistantLanguage
  isMicrophoneActive: boolean
  permissionState: 'prompt' | 'granted' | 'denied' | 'unsupported'
  lastTranscript: string
  interimTranscript: string
  lastResponse: string
  lastError: string | null
  clarificationPrompt: string | null
  pendingAction: { intent: string; params?: Record<string, any> } | null
  conversationHistory: ConversationTurn[]
}

type StateListener = (snapshot: VoiceStateSnapshot) => void

class VoiceStateManagerClass {
  private state: VoiceState = 'IDLE'
  private isWakeWordEnabled = false
  private wakeWordDetected = false
  private language: AssistantLanguage = 'en'
  private isMicrophoneActive = false
  private permissionState: 'prompt' | 'granted' | 'denied' | 'unsupported' = 'prompt'
  private lastTranscript = ''
  private interimTranscript = ''
  private lastResponse = ''
  private lastError: string | null = null
  private clarificationPrompt: string | null = null
  private pendingAction: { intent: string; params?: Record<string, any> } | null = null
  private conversationHistory: ConversationTurn[] = []
  private listeners: Set<StateListener> = new Set()

  constructor() {
    if (typeof window !== 'undefined') {
      const storedLang = localStorage.getItem('naviable_voice_language') as AssistantLanguage
      if (storedLang === 'en' || storedLang === 'hi' || storedLang === 'pa') {
        this.language = storedLang
      }
      const storedWake = localStorage.getItem('naviable_wake_word_enabled')
      this.isWakeWordEnabled = storedWake === 'true'
    }
  }

  public getSnapshot(): VoiceStateSnapshot {
    return {
      state: this.state,
      isWakeWordEnabled: this.isWakeWordEnabled,
      wakeWordDetected: this.wakeWordDetected,
      language: this.language,
      isMicrophoneActive: this.isMicrophoneActive,
      permissionState: this.permissionState,
      lastTranscript: this.lastTranscript,
      interimTranscript: this.interimTranscript,
      lastResponse: this.lastResponse,
      lastError: this.lastError,
      clarificationPrompt: this.clarificationPrompt,
      pendingAction: this.pendingAction ? { ...this.pendingAction } : null,
      conversationHistory: [...this.conversationHistory],
    }
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener)
    listener(this.getSnapshot())
    return () => this.listeners.delete(listener)
  }

  private notify() {
    const snapshot = this.getSnapshot()
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot)
      } catch (err) {
        console.error('[VoiceStateManager] Listener error:', err)
      }
    })
  }

  public setState(newState: VoiceState) {
    if (this.state === newState) return
    console.log(`[VoiceState] Transition: ${this.state} -> ${newState}`)
    this.state = newState
    if (newState !== 'ERROR') {
      this.lastError = null
    }
    this.notify()
  }

  public getState(): VoiceState {
    return this.state
  }

  public setMicrophoneActive(active: boolean) {
    this.isMicrophoneActive = active
    this.notify()
  }

  public setPermissionState(perm: 'prompt' | 'granted' | 'denied' | 'unsupported') {
    this.permissionState = perm
    this.notify()
  }

  public setWakeWordEnabled(enabled: boolean) {
    this.isWakeWordEnabled = enabled
    if (typeof window !== 'undefined') {
      localStorage.setItem('naviable_wake_word_enabled', enabled ? 'true' : 'false')
    }
    this.notify()
  }

  public setWakeWordDetected(detected: boolean) {
    this.wakeWordDetected = detected
    if (detected) {
      this.state = 'LISTENING'
    }
    this.notify()
  }

  public setLanguage(lang: AssistantLanguage) {
    this.language = lang
    if (typeof window !== 'undefined') {
      localStorage.setItem('naviable_voice_language', lang)
    }
    this.notify()
  }

  public getLanguage(): AssistantLanguage {
    return this.language
  }

  public setInterimTranscript(interim: string) {
    this.interimTranscript = interim
    this.notify()
  }

  public setFinalTranscript(finalText: string) {
    this.lastTranscript = finalText
    this.interimTranscript = ''
    this.notify()
  }

  public setClarification(prompt: string, pendingAction: { intent: string; params?: Record<string, any> }) {
    this.clarificationPrompt = prompt
    this.pendingAction = pendingAction
    this.state = 'AWAITING_CLARIFICATION'
    this.notify()
  }

  public clearClarification() {
    this.clarificationPrompt = null
    this.pendingAction = null
    this.notify()
  }

  public setError(errorMsg: string) {
    this.lastError = errorMsg
    this.state = 'ERROR'
    this.notify()
  }

  public addTurn(speaker: 'user' | 'navi', text: string, intent?: string, actionSuccess?: boolean) {
    const turn: ConversationTurn = {
      id: 'turn_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      speaker,
      text: text.trim(),
      timestamp: Date.now(),
      intent,
      actionSuccess,
    }
    this.conversationHistory.push(turn)
    // Keep last 40 turns in memory
    if (this.conversationHistory.length > 40) {
      this.conversationHistory.shift()
    }
    if (speaker === 'navi') {
      this.lastResponse = text
    }
    this.notify()
  }

  public resetSession() {
    this.state = 'IDLE'
    this.wakeWordDetected = false
    this.interimTranscript = ''
    this.lastError = null
    this.clarificationPrompt = null
    this.pendingAction = null
    this.notify()
  }
}

export const VoiceStateManager = new VoiceStateManagerClass()
