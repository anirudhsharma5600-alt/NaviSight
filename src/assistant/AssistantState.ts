/**
 * NaviAble AI 2.0 — Navi Voice Assistant State Store
 *
 * Provides reactive state management for the Alexa-like Navi Assistant:
 * - Status: idle, listening, wake_word_detected, processing, speaking, error
 * - Audio state: volume, rate, language (English, Hindi, Punjabi)
 * - Wake-word listening toggle (Opt-in)
 * - Command & response interaction history
 * - Subscriber notification pattern for real-time UI components
 */

export type AssistantStatus =
  | 'idle'
  | 'listening'
  | 'wake_word_detected'
  | 'processing'
  | 'speaking'
  | 'error'

export type AssistantLanguage = 'en' | 'hi' | 'pa'

export interface AssistantMessage {
  id: string
  sender: 'user' | 'navi'
  text: string
  intent?: string
  timestamp: number
  success?: boolean
}

export interface AssistantStateData {
  status: AssistantStatus
  isEnabled: boolean // Master opt-in toggle
  isListening: boolean // Currently recording/listening for wake-word or command
  wakeWordActive: boolean // "Hey Navi" recognized, waiting for command
  language: AssistantLanguage
  volume: number // 0.0 - 1.0
  rate: number // 0.8 - 1.2
  lastTranscript: string
  lastResponse: string
  lastError: string | null
  conversation: AssistantMessage[]
  permissionState: 'granted' | 'denied' | 'prompt' | 'unsupported'
  supportsContinuous: boolean
}

type StateListener = (state: AssistantStateData) => void

class AssistantStateManager {
  private listeners: Set<StateListener> = new Set()

  private state: AssistantStateData = {
    status: 'idle',
    isEnabled: false,
    isListening: false,
    wakeWordActive: false,
    language: 'en',
    volume: 1.0,
    rate: 0.95,
    lastTranscript: '',
    lastResponse: '',
    lastError: null,
    conversation: [
      {
        id: 'welcome',
        sender: 'navi',
        text: "Hello! I am Navi. Say 'Hey Navi' or tap the microphone to talk to me.",
        timestamp: Date.now(),
        success: true,
      },
    ],
    permissionState: 'prompt',
    supportsContinuous: false,
  }

  constructor() {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('navi_assistant_lang') as AssistantLanguage
      if (savedLang && ['en', 'hi', 'pa'].includes(savedLang)) {
        this.state.language = savedLang
      }
      const savedEnabled = localStorage.getItem('navi_assistant_enabled') === 'true'
      this.state.isEnabled = savedEnabled
    }
  }

  public getState(): AssistantStateData {
    return { ...this.state, conversation: [...this.state.conversation] }
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener)
    listener(this.getState())
    return () => {
      this.listeners.delete(listener)
    }
  }

  public updateState(partial: Partial<AssistantStateData>) {
    this.state = { ...this.state, ...partial }
    if (partial.language) {
      try {
        localStorage.setItem('navi_assistant_lang', partial.language)
      } catch {}
    }
    if (partial.isEnabled !== undefined) {
      try {
        localStorage.setItem('navi_assistant_enabled', String(partial.isEnabled))
      } catch {}
    }
    this.notify()
  }

  public addMessage(sender: 'user' | 'navi', text: string, intent?: string, success = true) {
    const msg: AssistantMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      sender,
      text,
      intent,
      timestamp: Date.now(),
      success,
    }
    this.state.conversation.push(msg)
    if (this.state.conversation.length > 50) {
      this.state.conversation.shift()
    }
    if (sender === 'user') {
      this.state.lastTranscript = text
    } else {
      this.state.lastResponse = text
    }
    this.notify()
  }

  public clearHistory() {
    this.state.conversation = []
    this.notify()
  }

  private notify() {
    const currentState = this.getState()
    this.listeners.forEach((listener) => {
      try {
        listener(currentState)
      } catch (err) {
        console.error('[AssistantState] Listener error:', err)
      }
    })
  }
}

export const AssistantState = new AssistantStateManager()
