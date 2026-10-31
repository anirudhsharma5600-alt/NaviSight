/**
 * NaviAble AI — Advanced Person Tracking & Crowd Intelligence Engine
 *
 * Implements intelligent, calm person perception with stable tracking:
 * - Eliminates repetitive "Person in front" shouts.
 * - Single-person tracking:
 *   - Far away: Completely quiet (visual tracking only).
 *   - Nearby: Announces once: "A person is nearby."
 *   - Approaching: Sustained approach confirmed across observations -> "A person appears to be approaching."
 *   - Very close: Proximity alert & concise warning: "Warning! A person appears very close."
 *   - Stationary / unchanged: Remains completely quiet.
 * - Crowd Intelligence:
 *   - When 3 or more people are visible, aggregates into crowd-level event.
 *   - Announces once: "A group of people is nearby." (or Hindi/Punjabi).
 *   - Suppresses individual repetitive alerts for everyone in the crowd.
 *   - If crowd remains stable: Remains quiet.
 *   - If someone in the crowd approaches close: "A person appears close on the [position] side of the camera view."
 * - State Machine:
 *   CLEAR, PERSON_DETECTED, PERSON_NEARBY, PERSON_APPROACHING, PERSON_VERY_CLOSE,
 *   CROWD_DETECTED, CROWD_DENSITY_CHANGED, UNKNOWN.
 */

import { SmartAnnouncementManager } from './SmartAnnouncementManager'
import type { Detection } from './objectDetection'

export type PersonState =
  | 'CLEAR'
  | 'PERSON_DETECTED'
  | 'PERSON_NEARBY'
  | 'PERSON_APPROACHING'
  | 'PERSON_VERY_CLOSE'
  | 'CROWD_DETECTED'
  | 'CROWD_DENSITY_CHANGED'
  | 'UNKNOWN'

export interface TrackedPerson {
  id: number
  bbox: [number, number, number, number]
  position: 'LEFT' | 'CENTRE' | 'RIGHT'
  relativeArea: number
  heightRatio: number
  consecutiveFrames: number
  firstSeen: number
  lastSeen: number
  sizeHistory: number[]
  isApproaching: boolean
  isVeryClose: boolean
}

export interface PersonTrackerStatus {
  state: PersonState
  personCount: number
  closestProximityScore: number
  closestPersonPosition: 'LEFT' | 'CENTRE' | 'RIGHT' | 'NONE'
  isCrowd: boolean
  lastStateChange: number
  persistentFrames: number
  activeTrackIds: number[]
}

class PersonCrowdIntelligenceEngine {
  private currentState: PersonState = 'CLEAR'
  private lastAnnouncedState: PersonState = 'CLEAR'
  private lastAnnouncedPersonId: number | null = null
  private lastStateChangeTimestamp = Date.now()
  private lastAnnouncementTime = 0
  private framesWithoutPeople = 0

  // Crowd tracking state
  private lastAnnouncedCrowdCount = 0
  private lastCrowdAnnouncedTime = 0

  // Per-person tracking registry
  private trackedPeople: Map<number, TrackedPerson> = new Map()

  // Configurable Thresholds & Hysteresis
  private readonly NEARBY_AREA_THRESHOLD = 0.05 // 5% of screen area
  private readonly CLOSE_AREA_THRESHOLD = 0.22 // 22% of screen area
  private readonly CLOSE_HEIGHT_THRESHOLD = 0.52 // 52% of vertical frame
  private readonly CROWD_THRESHOLD_COUNT = 3 // 3+ people constitutes a crowd
  private readonly CONFIRMATION_FRAMES = 3 // Debounce noise flicker
  private readonly STATE_COOLDOWN_MS = 9000 // 9s before repeating same state
  private readonly CROWD_COOLDOWN_MS = 14000 // 14s before repeating crowd presence

  public processFrame(
    detections: Detection[],
    frameWidth: number,
    frameHeight: number,
    options?: { generalNarrationEnabled?: boolean; language?: 'en' | 'hi' | 'pa' }
  ): PersonTrackerStatus {
    const now = Date.now()
    const frameArea = Math.max(1, frameWidth * frameHeight)
    const lang = options?.language || SmartAnnouncementManager.getLanguage() || 'en'
    const shouldSpeak = options?.generalNarrationEnabled ?? false

    // Filter valid person detections (score >= 0.48)
    const personDets = detections.filter(
      (d) => d.class.toLowerCase() === 'person' && d.score >= 0.48
    )

    // Handle no people detected
    if (personDets.length === 0) {
      this.framesWithoutPeople++
      if (this.framesWithoutPeople >= 6 && this.currentState !== 'CLEAR') {
        this.currentState = 'CLEAR'
        this.lastAnnouncedState = 'CLEAR'
        this.lastAnnouncedPersonId = null
        this.trackedPeople.clear()
        this.lastAnnouncedCrowdCount = 0
        this.lastStateChangeTimestamp = now
      }

      return {
        state: this.currentState,
        personCount: 0,
        closestProximityScore: 0,
        closestPersonPosition: 'NONE',
        isCrowd: false,
        lastStateChange: this.lastStateChangeTimestamp,
        persistentFrames: 0,
        activeTrackIds: [],
      }
    }

    this.framesWithoutPeople = 0
    const activeIds = new Set<number>()

    // Update or register tracked people
    for (const det of personDets) {
      const area = det.bbox[2] * det.bbox[3]
      const relArea = area / frameArea
      const heightRatio = det.bbox[3] / Math.max(1, frameHeight)
      const trackId = det.id || Math.round(det.bbox[0] + det.bbox[1])

      activeIds.add(trackId)
      let p = this.trackedPeople.get(trackId)

      if (!p) {
        p = {
          id: trackId,
          bbox: det.bbox,
          position: det.position,
          relativeArea: relArea,
          heightRatio,
          consecutiveFrames: 1,
          firstSeen: now,
          lastSeen: now,
          sizeHistory: [relArea],
          isApproaching: false,
          isVeryClose: relArea >= this.CLOSE_AREA_THRESHOLD || heightRatio >= this.CLOSE_HEIGHT_THRESHOLD,
        }
        this.trackedPeople.set(trackId, p)
      } else {
        p.lastSeen = now
        p.bbox = det.bbox
        p.position = det.position
        p.relativeArea = relArea
        p.heightRatio = heightRatio
        p.consecutiveFrames++
        p.sizeHistory.push(relArea)
        if (p.sizeHistory.length > 7) p.sizeHistory.shift()

        // Approach detection: confirmed positive area slope across 4+ observations
        if (p.sizeHistory.length >= 4) {
          const firstAvg = (p.sizeHistory[0] + p.sizeHistory[1]) / 2
          const recentAvg = (p.sizeHistory[p.sizeHistory.length - 2] + p.sizeHistory[p.sizeHistory.length - 1]) / 2
          p.isApproaching = recentAvg > firstAvg * 1.20 && recentAvg >= this.NEARBY_AREA_THRESHOLD
        }

        p.isVeryClose = relArea >= this.CLOSE_AREA_THRESHOLD || heightRatio >= this.CLOSE_HEIGHT_THRESHOLD
      }
    }

    // Prune disappeared tracks (>1.5s unseen)
    for (const [id, p] of this.trackedPeople.entries()) {
      if (now - p.lastSeen > 1500) {
        this.trackedPeople.delete(id)
      }
    }

    // Find closest person
    let closestPerson: TrackedPerson | null = null
    let maxArea = 0
    for (const p of this.trackedPeople.values()) {
      if (p.relativeArea > maxArea) {
        maxArea = p.relativeArea
        closestPerson = p
      }
    }

    const personCount = personDets.length
    const isCrowd = personCount >= this.CROWD_THRESHOLD_COUNT
    let nextState: PersonState = 'CLEAR'

    // Evaluate State Machine
    if (isCrowd) {
      if (
        this.currentState === 'CROWD_DETECTED' &&
        Math.abs(personCount - this.lastAnnouncedCrowdCount) >= 4
      ) {
        nextState = 'CROWD_DENSITY_CHANGED'
      } else {
        nextState = 'CROWD_DETECTED'
      }
    } else if (closestPerson) {
      if (closestPerson.isVeryClose) {
        nextState = 'PERSON_VERY_CLOSE'
      } else if (closestPerson.isApproaching) {
        nextState = 'PERSON_APPROACHING'
      } else if (closestPerson.relativeArea >= this.NEARBY_AREA_THRESHOLD) {
        nextState = 'PERSON_NEARBY'
      } else {
        nextState = 'PERSON_DETECTED' // Far away -> quiet!
      }
    }

    // Commit state transition after confirmation frames
    if (nextState !== this.currentState) {
      const isUrgent = nextState === 'PERSON_VERY_CLOSE' || nextState === 'PERSON_APPROACHING'
      const frames = closestPerson ? closestPerson.consecutiveFrames : 0

      if (isUrgent || frames >= this.CONFIRMATION_FRAMES) {
        this.currentState = nextState
        this.lastStateChangeTimestamp = now
      }
    }

    // Dispatch Intelligent Non-Repetitive Announcements
    if (shouldSpeak) {
      this.handleVoiceAnnouncements(now, lang, closestPerson, personCount)
    }

    return {
      state: this.currentState,
      personCount,
      closestProximityScore: Math.round(maxArea * 100),
      closestPersonPosition: closestPerson ? closestPerson.position : 'NONE',
      isCrowd,
      lastStateChange: this.lastStateChangeTimestamp,
      persistentFrames: closestPerson ? closestPerson.consecutiveFrames : 0,
      activeTrackIds: Array.from(activeIds),
    }
  }

  /**
   * Dispatches calm, event-driven voice announcements without repeating.
   */
  private handleVoiceAnnouncements(
    now: number,
    lang: 'en' | 'hi' | 'pa',
    closestPerson: TrackedPerson | null,
    personCount: number
  ) {
    const timeSinceLast = now - this.lastAnnouncementTime

    // ─── Scenario B: Crowd Intelligence (3+ people) ───
    if (this.currentState === 'CROWD_DETECTED' || this.currentState === 'CROWD_DENSITY_CHANGED') {
      const timeSinceCrowd = now - this.lastCrowdAnnouncedTime

      // If someone in the crowd approaches very close, alert with position
      if (closestPerson && closestPerson.isVeryClose) {
        if (
          this.lastAnnouncedPersonId !== closestPerson.id ||
          timeSinceLast >= this.STATE_COOLDOWN_MS
        ) {
          this.lastAnnouncedPersonId = closestPerson.id
          this.lastAnnouncementTime = now
          const posText =
            closestPerson.position === 'CENTRE'
              ? 'ahead'
              : `on the ${closestPerson.position.toLowerCase()} side of the camera view`
          const phrase =
            lang === 'hi'
              ? `भीड़ में से एक व्यक्ति ${closestPerson.position === 'CENTRE' ? 'सामने' : closestPerson.position === 'LEFT' ? 'बाईं ओर' : 'दाईं ओर'} बहुत पास आ गया है।`
              : lang === 'pa'
              ? `ਸਮੂਹ ਵਿੱਚੋਂ ਇੱਕ ਵਿਅਕਤੀ ${closestPerson.position === 'CENTRE' ? 'ਸਾਹਮਣੇ' : closestPerson.position === 'LEFT' ? 'ਖੱਬੇ ਪਾਸੇ' : 'ਸੱਜੇ ਪਾਸੇ'} ਨੇੜੇ ਆ ਗਿਆ ਹੈ।`
              : `A person appears close ${posText}.`

          SmartAnnouncementManager.announce(phrase, 'HIGH', {
            lang,
            force: true,
            domain: 'crowd',
          })
          return
        }
      }

      // Group presence announcement (Announced ONCE per crowd event, never repeated non-stop)
      if (this.lastAnnouncedState !== 'CROWD_DETECTED' || timeSinceCrowd >= this.CROWD_COOLDOWN_MS) {
        this.lastAnnouncedState = 'CROWD_DETECTED'
        this.lastAnnouncedCrowdCount = personCount
        this.lastCrowdAnnouncedTime = now
        this.lastAnnouncementTime = now

        const crowdPhrase =
          lang === 'hi'
            ? 'आस-पास लोगों का एक समूह है।'
            : lang === 'pa'
            ? 'ਨੇੜੇ ਲੋਕਾਂ ਦਾ ਇੱਕ ਸਮੂਹ ਹੈ।'
            : 'A group of people is nearby.'

        SmartAnnouncementManager.announce(crowdPhrase, 'NORMAL', {
          lang,
          cooldownMs: this.CROWD_COOLDOWN_MS,
          domain: 'crowd',
        })
      }
      return
    }

    // ─── Scenario A: Single-Person Behaviour ───
    switch (this.currentState) {
      case 'PERSON_DETECTED':
        // Person is far away -> REMAIN COMPLETELY QUIET!
        break

      case 'PERSON_NEARBY':
        // Moderate distance -> Announce ONCE only when first entering nearby state
        if (this.lastAnnouncedState !== 'PERSON_NEARBY') {
          this.lastAnnouncedState = 'PERSON_NEARBY'
          this.lastAnnouncementTime = now

          const phrase =
            lang === 'hi'
              ? 'एक व्यक्ति आस-पास है।'
              : lang === 'pa'
              ? 'ਇੱਕ ਵਿਅਕਤੀ ਨੇੜੇ ਹੈ।'
              : 'A person is nearby.'

          SmartAnnouncementManager.announce(phrase, 'NORMAL', {
            lang,
            cooldownMs: this.STATE_COOLDOWN_MS,
            domain: 'proximity',
          })
        }
        break

      case 'PERSON_APPROACHING':
        // Approaching confirmed across observations -> Announce ONCE
        if (this.lastAnnouncedState !== 'PERSON_APPROACHING') {
          this.lastAnnouncedState = 'PERSON_APPROACHING'
          this.lastAnnouncementTime = now

          const phrase =
            lang === 'hi'
              ? 'एक व्यक्ति पास आता हुआ प्रतीत हो रहा है।'
              : lang === 'pa'
              ? 'ਇੱਕ ਵਿਅਕਤੀ ਨੇੜੇ ਆਉਂਦਾ ਦਿਖਾਈ ਦੇ ਰਿਹਾ ਹੈ।'
              : 'A person appears to be approaching.'

          SmartAnnouncementManager.announce(phrase, 'MEDIUM', {
            lang,
            cooldownMs: this.STATE_COOLDOWN_MS,
            domain: 'proximity',
          })
        }
        break

      case 'PERSON_VERY_CLOSE':
        // Urgent close warning -> Short alert with sensible 8s cooldown
        if (
          this.lastAnnouncedState !== 'PERSON_VERY_CLOSE' ||
          timeSinceLast >= this.STATE_COOLDOWN_MS
        ) {
          this.lastAnnouncedState = 'PERSON_VERY_CLOSE'
          this.lastAnnouncementTime = now

          const phrase =
            lang === 'hi'
              ? 'चेतावनी! एक व्यक्ति बहुत पास है।'
              : lang === 'pa'
              ? 'ਚੇਤਾਵਨੀ! ਇੱਕ ਵਿਅਕਤੀ ਬਹੁਤ ਨੇੜੇ ਹੈ।'
              : 'Warning! A person appears very close.'

          SmartAnnouncementManager.announce(phrase, 'HIGH', {
            lang,
            force: true,
            domain: 'proximity',
          })
        }
        break

      case 'CLEAR':
        this.lastAnnouncedState = 'CLEAR'
        break
    }
  }

  public reset() {
    this.currentState = 'CLEAR'
    this.lastAnnouncedState = 'CLEAR'
    this.lastAnnouncedPersonId = null
    this.trackedPeople.clear()
    this.lastAnnouncedCrowdCount = 0
    this.framesWithoutPeople = 0
  }

  public getState(): PersonState {
    return this.currentState
  }
}

export const PersonTracker = new PersonCrowdIntelligenceEngine()
