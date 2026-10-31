/**
 * NaviAble AI — Road Intelligence & Object Narration Engine
 *
 * Expands beyond generic person detection to identify, track, and narrate
 * relevant road objects, vehicles, traffic elements, and pedestrian obstacles:
 * - Cars, Motorcycles, Bicycles, Buses, Trucks
 * - Traffic Lights, Stop Signs, Road Signs
 * - Street Furniture & Obstacles: Benches, Chairs, Backpacks, Suitcases, Fire Hydrants
 * - Pedestrians & Approaching Obstacles
 *
 * Implements intelligent spatial positioning (LEFT, CENTRE/AHEAD, RIGHT),
 * temporal debouncing, movement/approach detection, and priority-managed
 * concise speech output via VoiceAnnouncementManager.
 */

import { VoiceManager } from './VoiceAnnouncementManager'
import type { Detection } from './objectDetection'

export type RoadObjectClass =
  | 'vehicle'
  | 'traffic_control'
  | 'street_hazard'
  | 'pedestrian'
  | 'other'

export interface RoadObjectInfo {
  category: RoadObjectClass
  displayName: string
  hindiName: string
  punjabiName: string
  urgency: 'HIGH' | 'MEDIUM' | 'NORMAL' | 'LOW'
}

export const ROAD_OBJECT_CATALOG: Record<string, RoadObjectInfo> = {
  // ─── Vehicles ───
  car: {
    category: 'vehicle',
    displayName: 'car',
    hindiName: 'कार',
    punjabiName: 'ਕਾਰ',
    urgency: 'NORMAL',
  },
  motorcycle: {
    category: 'vehicle',
    displayName: 'motorcycle',
    hindiName: 'मोटरसाइकिल',
    punjabiName: 'ਮੋਟਰਸਾਈਕਲ',
    urgency: 'MEDIUM', // Faster, more hazardous for pedestrians
  },
  bicycle: {
    category: 'vehicle',
    displayName: 'bicycle',
    hindiName: 'साइकिल',
    punjabiName: 'ਸਾਈਕਲ',
    urgency: 'NORMAL',
  },
  bus: {
    category: 'vehicle',
    displayName: 'bus',
    hindiName: 'बस',
    punjabiName: 'ਬੱਸ',
    urgency: 'MEDIUM',
  },
  truck: {
    category: 'vehicle',
    displayName: 'truck',
    hindiName: 'ट्रक',
    punjabiName: 'ਟਰੱਕ',
    urgency: 'MEDIUM',
  },

  // ─── Traffic Control Elements ───
  'traffic light': {
    category: 'traffic_control',
    displayName: 'traffic signal',
    hindiName: 'ट्रैफ़िक सिग्नल',
    punjabiName: 'ਟ੍ਰੈਫਿਕ ਲਾਈਟ',
    urgency: 'NORMAL',
  },
  'stop sign': {
    category: 'traffic_control',
    displayName: 'stop sign',
    hindiName: 'स्टॉप साइन',
    punjabiName: 'ਸਟਾਪ ਸਾਈਨ',
    urgency: 'NORMAL',
  },
  'fire hydrant': {
    category: 'street_hazard',
    displayName: 'fire hydrant',
    hindiName: 'फायर हाइड्रेंट',
    punjabiName: 'ਫਾਇਰ ਹਾਈਡ੍ਰੈਂਟ',
    urgency: 'LOW',
  },

  // ─── Street Furniture & Ground Obstacles ───
  bench: {
    category: 'street_hazard',
    displayName: 'bench',
    hindiName: 'बेंच',
    punjabiName: 'ਬੈਂਚ',
    urgency: 'LOW',
  },
  chair: {
    category: 'street_hazard',
    displayName: 'chair',
    hindiName: 'कुर्सी',
    punjabiName: 'ਕੁਰਸੀ',
    urgency: 'LOW',
  },
  suitcase: {
    category: 'street_hazard',
    displayName: 'suitcase',
    hindiName: 'सूटकेस',
    punjabiName: 'ਸੂਟਕੇਸ',
    urgency: 'NORMAL', // Ground trip hazard
  },
  backpack: {
    category: 'street_hazard',
    displayName: 'backpack',
    hindiName: 'बैग',
    punjabiName: 'ਬੈਗ',
    urgency: 'LOW',
  },

  // ─── Pedestrians ───
  person: {
    category: 'pedestrian',
    displayName: 'person',
    hindiName: 'व्यक्ति',
    punjabiName: 'ਵਿਅਕਤੀ',
    urgency: 'NORMAL',
  },
}

export interface TrackedRoadObject {
  id: number
  className: string
  category: RoadObjectClass
  position: 'LEFT' | 'CENTRE' | 'RIGHT'
  relativeArea: number
  isApproaching: boolean
  firstSeen: number
  lastSeen: number
  lastAnnounced: number
  consecutiveFrames: number
  sizeHistory: number[]
}

export interface RoadSceneSummary {
  totalObjects: number
  vehiclesCount: number
  trafficSignsCount: number
  hazardsCount: number
  pedestriansCount: number
  nearestObject: string | null
  narrationText: string
  activeHazards: string[]
}

class RoadIntelligenceEngine {
  private trackedObjects: Map<number, TrackedRoadObject> = new Map()
  private lastNarrationTimestamp = 0
  private lastAnnouncedClass: string | null = null
  private lastAnnouncedPosition: string | null = null

  // Cooldowns
  private readonly SAME_OBJECT_COOLDOWN_MS = 12000 // 12 seconds per specific object instance
  private readonly CLASS_COOLDOWN_MS = 6000 // 6 seconds before repeating same class in same zone
  private readonly MIN_CONFIRMATION_FRAMES = 2 // Debounce transient false positives

  /**
   * Process live detection frame for road intelligence narration.
   */
  public processFrame(
    detections: Detection[],
    frameWidth: number,
    frameHeight: number,
    options?: {
      generalNarrationEnabled?: boolean
      language?: 'en' | 'hi' | 'pa'
    }
  ): RoadSceneSummary {
    const now = Date.now()
    const frameArea = Math.max(1, frameWidth * frameHeight)
    const lang = options?.language || VoiceManager.getLanguage() || 'en'
    const shouldSpeak = options?.generalNarrationEnabled ?? false

    // Filter to known road & street objects
    const roadDetections = detections.filter(d => {
      const info = ROAD_OBJECT_CATALOG[d.class.toLowerCase()]
      return info !== undefined && d.score >= 0.45
    })

    const currentIds = new Set<number>()
    let vehiclesCount = 0
    let trafficSignsCount = 0
    let hazardsCount = 0
    let pedestriansCount = 0
    const activeHazards: string[] = []

    let closestObj: TrackedRoadObject | null = null
    let maxArea = 0

    // Update tracking
    for (const det of roadDetections) {
      const cls = det.class.toLowerCase()
      const info = ROAD_OBJECT_CATALOG[cls]!
      const area = det.bbox[2] * det.bbox[3]
      const relArea = area / frameArea

      currentIds.add(det.id)

      if (info.category === 'vehicle') vehiclesCount++
      if (info.category === 'traffic_control') trafficSignsCount++
      if (info.category === 'street_hazard') hazardsCount++
      if (info.category === 'pedestrian') pedestriansCount++

      let tracked = this.trackedObjects.get(det.id)
      if (!tracked) {
        tracked = {
          id: det.id,
          className: cls,
          category: info.category,
          position: det.position,
          relativeArea: relArea,
          isApproaching: false,
          firstSeen: now,
          lastSeen: now,
          lastAnnounced: 0,
          consecutiveFrames: 1,
          sizeHistory: [relArea],
        }
        this.trackedObjects.set(det.id, tracked)
      } else {
        tracked.lastSeen = now
        tracked.position = det.position
        tracked.relativeArea = relArea
        tracked.consecutiveFrames++
        tracked.sizeHistory.push(relArea)
        if (tracked.sizeHistory.length > 6) tracked.sizeHistory.shift()

        // Detect approach (smoothed growth across frames)
        if (tracked.sizeHistory.length >= 4) {
          const firstAvg = (tracked.sizeHistory[0] + tracked.sizeHistory[1]) / 2
          const recentAvg = (tracked.sizeHistory[tracked.sizeHistory.length - 2] + tracked.sizeHistory[tracked.sizeHistory.length - 1]) / 2
          tracked.isApproaching = recentAvg > firstAvg * 1.25 && recentAvg >= 0.04
        }
      }

      if (relArea > maxArea) {
        maxArea = relArea
        closestObj = tracked
      }

      // Check for high-urgency road hazards
      if (tracked.isApproaching && (info.category === 'vehicle' || cls === 'person')) {
        activeHazards.push(`Approaching ${info.displayName}`)
      }
    }

    // Prune stale objects (unseen for > 2 seconds)
    for (const [id, obj] of this.trackedObjects.entries()) {
      if (now - obj.lastSeen > 2000) {
        this.trackedObjects.delete(id)
      }
    }

    // Determine if an announcement should be dispatched
    if (shouldSpeak && roadDetections.length > 0) {
      this.evaluateNarration(now, lang)
    }

    return {
      totalObjects: roadDetections.length,
      vehiclesCount,
      trafficSignsCount,
      hazardsCount,
      pedestriansCount,
      nearestObject: closestObj ? closestObj.className : null,
      narrationText: this.buildSceneDescription(lang),
      activeHazards,
    }
  }

  /**
   * Decide which object deserves narration, avoiding repetition.
   */
  private evaluateNarration(now: number, lang: 'en' | 'hi' | 'pa') {
    // Collect candidate objects with enough consecutive frames
    const candidates = Array.from(this.trackedObjects.values())
      .filter(o => o.consecutiveFrames >= this.MIN_CONFIRMATION_FRAMES)
      .sort((a, b) => {
        // Approaching items first, then larger (closer) items
        if (a.isApproaching && !b.isApproaching) return -1
        if (!a.isApproaching && b.isApproaching) return 1
        return b.relativeArea - a.relativeArea
      })

    if (candidates.length === 0) return

    for (const obj of candidates) {
      const timeSinceObjAnnounce = now - obj.lastAnnounced
      const isSameAsLast = this.lastAnnouncedClass === obj.className && this.lastAnnouncedPosition === obj.position
      const timeSinceLastAny = now - this.lastNarrationTimestamp

      // Skip if recently announced this specific object
      if (timeSinceObjAnnounce < this.SAME_OBJECT_COOLDOWN_MS) continue

      // Skip if repeated class in same position too quickly
      if (isSameAsLast && timeSinceLastAny < this.CLASS_COOLDOWN_MS) continue

      // Also ensure minimum gap between any narrations
      if (timeSinceLastAny < 3200 && !obj.isApproaching) continue

      // Generate natural phrasing
      const phrase = this.formatPhrase(obj, lang)
      const info = ROAD_OBJECT_CATALOG[obj.className]
      const priority = obj.isApproaching ? 'HIGH' : info?.urgency === 'MEDIUM' ? 'MEDIUM' : 'LOW'

      // Dispatch through central VoiceManager
      const spoken = VoiceManager.announce(phrase, priority, {
        lang,
        cooldownMs: this.CLASS_COOLDOWN_MS,
      })

      if (spoken) {
        obj.lastAnnounced = now
        this.lastNarrationTimestamp = now
        this.lastAnnouncedClass = obj.className
        this.lastAnnouncedPosition = obj.position
        break // Announce only one salient object per evaluation cycle
      }
    }
  }

  /**
   * Formats short natural sentence matching user specifications:
   * "A car is visible ahead."
   * "A motorcycle is approaching."
   * "A bicycle is on your left."
   * "A bus is visible ahead."
   * "A traffic signal is detected on your right."
   */
  private formatPhrase(obj: TrackedRoadObject, lang: 'en' | 'hi' | 'pa'): string {
    const info = ROAD_OBJECT_CATALOG[obj.className] || {
      displayName: obj.className,
      hindiName: obj.className,
      punjabiName: obj.className,
    }

    const posEnglish =
      obj.position === 'CENTRE' ? 'ahead' : `on your ${obj.position.toLowerCase()}`
    const posHindi =
      obj.position === 'CENTRE' ? 'सामने' : obj.position === 'LEFT' ? 'बाईं ओर' : 'दाईं ओर'
    const posPunjabi =
      obj.position === 'CENTRE' ? 'ਸਾਹਮਣੇ' : obj.position === 'LEFT' ? 'ਖੱਬੇ ਪਾਸੇ' : 'ਸੱਜੇ ਪਾਸੇ'

    if (lang === 'hi') {
      if (obj.isApproaching) {
        return `एक ${info.hindiName} पास आ रही है।`
      }
      if (info.category === 'traffic_control') {
        return `${posHindi} ${info.hindiName} दिखाई दे रहा है।`
      }
      return `${posHindi} एक ${info.hindiName} दिखाई दे रही है।`
    }

    if (lang === 'pa') {
      if (obj.isApproaching) {
        return `ਇੱਕ ${info.punjabiName} ਨੇੜੇ ਆ ਰਹੀ ਹੈ।`
      }
      if (info.category === 'traffic_control') {
        return `${posPunjabi} ${info.punjabiName} ਦਿਖਾਈ ਦੇ ਰਿਹਾ ਹੈ।`
      }
      return `${posPunjabi} ਇੱਕ ${info.punjabiName} ਦਿਖਾਈ ਦੇ ਰਹੀ ਹੈ।`
    }

    // English
    if (obj.isApproaching) {
      return `A ${info.displayName} is approaching.`
    }
    if (info.category === 'traffic_control') {
      return `A ${info.displayName} is detected ${posEnglish}.`
    }
    if (info.category === 'vehicle') {
      return `A ${info.displayName} is ${obj.position === 'CENTRE' ? 'visible ahead' : `${posEnglish}`}.`
    }
    return `A ${info.displayName} is ${posEnglish}.`
  }

  /**
   * Builds an instantaneous scene overview on request (e.g. for "Describe my surroundings").
   */
  public buildSceneDescription(lang: 'en' | 'hi' | 'pa' = 'en'): string {
    const active = Array.from(this.trackedObjects.values())
    if (active.length === 0) {
      return lang === 'hi'
        ? 'आस-पास कोई वस्तु नहीं दिख रही है।'
        : lang === 'pa'
        ? 'ਨੇੜੇ ਕੋਈ ਵਸਤੂ ਨਹੀਂ ਦਿਖ ਰਹੀ ਹੈ।'
        : 'No road objects or obstacles detected right now.'
    }

    // Group items
    const vehicles: string[] = []
    const others: string[] = []

    for (const obj of active) {
      const pos = obj.position === 'CENTRE' ? 'ahead' : `on the ${obj.position.toLowerCase()}`
      const info = ROAD_OBJECT_CATALOG[obj.className]
      const name = info?.displayName || obj.className
      if (info?.category === 'vehicle') {
        vehicles.push(`a ${name} ${pos}`)
      } else {
        others.push(`a ${name} ${pos}`)
      }
    }

    const all = [...vehicles, ...others]
    if (all.length === 1) {
      return `There is ${all[0]}.`
    }
    if (all.length === 2) {
      return `I can see ${all[0]}, and ${all[1]}.`
    }
    return `I can see ${all.slice(0, 3).join(', ')}.`
  }

  public reset() {
    this.trackedObjects.clear()
    this.lastNarrationTimestamp = 0
    this.lastAnnouncedClass = null
    this.lastAnnouncedPosition = null
  }
}

export const RoadIntelligence = new RoadIntelligenceEngine()
