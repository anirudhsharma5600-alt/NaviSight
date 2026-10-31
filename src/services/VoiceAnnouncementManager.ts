/**
 * NaviAble AI — Central Intelligent Voice Announcement Manager
 *
 * Implements a unified priority-based speech controller and mode-based audio router:
 * - Priority Levels: HIGH (Critical Proximity), MEDIUM (Currency & OCR), LOW (Scene Narration)
 * - Interrupts lower-priority speech safely when high-priority alerts fire
 * - Mode-based filtering: General Assistance, Currency Reading, Obstacle & Proximity, Silent Visual
 * - Mobile browser audio unlocking (user-gesture activation)
 * - Trilingual voice selection (English, Hindi, Punjabi) with fallback
 * - Duplicate event suppression & cooldown debouncing
 */

export type AnnouncementPriority = 'HIGH' | 'MEDIUM' | 'LOW'

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
  private currentPriority: AnnouncementPriority | null = null
  private currentUtterance: SpeechSynthesisUtterance | null = null
  private isSpeaking = false
  private voiceUnlocked = false
  private lastSpokenText = ''
  private lastSpokenPriority: AnnouncementPriority | null = null
  private lastSpokenTimestamp = 0
  private lastError: string | null = null

  // Volume & Rate
  private volume = 1.0
  private rate = 0.92
  private language: 'en' | 'hi' | 'pa' = 'en'

  // History & Debouncing
  private recentAnnouncements: Map<string, number> = new Map()
  private listeners: Set<VoiceStatusListener> = new Set()

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.notifyListeners()
      }
    }
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
    this.volume = Math.max(0, Math.min(1, vol))
    this.notifyListeners()
  }

  public getVolume(): number {
    return this.volume
  }

  public setRate(rate: number) {
    this.rate = Math.max(0.5, Math.min(1.5, rate))
  }

  public setLanguage(lang: 'en' | 'hi' | 'pa') {
    this.language = lang
    this.notifyListeners()
  }

  public getLanguage(): 'en' | 'hi' | 'pa' {
    return this.language
  }

  // ─── Mobile Browser Audio Unlock ───

  /**
   * Must be called during a direct user gesture (e.g. "Enable Voice" or "Start Camera")
   * to unlock the SpeechSynthesis engine on mobile Chrome and iOS Safari.
   */
  public unlockVoice(): boolean {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      this.lastError = 'SpeechSynthesis API not supported by browser.'
      this.notifyListeners()
      return false
    }

    try {
      window.speechSynthesis.cancel()
      const dummy = new SpeechSynthesisUtterance('')
      dummy.volume = 0.01
      dummy.rate = 1.5
      window.speechSynthesis.speak(dummy)
      this.voiceUnlocked = true
      this.lastError = null
      console.log('[VoiceAnnouncementManager] SpeechSynthesis successfully unlocked by user gesture.')
      this.notifyListeners()
      return true
    } catch (err: any) {
      this.lastError = err?.message || 'Failed to unlock voice.'
      console.warn('[VoiceAnnouncementManager] Voice unlock error:', err)
      this.notifyListeners()
      return false
    }
  }

  public testVoice(customText?: string) {
    this.unlockVoice()
    const testPhrase =
      customText ||
      (this.language === 'hi'
        ? 'आवाज़ सहायक सक्रिय है।'
        : this.language === 'pa'
        ? 'ਆਵਾਜ਼ ਸਹਾਇਕ ਕਿਰਿਆਸ਼ੀਲ ਹੈ।'
        : 'Voice alerts are enabled and ready.')
    this.announce(testPhrase, 'HIGH', { force: true })
  }

  // ─── Core Announcement Routing ───

  public announce(
    text: string,
    priority: AnnouncementPriority = 'LOW',
    options?: {
      force?: boolean
      lang?: 'en' | 'hi' | 'pa'
      cooldownMs?: number
    }
  ): boolean {
    if (!text || !text.trim()) return false

    // 1. Silent Visual Mode suppression
    if (this.activeMode === 'silent_visual' && !options?.force) {
      return false
    }

    // 2. Mode-based priority suppression
    if (this.activeMode === 'currency_reading') {
      // In currency mode, ONLY currency/OCR (MEDIUM) and emergency proximity (HIGH) are spoken
      if (priority === 'LOW' && !options?.force) {
        return false // Mute background scene and person narration
      }
    } else if (this.activeMode === 'obstacle_proximity') {
      // In proximity mode, ONLY proximity (HIGH) and user-requested actions are spoken
      if (priority === 'LOW' && !options?.force) {
        return false
      }
    }

    // 3. Duplicate event suppression & cooldowns
    const now = Date.now()
    const cooldown = options?.cooldownMs ?? (priority === 'HIGH' ? 4000 : priority === 'MEDIUM' ? 3500 : 8000)
    const lastSpoken = this.recentAnnouncements.get(text) || 0

    if (!options?.force && now - lastSpoken < cooldown) {
      return false // Debounced
    }

    // 4. Priority preemption check
    if (this.isSpeaking && this.currentPriority) {
      if (priority === 'HIGH') {
        // High priority interrupts lower and equal priority
        this.stopAllSpeech()
      } else if (priority === 'MEDIUM' && this.currentPriority === 'LOW') {
        // Medium priority interrupts low priority narration
        this.stopAllSpeech()
      } else if (priority === 'LOW') {
        // Low priority NEVER interrupts ongoing speech
        return false
      } else if (priority === 'MEDIUM' && this.currentPriority === 'HIGH') {
        // Medium priority NEVER interrupts a critical high-priority alert
        return false
      }
    }

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      this.lastError = 'SpeechSynthesis unavailable'
      return false
    }

    try {
      const selectedLang = options?.lang || this.language
      const langCode = selectedLang === 'hi' ? 'hi-IN' : selectedLang === 'pa' ? 'pa-IN' : 'en-US'

      const utterance = new SpeechSynthesisUtterance(text.trim())
      utterance.lang = langCode
      utterance.volume = this.volume
      utterance.rate = this.rate

      // Match best voice
      const voices = window.speechSynthesis.getVoices()
      if (voices && voices.length > 0) {
        const langPrefix = langCode.split('-')[0].toLowerCase()
        const matched = voices.find(
          (v) =>
            v.lang.toLowerCase() === langCode.toLowerCase() ||
            v.lang.toLowerCase().startsWith(langPrefix)
        )
        if (matched) {
          utterance.voice = matched
        }
      }

      utterance.onstart = () => {
        this.isSpeaking = true
        this.currentPriority = priority
        this.lastSpokenText = text
        this.lastSpokenPriority = priority
        this.lastSpokenTimestamp = Date.now()
        this.lastError = null
        this.recentAnnouncements.set(text, Date.now())
        this.notifyListeners()
      }

      utterance.onend = () => {
        this.isSpeaking = false
        this.currentPriority = null
        this.currentUtterance = null
        this.notifyListeners()
      }

      utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
        // Ignore interrupted errors caused by cancel()
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          this.lastError = `Speech error: ${e.error}`
          console.warn('[VoiceAnnouncementManager] Speech synthesis error:', e)
        }
        this.isSpeaking = false
        this.currentPriority = null
        this.currentUtterance = null
        this.notifyListeners()
      }

      this.currentUtterance = utterance
      window.speechSynthesis.speak(utterance)
      this.voiceUnlocked = true
      return true
    } catch (err: any) {
      this.lastError = err?.message || 'Error executing speech'
      this.isSpeaking = false
      this.currentPriority = null
      this.notifyListeners()
      return false
    }
  }

  // ─── Stop Speech ───

  public stopAllSpeech() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel()
      } catch {
        // ignore
      }
    }
    this.isSpeaking = false
    this.currentPriority = null
    this.currentUtterance = null
    this.notifyListeners()
  }

  public repeatLast() {
    if (this.lastSpokenText) {
      this.announce(this.lastSpokenText, this.lastSpokenPriority || 'MEDIUM', { force: true })
    }
  }

  // ─── Telemetry & Listeners ───

  public getStatus(): VoiceStatus {
    const voices = typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis.getVoices() : []
    return {
      isSpeaking: this.isSpeaking,
      currentPriority: this.currentPriority,
      lastSpokenText: this.lastSpokenText,
      lastSpokenPriority: this.lastSpokenPriority,
      lastSpokenTimestamp: this.lastSpokenTimestamp,
      activeMode: this.activeMode,
      voiceUnlocked: this.voiceUnlocked,
      lastError: this.lastError,
      availableVoicesCount: voices.length,
    }
  }

  public subscribe(listener: VoiceStatusListener): () => void {
    this.listeners.add(listener)
    listener(this.getStatus())
    return () => this.listeners.delete(listener)
  }

  private notifyListeners() {
    const status = this.getStatus()
    this.listeners.forEach((fn) => {
      try {
        fn(status)
      } catch {
        // ignore
      }
    })
  }
}

export const VoiceManager = new VoiceAnnouncementManagerClass()
