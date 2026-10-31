/**
 * NaviAble AI 3.0 — Speech Output (Text-to-Speech Engine)
 * 
 * Provides:
 * - Natural text-to-speech execution via SmartAnnouncementManager & SpeechSynthesis.
 * - Authoritative lifecycle callbacks (onStart, onEnd, onError) for acoustic echo cancellation.
 * - Immediate speech interruption / barge-in.
 * - Rate, pitch, volume, and multilingual voice selection.
 */

import { SmartAnnouncementManager, type OperatingLanguage } from '../../services/SmartAnnouncementManager'
import { VoiceStateManager } from './VoiceStateManager'

type SpeechLifecycleCallback = () => void

export class SpeechOutputClass {
  private isSpeaking = false
  private speechStartCallbacks: Set<SpeechLifecycleCallback> = new Set()
  private speechEndCallbacks: Set<SpeechLifecycleCallback> = new Set()

  constructor() {
    SmartAnnouncementManager.subscribe((status) => {
      if (this.isSpeaking !== status.isSpeaking) {
        this.isSpeaking = status.isSpeaking
        if (status.isSpeaking) {
          VoiceStateManager.setState('SPEAKING')
          this.speechStartCallbacks.forEach(cb => cb())
        } else {
          // Finished speaking
          this.speechEndCallbacks.forEach(cb => cb())
        }
      }
    })
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking
  }

  public onSpeechStart(cb: SpeechLifecycleCallback): () => void {
    this.speechStartCallbacks.add(cb)
    return () => this.speechStartCallbacks.delete(cb)
  }

  public onSpeechEnd(cb: SpeechLifecycleCallback): () => void {
    this.speechEndCallbacks.add(cb)
    return () => this.speechEndCallbacks.delete(cb)
  }

  /**
   * Speak a phrase with specified priority and language
   */
  public async speak(
    text: string,
    priority: 'HIGH' | 'MEDIUM' | 'NORMAL' | 'LOW' = 'HIGH',
    options?: {
      force?: boolean
      lang?: OperatingLanguage
      rate?: number
      volume?: number
    }
  ): Promise<boolean> {
    if (!text || !text.trim()) return false

    if (options?.rate) {
      SmartAnnouncementManager.setRate(options.rate)
    }
    if (options?.volume !== undefined) {
      SmartAnnouncementManager.setVolume(options.volume)
    }

    const currentLang = options?.lang || (VoiceStateManager.getLanguage() as OperatingLanguage)
    return SmartAnnouncementManager.announce(text, priority, {
      force: options?.force ?? true,
      lang: currentLang,
    })
  }

  /**
   * Instantly halt all active and queued speech
   */
  public stopSpeaking() {
    SmartAnnouncementManager.stopAll()
    this.isSpeaking = false
    this.speechEndCallbacks.forEach(cb => cb())
  }

  public setRate(rate: number) {
    SmartAnnouncementManager.setRate(rate)
  }

  public getRate(): number {
    return SmartAnnouncementManager.getRate()
  }

  public setVolume(vol: number) {
    SmartAnnouncementManager.setVolume(vol)
  }

  public getVolume(): number {
    return SmartAnnouncementManager.getVolume()
  }
}

export const SpeechOutput = new SpeechOutputClass()
