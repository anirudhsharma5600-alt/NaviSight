import { VoiceManager } from './VoiceAnnouncementManager'
import type { Detection } from './objectDetection'

export type PersonAnnouncementState =
  | 'CLEAR'
  | 'PERSON_DETECTED'
  | 'PERSON_APPROACHING'
  | 'PERSON_APPEARS_CLOSE'
  | 'PERSON_LEFT'

export interface PersonTrackerStatus {
  state: PersonAnnouncementState
  personCount: number
  proximityScore: number
  lastStateChange: number
  persistentFrames: number
}

class PersonAnnouncementTrackerClass {
  private currentState: PersonAnnouncementState = 'CLEAR'
  private persistentFrames = 0
  private framesWithoutPerson = 0
  private lastAnnouncedState: PersonAnnouncementState = 'CLEAR'
  private lastStateChangeTimestamp = Date.now()
  private lastAlertTimestamp = 0
  private previousRelativeSize = 0
  private sizeHistory: number[] = []

  // Cooldowns
  private readonly CLOSE_ALERT_COOLDOWN_MS = 8000 // Only repeat critical close warning after 8s of sustained proximity
  private readonly CONFIRMATION_FRAMES_REQUIRED = 3 // Debounce noise: require 3 consecutive frames before triggering state

  public processFrame(
    detections: Detection[],
    frameWidth: number,
    frameHeight: number,
    options?: { generalNarrationEnabled?: boolean }
  ): PersonTrackerStatus {
    const now = Date.now()
    const frameArea = Math.max(1, frameWidth * frameHeight)

    // Filter person detections
    const persons = detections.filter(
      (d) => d.class.toLowerCase() === 'person' && d.score >= 0.50
    )

    if (persons.length === 0) {
      this.framesWithoutPerson++
      if (this.framesWithoutPerson >= 5 && this.currentState !== 'CLEAR') {
        // Transition: Person has left
        this.currentState = 'PERSON_LEFT'
        this.persistentFrames = 0
        this.sizeHistory = []
        this.previousRelativeSize = 0

        // Reset to CLEAR silently without shouting
        setTimeout(() => {
          if (this.currentState === 'PERSON_LEFT') {
            this.currentState = 'CLEAR'
            this.lastAnnouncedState = 'CLEAR'
          }
        }, 1200)
      }

      return {
        state: this.currentState,
        personCount: 0,
        proximityScore: 0,
        lastStateChange: this.lastStateChangeTimestamp,
        persistentFrames: this.persistentFrames,
      }
    }

    // Person is present in this frame
    this.framesWithoutPerson = 0
    this.persistentFrames++

    // Find closest/largest person
    let maxArea = 0
    for (const p of persons) {
      const area = p.bbox[2] * p.bbox[3]
      if (area > maxArea) {
        maxArea = area
      }
    }

    const currentRelativeSize = maxArea / frameArea
    this.sizeHistory.push(currentRelativeSize)
    if (this.sizeHistory.length > 8) this.sizeHistory.shift()

    // Smooth size
    const smoothedSize =
      this.sizeHistory.reduce((a, b) => a + b, 0) / this.sizeHistory.length

    // Detect if approaching: smoothed size is steadily increasing across frames
    const isApproaching =
      this.sizeHistory.length >= 4 &&
      smoothedSize > this.previousRelativeSize * 1.15 &&
      smoothedSize >= 0.08

    this.previousRelativeSize = smoothedSize

    // Determine state
    let nextState: PersonAnnouncementState = 'PERSON_DETECTED'
    if (smoothedSize >= 0.22) {
      nextState = 'PERSON_APPEARS_CLOSE'
    } else if (isApproaching && smoothedSize >= 0.10) {
      nextState = 'PERSON_APPROACHING'
    } else {
      nextState = 'PERSON_DETECTED'
    }

    // Only commit state transition after confirmation frames
    if (nextState !== this.currentState) {
      if (this.persistentFrames >= this.CONFIRMATION_FRAMES_REQUIRED || nextState === 'PERSON_APPEARS_CLOSE') {
        this.currentState = nextState
        this.lastStateChangeTimestamp = now
      }
    }

    // Announcement Logic (strict debouncing, zero repetition)
    this.handleAnnouncements(options?.generalNarrationEnabled ?? false, now, smoothedSize)

    return {
      state: this.currentState,
      personCount: persons.length,
      proximityScore: Math.round(smoothedSize * 100),
      lastStateChange: this.lastStateChangeTimestamp,
      persistentFrames: this.persistentFrames,
    }
  }

  private handleAnnouncements(generalNarrationEnabled: boolean, now: number, smoothedSize: number) {
    switch (this.currentState) {
      case 'PERSON_DETECTED':
        // When a person first appears: announce once only if general scene narration is enabled
        if (this.lastAnnouncedState !== 'PERSON_DETECTED') {
          this.lastAnnouncedState = 'PERSON_DETECTED'
          if (generalNarrationEnabled) {
            VoiceManager.announce('A person is nearby.', 'LOW', { cooldownMs: 12000 })
          }
          // Otherwise, remain completely silent and update visual indicators only
        }
        break

      case 'PERSON_APPROACHING':
        // Announce approaching ONCE after temporal confirmation
        if (this.lastAnnouncedState !== 'PERSON_APPROACHING') {
          this.lastAnnouncedState = 'PERSON_APPROACHING'
          VoiceManager.announce('A person appears to be approaching.', 'MEDIUM', { cooldownMs: 10000 })
        }
        break

      case 'PERSON_APPEARS_CLOSE':
        // High priority warning with sensible 8s cooldown
        if (this.lastAnnouncedState !== 'PERSON_APPEARS_CLOSE' || now - this.lastAlertTimestamp >= this.CLOSE_ALERT_COOLDOWN_MS) {
          this.lastAnnouncedState = 'PERSON_APPEARS_CLOSE'
          this.lastAlertTimestamp = now
          VoiceManager.announce('Warning! A person appears very close.', 'HIGH', { force: true })
        }
        break

      case 'PERSON_LEFT':
      case 'CLEAR':
        // Silently reset
        this.lastAnnouncedState = 'CLEAR'
        break
    }
  }

  public reset() {
    this.currentState = 'CLEAR'
    this.persistentFrames = 0
    this.framesWithoutPerson = 0
    this.lastAnnouncedState = 'CLEAR'
    this.sizeHistory = []
    this.previousRelativeSize = 0
  }

  public getState(): PersonAnnouncementState {
    return this.currentState
  }
}

export const PersonTracker = new PersonAnnouncementTrackerClass()

