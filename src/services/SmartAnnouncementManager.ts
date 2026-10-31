/**
 * NaviAble AI — Smart Announcement Manager (Single Authoritative Speech Broker)
 *
 * All voice events across the application (Object Detection, Road Hazards,
 * Person & Crowd Intelligence, Currency Scanner, OCR, and Proximity Warnings)
 * are routed through this central coordinator.
 *
 * Strict Priority Preemption Hierarchy:
 * - HIGH: Confirmed critical proximity collision warnings (preempts all audio immediately)
 * - MEDIUM: Important road-hazard detections and currency recognition results
 * - NORMAL: Meaningful scene changes, crowd alerts, and user command replies
 * - LOW: General scene descriptions and background objects (never interrupts higher priority)
 *
 * Core Features:
 * - Zero overlapping speech (cancels or queues based on priority)
 * - Duplicate event suppression & temporal cooldown debouncing
 * - Currency results protected from endless person detection spam
 * - Trilingual voice selection (English, Hindi, Punjabi) with automatic fallback
 * - Full speech rate and volume control
 * - Instant "Stop Speaking" silence functionality
 * - User-gesture audio unlocking for mobile Safari and Android Chrome
 */

export type AnnouncementPriority = 'HIGH' | 'MEDIUM' | 'NORMAL' | 'LOW'
export type OperatingLanguage = 'en' | 'hi' | 'pa'

export interface AnnouncementItem {
  id: string
  text: string
  priority: AnnouncementPriority
  language: OperatingLanguage
  timestamp: number
  force?: boolean
  cooldownMs?: number
  domain?: 'proximity' | 'currency' | 'hazard' | 'crowd' | 'scene' | 'system'
}

export interface AnnouncementStatus {
  isSpeaking: boolean
  currentPriority: AnnouncementPriority | null
  lastSpokenText: string
  lastSpokenPriority: AnnouncementPriority | null
  lastSpokenTimestamp: number
  language: OperatingLanguage
  volume: number
  rate: number
  isUnlocked: boolean
  lastError: string | null
}

type StatusListener = (status: AnnouncementStatus) => void

const PRIORITY_RANK: Record<AnnouncementPriority, number> = {
  HIGH: 4,
  MEDIUM: 3,
  NORMAL: 2,
  LOW: 1,
}

class SmartAnnouncementManagerClass {
  private isSpeaking = false
  private currentPriority: AnnouncementPriority | null = null
  private currentUtterance: SpeechSynthesisUtterance | null = null
  private lastSpokenText = ''
  private lastSpokenPriority: AnnouncementPriority | null = null
  private lastSpokenTimestamp = 0
  private lastError: string | null = null
  private isUnlocked = false

  private volume = 1.0
  private rate = 0.95
  private language: OperatingLanguage = 'en'

  // Debounce maps: text/domain -> last announced timestamp
  private recentPhrases: Map<string, number> = new Map()
  private domainCooldowns: Map<string, number> = new Map()
  private listeners: Set<StatusListener> = new Set()

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.notify()
      }
    }
  }

  // ─── Status & Subscription ───

  public getStatus(): AnnouncementStatus {
    return {
      isSpeaking: this.isSpeaking,
      currentPriority: this.currentPriority,
      lastSpokenText: this.lastSpokenText,
      lastSpokenPriority: this.lastSpokenPriority,
      lastSpokenTimestamp: this.lastSpokenTimestamp,
      language: this.language,
      volume: this.volume,
      rate: this.rate,
      isUnlocked: this.isUnlocked,
      lastError: this.lastError,
    }
  }

  public subscribe(fn: StatusListener): () => void {
    this.listeners.add(fn)
    fn(this.getStatus())
    return () => {
      this.listeners.delete(fn)
    }
  }

  private notify() {
    const s = this.getStatus()
    this.listeners.forEach((fn) => {
      try {
        fn(s)
      } catch {}
    })
  }

  // ─── Configuration Controls ───

  public setLanguage(lang: OperatingLanguage) {
    this.language = lang
    this.notify()
  }

  public getLanguage(): OperatingLanguage {
    return this.language
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol))
    this.notify()
  }

  public getVolume(): number {
    return this.volume
  }

  public setRate(rate: number) {
    this.rate = Math.max(0.6, Math.min(1.4, rate))
    this.notify()
  }

  public getRate(): number {
    return this.rate
  }

  // ─── Mobile Audio Unlock ───

  public unlockAudio(): boolean {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      this.lastError = 'SpeechSynthesis not available'
      return false
    }

    try {
      window.speechSynthesis.cancel()
      const dummy = new SpeechSynthesisUtterance('')
      dummy.volume = 0.01
      window.speechSynthesis.speak(dummy)
      this.isUnlocked = true
      this.lastError = null
      this.notify()
      console.log('[SmartAnnouncementManager] Speech synthesis unlocked via user gesture.')
      return true
    } catch (err: any) {
      this.lastError = err?.message || 'Failed to unlock speech'
      this.notify()
      return false
    }
  }

  // ─── Instant Silence ───

  public silence(): void {
    this.stopAll()
  }

  public stopAll(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel()
      } catch {}
    }
    this.isSpeaking = false
    this.currentPriority = null
    this.currentUtterance = null
    this.notify()
  }

  // ─── Core Announcement Dispatch ───

  public announce(
    text: string,
    priority: AnnouncementPriority = 'NORMAL',
    options?: {
      force?: boolean
      lang?: OperatingLanguage
      cooldownMs?: number
      domain?: 'proximity' | 'currency' | 'hazard' | 'crowd' | 'scene' | 'system'
    }
  ): boolean {
    const trimmed = text ? text.trim() : ''
    if (!trimmed) return false

    const now = Date.now()
    const targetLang = options?.lang || this.language
    const incomingRank = PRIORITY_RANK[priority]

    // 1. Debounce checking (unless force flag is provided)
    if (!options?.force) {
      // Cooldown by exact phrase
      const lastPhraseSpoken = this.recentPhrases.get(trimmed) || 0
      const defaultCooldown =
        priority === 'HIGH' ? 3500 : priority === 'MEDIUM' ? 4000 : priority === 'NORMAL' ? 6000 : 9000
      const phraseCooldown = options?.cooldownMs ?? defaultCooldown

      if (now - lastPhraseSpoken < phraseCooldown) {
        return false // Debounced duplicate phrase
      }

      // Cooldown by functional domain (e.g., prevent non-stop crowd updates)
      if (options?.domain) {
        const lastDomainTime = this.domainCooldowns.get(options.domain) || 0
        const minDomainInterval = options.domain === 'proximity' ? 2000 : 3500
        if (now - lastDomainTime < minDomainInterval && priority !== 'HIGH') {
          return false
        }
      }
    }

    // 2. Priority Preemption Check
    if (this.isSpeaking && this.currentPriority) {
      const activeRank = PRIORITY_RANK[this.currentPriority]

      if (incomingRank > activeRank) {
        // Higher priority preempts lower priority immediately
        this.stopAll()
      } else if (incomingRank === activeRank && priority === 'HIGH') {
        // High priority preempts equal priority for urgent proximity updates
        this.stopAll()
      } else {
        // Lower or equal normal/low priority is discarded or postponed to protect ongoing speech
        return false
      }
    }

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      this.lastError = 'SpeechSynthesis unavailable'
      return false
    }

    try {
      const langCode =
        targetLang === 'hi' ? 'hi-IN' : targetLang === 'pa' ? 'pa-IN' : 'en-US'
      const utterance = new SpeechSynthesisUtterance(trimmed)
      utterance.lang = langCode
      utterance.volume = this.volume
      utterance.rate = this.rate

      // Voice matching
      const voices = window.speechSynthesis.getVoices()
      if (voices && voices.length > 0) {
        const prefix = langCode.split('-')[0].toLowerCase()
        const matched = voices.find(
          (v) =>
            v.lang.toLowerCase() === langCode.toLowerCase() ||
            v.lang.toLowerCase().startsWith(prefix)
        )
        if (matched) utterance.voice = matched
      }

      utterance.onstart = () => {
        this.isSpeaking = true
        this.currentPriority = priority
        this.currentUtterance = utterance
        this.lastSpokenText = trimmed
        this.lastSpokenPriority = priority
        this.lastSpokenTimestamp = Date.now()
        this.recentPhrases.set(trimmed, Date.now())
        if (options?.domain) {
          this.domainCooldowns.set(options.domain, Date.now())
        }
        this.notify()
      }

      utterance.onend = () => {
        this.isSpeaking = false
        this.currentPriority = null
        this.currentUtterance = null
        this.notify()
      }

      utterance.onerror = (ev) => {
        console.warn('[SmartAnnouncementManager] Speech error:', ev)
        this.isSpeaking = false
        this.currentPriority = null
        this.currentUtterance = null
        this.lastError = ev.error || 'Speech error'
        this.notify()
      }

      window.speechSynthesis.speak(utterance)
      return true
    } catch (err: any) {
      console.warn('[SmartAnnouncementManager] Synthesis invocation failed:', err)
      this.lastError = err?.message || 'Synthesis exception'
      this.notify()
      return false
    }
  }

  public resetCooldowns() {
    this.recentPhrases.clear()
    this.domainCooldowns.clear()
  }
}

export const SmartAnnouncementManager = new SmartAnnouncementManagerClass()

