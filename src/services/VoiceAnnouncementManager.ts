/**
 * NaviAble AI — Intelligent Voice Announcement Manager
 *
 * Bridges audio operating modes (currency_reading, obstacle_proximity, silent_visual)
 * with the central SmartAnnouncementManager.
 */

import {
  SmartAnnouncementManager,
  type AnnouncementPriority as SmartPriority,
  type OperatingLanguage,
} from './SmartAnnouncementManager'

export type AnnouncementPriority = 'HIGH' | 'MEDIUM' | 'NORMAL' | 'LOW'

export type AudioOperatingMode =
  | 'general_assistance'
  | 'currency_reading'
  | 'obstacle_proximity'
  | 'silent_visual'

export interface VoiceStatus {
  isSpeaking: boolean
  currentPriority: AnnouncementPriority | null
  lastSpokenText: string
  lastSpokenPriority: AnnouncementPriority | null
  lastSpokenTimestamp: number
  activeMode: AudioOperatingMode
  voiceUnlocked: boolean
  lastError: string | null
  availableVoicesCount: number
}

type VoiceStatusListener = (status: VoiceStatus) => void

class VoiceAnnouncementManagerClass {
  private activeMode: AudioOperatingMode = 'general_assistance'
  private listeners: Set<VoiceStatusListener> = new Set()

  constructor() {
    SmartAnnouncementManager.subscribe(() => {
      this.notifyListeners()
    })
  }

  // ─── Mode Management ───

  public setMode(mode: AudioOperatingMode) {
    this.activeMode = mode
    console.log(`[VoiceAnnouncementManager] Switched audio mode to: ${mode}`)
    if (mode === 'silent_visual') {
      this.stopAllSpeech()
    }
    this.notifyListeners()
  }

  public getMode(): AudioOperatingMode {
    return this.activeMode
  }

  // ─── Volume, Rate, Language ───

  public setVolume(vol: number) {
    SmartAnnouncementManager.setVolume(vol)
  }

  public getVolume(): number {
    return SmartAnnouncementManager.getVolume()
  }

  public setRate(rate: number) {
    SmartAnnouncementManager.setRate(rate)
  }

  public getRate(): number {
    return SmartAnnouncementManager.getRate()
  }

  public setLanguage(lang: OperatingLanguage) {
    SmartAnnouncementManager.setLanguage(lang)
  }

  public getLanguage(): OperatingLanguage {
    return SmartAnnouncementManager.getLanguage()
  }

  // ─── Audio Unlocking ───

  public unlockVoice(): boolean {
    return SmartAnnouncementManager.unlockAudio()
  }

  public testVoice(customText?: string) {
    this.unlockVoice()
    const lang = this.getLanguage()
    const testPhrase =
      customText ||
      (lang === 'hi'
        ? 'आवाज़ सहायक सक्रिय है।'
        : lang === 'pa'
        ? 'ਆਵਾਜ਼ ਸਹਾਇਕ ਕਿਰਿਆਸ਼ੀਲ ਹੈ।'
        : 'Voice alerts are enabled and ready.')
    this.announce(testPhrase, 'HIGH', { force: true })
  }

  // ─── Announcement Routing with Mode Filtering ───

  public announce(
    text: string,
    priority: AnnouncementPriority = 'LOW',
    options?: {
      force?: boolean
      lang?: OperatingLanguage
      cooldownMs?: number
      domain?: 'proximity' | 'currency' | 'hazard' | 'crowd' | 'scene' | 'system'
    }
  ): boolean {
    if (!text || !text.trim()) return false

    // 1. Silent visual suppression
    if (this.activeMode === 'silent_visual' && !options?.force) {
      return false
    }

    // 2. Mode-based priority suppression
    if (this.activeMode === 'currency_reading') {
      // In currency mode, mute low priority background narration
      if (priority === 'LOW' && !options?.force) {
        return false
      }
    } else if (this.activeMode === 'obstacle_proximity') {
      // In proximity mode, mute low priority background scene narration
      if (priority === 'LOW' && !options?.force) {
        return false
      }
    }

    // Map priority to SmartPriority
    const smartPrio: SmartPriority =
      priority === 'NORMAL' ? 'NORMAL' : priority === 'HIGH' ? 'HIGH' : priority === 'MEDIUM' ? 'MEDIUM' : 'LOW'

    return SmartAnnouncementManager.announce(text, smartPrio, {
      force: options?.force,
      lang: options?.lang || this.getLanguage(),
      cooldownMs: options?.cooldownMs,
      domain: options?.domain,
    })
  }

  public stopAllSpeech() {
    SmartAnnouncementManager.stopAll()
  }

  public repeatLast(): void {
    const s = SmartAnnouncementManager.getStatus()
    if (s.lastSpokenText) {
      SmartAnnouncementManager.announce(s.lastSpokenText, 'HIGH', { force: true })
    }
  }

  // ─── Status & Telemetry ───

  public getStatus(): VoiceStatus {
    const s = SmartAnnouncementManager.getStatus()
    const voices = typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis.getVoices() : []
    return {
      isSpeaking: s.isSpeaking,
      currentPriority: s.currentPriority,
      lastSpokenText: s.lastSpokenText,
      lastSpokenPriority: s.lastSpokenPriority,
      lastSpokenTimestamp: s.lastSpokenTimestamp,
      activeMode: this.activeMode,
      voiceUnlocked: s.isUnlocked,
      lastError: s.lastError,
      availableVoicesCount: voices.length,
    }
  }

  public subscribe(fn: VoiceStatusListener): () => void {
    this.listeners.add(fn)
    fn(this.getStatus())
    return () => {
      this.listeners.delete(fn)
    }
  }

  private notifyListeners() {
    const s = this.getStatus()
    this.listeners.forEach((fn) => {
      try {
        fn(s)
      } catch {}
    })
  }
}

export const VoiceManager = new VoiceAnnouncementManagerClass()
