/**
 * NaviAble AI 2.0 — Voice Recognition & Wake-Word Engine
 *
 * Implements cross-browser Speech Recognition for desktop & mobile:
 * - Detects 'SpeechRecognition' / 'webkitSpeechRecognition'
 * - Wake-word recognition ("Hey Navi" / "हे नवी" / "ਹੇ ਨਵੀ")
 * - Opt-in listening mode with visible indicator
 * - Accessible tap-to-talk fallback when continuous mode is blocked/unsupported
 * - Self-healing connection with crash backoff (no infinite loops)
 * - Transparent microphone permission handling
 */

import { AssistantState, type AssistantLanguage } from './AssistantState'

type RecognitionCallback = (transcript: string, isFinal: boolean) => void
type WakeWordCallback = () => void
type ErrorCallback = (error: string) => void

interface IWindowWithSpeech extends Window {
  SpeechRecognition?: any
  webkitSpeechRecognition?: any
}

export class VoiceRecognitionEngine {
  private recognition: any = null
  private isRunning = false
  private isWakeWordMode = false
  private consecutiveErrors = 0
  private restartTimeout: any = null
  private onTranscriptCallback: RecognitionCallback | null = null
  private onWakeWordCallback: WakeWordCallback | null = null
  private onErrorCallback: ErrorCallback | null = null

  // Wake phrase variations in English, Hindi, and Punjabi
  private readonly WAKE_PATTERNS = [
    /\b(hey|hay|hi|hello|ok|okay)\s*(navi|navvy|navy|navie)\b/i,
    /\b(हे|हाय|नमस्ते)\s*(नवी|नेवी|नावी)\b/i,
    /\b(ਹੇ|ਹਾਏ)\s*(ਨਵੀ|ਨੇਵੀ)\b/i,
    /\b(navi|नवी|ਨਵੀ)\b/i,
  ]

  constructor() {
    this.initEngine()
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false
    const win = window as IWindowWithSpeech
    return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition)
  }

  private initEngine() {
    if (!this.isSupported()) {
      AssistantState.updateState({
        supportsContinuous: false,
        permissionState: 'unsupported',
        lastError: 'Speech recognition is not supported in this browser.',
      })
      return
    }

    const win = window as IWindowWithSpeech
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition

    try {
      this.recognition = new SpeechRecognitionClass()
      this.recognition.continuous = true
      this.recognition.interimResults = true
      this.recognition.maxAlternatives = 1

      this.setupHandlers()
      AssistantState.updateState({ supportsContinuous: true })
    } catch (err: any) {
      console.warn('[VoiceRecognition] Init failed:', err)
      AssistantState.updateState({
        supportsContinuous: false,
        lastError: err?.message || 'Could not instantiate speech recognition',
      })
    }
  }

  private setupHandlers() {
    if (!this.recognition) return

    this.recognition.onstart = () => {
      this.isRunning = true
      this.consecutiveErrors = 0
      AssistantState.updateState({
        isListening: true,
        status: this.isWakeWordMode ? 'listening' : 'listening',
        lastError: null,
      })
      console.log('[VoiceRecognition] Engine started listening.')
    }

    this.recognition.onresult = (event: any) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i]
        const text = item[0].transcript.trim()
        if (item.isFinal) {
          final += (final ? ' ' : '') + text
        } else {
          interim += (interim ? ' ' : '') + text
        }
      }

      const activeText = final || interim
      if (!activeText) return

      // Wake-word checking in opt-in always-listening mode
      if (this.isWakeWordMode) {
        const isWake = this.checkWakeWord(activeText)
        if (isWake) {
          console.log(`[VoiceRecognition] Wake phrase detected in: "${activeText}"`)
          AssistantState.updateState({
            wakeWordActive: true,
            status: 'wake_word_detected',
          })
          if (this.onWakeWordCallback) {
            this.onWakeWordCallback()
          }

          // Strip wake word from remaining utterance if present
          const cleanText = this.stripWakeWord(activeText)
          if (cleanText.trim().length > 2 && this.onTranscriptCallback) {
            this.onTranscriptCallback(cleanText, true)
          }
          return
        }
      }

      // Standard command transcript delivery
      if (this.onTranscriptCallback) {
        this.onTranscriptCallback(final || interim, Boolean(final))
      }
    }

    this.recognition.onerror = (event: any) => {
      const err = event.error
      console.warn('[VoiceRecognition] Recognition event error:', err)

      if (err === 'not-allowed') {
        this.isRunning = false
        AssistantState.updateState({
          permissionState: 'denied',
          isListening: false,
          status: 'error',
          lastError: 'Microphone permission denied. Please allow microphone access in your browser settings.',
        })
        if (this.onErrorCallback) this.onErrorCallback('Microphone permission denied')
        return
      }

      if (err === 'no-speech') {
        // Natural timeout with no spoken input, harmless in wake-word mode
        return
      }

      this.consecutiveErrors++
      if (this.consecutiveErrors >= 4) {
        console.warn('[VoiceRecognition] Consecutive errors threshold reached; stopping.')
        this.stop()
        AssistantState.updateState({
          status: 'error',
          lastError: `Voice recognition interrupted (${err}). Tap microphone to retry.`,
        })
      }
    }

    this.recognition.onend = () => {
      this.isRunning = false
      AssistantState.updateState({ isListening: false })

      // In wake-word opt-in mode, auto-restart cleanly if assistant is enabled
      const state = AssistantState.getState()
      if (state.isEnabled && this.isWakeWordMode && this.consecutiveErrors < 4) {
        clearTimeout(this.restartTimeout)
        this.restartTimeout = setTimeout(() => {
          if (AssistantState.getState().isEnabled && !this.isRunning) {
            this.startListening(true)
          }
        }, 600)
      } else {
        if (state.status === 'listening') {
          AssistantState.updateState({ status: 'idle' })
        }
      }
    }
  }

  public checkWakeWord(text: string): boolean {
    return this.WAKE_PATTERNS.some((pattern) => pattern.test(text))
  }

  public stripWakeWord(text: string): string {
    let result = text
    for (const pattern of this.WAKE_PATTERNS) {
      result = result.replace(pattern, '').trim()
    }
    return result
  }

  public startListening(wakeWordMode = false, lang?: AssistantLanguage) {
    if (!this.recognition) {
      this.initEngine()
      if (!this.recognition) return false
    }

    this.isWakeWordMode = wakeWordMode
    const selectedLang = lang || AssistantState.getState().language

    // Map language code
    const langCode =
      selectedLang === 'hi' ? 'hi-IN' : selectedLang === 'pa' ? 'pa-IN' : 'en-US'
    this.recognition.lang = langCode

    try {
      if (this.isRunning) {
        this.recognition.abort()
      }
      this.recognition.start()
      return true
    } catch (err: any) {
      console.warn('[VoiceRecognition] Start failed:', err)
      return false
    }
  }

  public stop() {
    this.isWakeWordMode = false
    clearTimeout(this.restartTimeout)
    if (this.recognition && this.isRunning) {
      try {
        this.recognition.stop()
      } catch {}
    }
    this.isRunning = false
    AssistantState.updateState({
      isListening: false,
      wakeWordActive: false,
      status: 'idle',
    })
  }

  public onTranscript(cb: RecognitionCallback) {
    this.onTranscriptCallback = cb
  }

  public onWakeWord(cb: WakeWordCallback) {
    this.onWakeWordCallback = cb
  }

  public onError(cb: ErrorCallback) {
    this.onErrorCallback = cb
  }
}

export const VoiceRecognition = new VoiceRecognitionEngine()
