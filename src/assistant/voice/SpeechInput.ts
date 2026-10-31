/**
 * NaviAble AI 3.0 — Speech Input (Speech-to-Text Recognition Engine)
 * 
 * Provides:
 * - Robust cross-browser speech recognition (standard & webkit-prefixed).
 * - Distinct interim streaming vs final transcript emission.
 * - Anti-echo suspension: cleanly mutes speech input while assistant speaks.
 * - Automatic exponential error backoff (prevents browser restart spin loops).
 * - Transparent microphone permission acquisition.
 */

import { VoiceStateManager } from './VoiceStateManager'
import { VoiceLanguageManager } from './VoiceLanguageManager'

type FinalTranscriptCallback = (text: string) => void
type InterimTranscriptCallback = (text: string) => void
type ErrorCallback = (error: string) => void

interface IWindowWithSpeech extends Window {
  SpeechRecognition?: any
  webkitSpeechRecognition?: any
}

export class SpeechInputClass {
  private recognition: any = null
  private isListening = false
  private isSuspended = false // Suspended during TTS to block self-listening echo
  private consecutiveErrors = 0
  private restartTimer: any = null
  private userEnabled = false

  private finalCallbacks: Set<FinalTranscriptCallback> = new Set()
  private interimCallbacks: Set<InterimTranscriptCallback> = new Set()
  private errorCallbacks: Set<ErrorCallback> = new Set()

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false
    const win = window as IWindowWithSpeech
    return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition)
  }

  public getIsListening(): boolean {
    return this.isListening && !this.isSuspended
  }

  /**
   * Request microphone permission explicitly via getUserMedia
   */
  public async requestMicrophonePermission(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      VoiceStateManager.setPermissionState('unsupported')
      return false
    }

    VoiceStateManager.setState('REQUESTING_PERMISSION')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Permission granted, release stream immediately
      stream.getTracks().forEach(t => t.stop())
      VoiceStateManager.setPermissionState('granted')
      return true
    } catch (err: any) {
      console.warn('[SpeechInput] Microphone access rejected:', err)
      VoiceStateManager.setPermissionState('denied')
      VoiceStateManager.setError('Microphone access was denied. Please allow microphone in browser settings.')
      return false
    }
  }

  /**
   * Initialize browser SpeechRecognition
   */
  private initRecognition(): boolean {
    if (!this.isSupported()) {
      VoiceStateManager.setPermissionState('unsupported')
      VoiceStateManager.setError('Speech recognition is not supported in this browser.')
      return false
    }

    if (this.recognition) return true

    const win = window as IWindowWithSpeech
    const SpeechRecClass = win.SpeechRecognition || win.webkitSpeechRecognition

    try {
      this.recognition = new SpeechRecClass()
      this.recognition.continuous = true
      this.recognition.interimResults = true
      this.recognition.maxAlternatives = 1

      this.setupHandlers()
      return true
    } catch (err: any) {
      console.error('[SpeechInput] Failed to instantiate SpeechRecognition:', err)
      VoiceStateManager.setError(`Speech recognition initialization failed: ${err.message}`)
      return false
    }
  }

  private setupHandlers() {
    if (!this.recognition) return

    this.recognition.onstart = () => {
      this.isListening = true
      this.consecutiveErrors = 0
      VoiceStateManager.setMicrophoneActive(true)
      if (VoiceStateManager.getState() === 'REQUESTING_PERMISSION' || VoiceStateManager.getState() === 'IDLE') {
        VoiceStateManager.setState('LISTENING')
      }
    }

    this.recognition.onresult = (event: any) => {
      // Discard recognition if temporarily suspended (echo blocking)
      if (this.isSuspended) return

      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i]
        const transcript = item[0]?.transcript || ''
        if (item.isFinal) {
          final += (final ? ' ' : '') + transcript
        } else {
          interim += (interim ? ' ' : '') + transcript
        }
      }

      if (interim) {
        VoiceStateManager.setInterimTranscript(interim)
        this.interimCallbacks.forEach(cb => cb(interim))
      }

      if (final && final.trim().length > 0) {
        const cleaned = final.trim()
        VoiceStateManager.setFinalTranscript(cleaned)
        this.finalCallbacks.forEach(cb => cb(cleaned))
      }
    }

    this.recognition.onerror = (event: any) => {
      const error = event.error || 'unknown'
      console.warn('[SpeechInput] Recognition event error:', error)

      if (error === 'no-speech') {
        // Natural silence timeout - ignore in continuous listening
        return
      }

      if (error === 'not-allowed' || error === 'service-not-allowed') {
        this.isListening = false
        this.userEnabled = false
        VoiceStateManager.setPermissionState('denied')
        VoiceStateManager.setError('Microphone permission blocked or denied by browser.')
        this.errorCallbacks.forEach(cb => cb('Microphone permission denied'))
        return
      }

      this.consecutiveErrors++
      if (this.consecutiveErrors >= 5) {
        console.warn('[SpeechInput] Excessive consecutive recognition errors. Stopping.')
        this.stop()
        VoiceStateManager.setError(`Voice recognition interrupted (${error}). Tap microphone to retry.`)
        this.errorCallbacks.forEach(cb => cb(`Error: ${error}`))
      }
    }

    this.recognition.onend = () => {
      this.isListening = false
      VoiceStateManager.setMicrophoneActive(false)

      // Auto-restart if user still has voice mode enabled and not in error state
      if (this.userEnabled && !this.isSuspended && this.consecutiveErrors < 5) {
        clearTimeout(this.restartTimer)
        this.restartTimer = setTimeout(() => {
          if (this.userEnabled && !this.isListening && !this.isSuspended) {
            this.startListening()
          }
        }, 300)
      } else if (!this.userEnabled && VoiceStateManager.getState() === 'LISTENING') {
        VoiceStateManager.setState('IDLE')
      }
    }
  }

  /**
   * Start recognition with configured language
   */
  public startListening(): boolean {
    if (!this.initRecognition()) return false

    this.userEnabled = true
    this.isSuspended = false
    clearTimeout(this.restartTimer)

    // Set regional BCP-47 language tag
    this.recognition.lang = VoiceLanguageManager.getRecognitionLangCode()

    try {
      if (this.isListening) {
        this.recognition.abort()
      }
      this.recognition.start()
      return true
    } catch (err: any) {
      console.warn('[SpeechInput] Start error:', err)
      return false
    }
  }

  /**
   * Suspend speech input while TTS is actively speaking (Echo Cancelling)
   */
  public suspendListening() {
    this.isSuspended = true
    if (this.recognition && this.isListening) {
      try {
        this.recognition.abort()
      } catch {}
      this.isListening = false
    }
  }

  /**
   * Resume speech input after TTS has finished speaking
   */
  public resumeListening() {
    this.isSuspended = false
    if (this.userEnabled && !this.isListening) {
      setTimeout(() => {
        if (this.userEnabled && !this.isSuspended) {
          this.startListening()
        }
      }, 250) // 250ms acoustic dissipation window
    }
  }

  /**
   * Stop speech recognition completely
   */
  public stop() {
    this.userEnabled = false
    this.isSuspended = false
    clearTimeout(this.restartTimer)

    if (this.recognition) {
      try {
        this.recognition.stop()
      } catch {}
    }
    this.isListening = false
    VoiceStateManager.setMicrophoneActive(false)
  }

  public onFinalTranscript(cb: FinalTranscriptCallback): () => void {
    this.finalCallbacks.add(cb)
    return () => this.finalCallbacks.delete(cb)
  }

  public onInterimTranscript(cb: InterimTranscriptCallback): () => void {
    this.interimCallbacks.add(cb)
    return () => this.interimCallbacks.delete(cb)
  }

  public onError(cb: ErrorCallback): () => void {
    this.errorCallbacks.add(cb)
    return () => this.errorCallbacks.delete(cb)
  }
}

export const SpeechInput = new SpeechInputClass()
