import type { Detection } from './objectDetection'
import { SmartAnnouncementManager } from './SmartAnnouncementManager'
import { speak } from './speechService'

// ─── Proximity State Machine ───

export type ProximityState =
  | 'CLEAR'
  | 'PERSON_DETECTED'
  | 'PERSON_APPROACHING'
  | 'PERSON_APPEARS_CLOSE'
  | 'UNKNOWN'

export type AlertLevel = 'WARNING' | 'DANGER' | 'CRITICAL'
export type ProximityZone = 'NEAR' | 'MEDIUM' | 'FAR'
export type ApproachDirection = 'APPROACHING' | 'STABLE' | 'RECEDING'

export interface ProximityAlert {
  objectId: number
  objectClass: string
  zone: ProximityZone
  direction: ApproachDirection
  relativeSize: number
  heightRatio: number
  closenessScore: number
  level: AlertLevel
  state: ProximityState
  position: 'LEFT' | 'CENTRE' | 'RIGHT'
  timestamp: number
  isPerson: boolean
  isMeasuredSensor: boolean
  measuredDistanceCm: number | null
  relativeProximityLabel: string
}

export interface ProximityConfig {
  alertsEnabled: boolean
  vibrationEnabled: boolean
  voiceEnabled: boolean
  volume: number
  sensitivity: 'low' | 'medium' | 'high'
  language: 'en' | 'hi'
  cooldownMs: {
    critical: number
    danger: number
    warning: number
  }
}

// ─── State ───

let audioCtx: AudioContext | null = null
let isAudioUnlocked = false

let config: ProximityConfig = {
  alertsEnabled: true,
  vibrationEnabled: true,
  voiceEnabled: true,
  volume: 0.65,
  sensitivity: 'medium',
  language: 'en',
  cooldownMs: {
    critical: 7000,
    danger: 9000,
    warning: 15000,
  },
}

// Tracking history: key -> size history
const sizeHistory: Map<string, number[]> = new Map()
// Persistence counter: key -> consecutive frame detections
const persistenceCount: Map<string, number> = new Map()
const lastTrackState: Map<string, string> = new Map()
const lastSeenAt: Map<string, number> = new Map()
// One short urgent sound at a state change, with a global safety cooldown.
let lastBeepTime = 0
let lastVoiceAlertTime = 0
let lastCrowdAnnouncementTime = 0
const CROWD_COOLDOWN_MS = 18000
const lastAnnouncedTrackTime: Map<string, number> = new Map()
const OBJECT_ALERT_COOLDOWN_MS = 8000
let currentState: ProximityState = 'CLEAR'

// BLE hardware integration
let sensorDistance: number | null = null
let sensorDistanceAt = 0
const sensorReadings: { centimeters: number; at: number }[] = []
let bleConnected = false
let bleDevice: any = null
let bleCharacteristic: any = null

const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb'
const DISTANCE_CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb'

// ─── Sensitivity Thresholds ───

const THRESHOLDS = {
  low: { closeArea: 0.38, closeHeight: 0.70, medArea: 0.15, medHeight: 0.40 },
  medium: { closeArea: 0.26, closeHeight: 0.55, medArea: 0.08, medHeight: 0.30 },
  high: { closeArea: 0.18, closeHeight: 0.45, medArea: 0.05, medHeight: 0.22 },
}

const HINDI_OBJECT_NAMES: Record<string, string> = {
  person: 'व्यक्ति', bicycle: 'साइकिल', car: 'कार', motorcycle: 'मोटरसाइकिल',
  airplane: 'हवाई जहाज़', bus: 'बस', train: 'ट्रेन', truck: 'ट्रक', boat: 'नाव',
  'traffic light': 'ट्रैफ़िक लाइट', 'fire hydrant': 'फ़ायर हाइड्रेंट', 'stop sign': 'स्टॉप साइन',
  'parking meter': 'पार्किंग मीटर', bench: 'बेंच', bird: 'पक्षी', cat: 'बिल्ली', dog: 'कुत्ता',
  horse: 'घोड़ा', sheep: 'भेड़', cow: 'गाय', elephant: 'हाथी', bear: 'भालू', zebra: 'ज़ेब्रा',
  giraffe: 'जिराफ़', backpack: 'बैग', umbrella: 'छाता', handbag: 'हैंडबैग', tie: 'टाई',
  suitcase: 'सूटकेस', frisbee: 'फ्रिस्बी', skis: 'स्की', snowboard: 'स्नोबोर्ड',
  'sports ball': 'गेंद', kite: 'पतंग', 'baseball bat': 'बेसबॉल बैट', 'baseball glove': 'बेसबॉल ग्लव',
  skateboard: 'स्केटबोर्ड', surfboard: 'सर्फ़बोर्ड', 'tennis racket': 'टेनिस रैकेट',
  bottle: 'बोतल', 'wine glass': 'गिलास', cup: 'कप', fork: 'कांटा', knife: 'चाकू', spoon: 'चम्मच',
  bowl: 'कटोरा', banana: 'केला', apple: 'सेब', sandwich: 'सैंडविच', orange: 'संतरा',
  broccoli: 'ब्रोकली', carrot: 'गाजर', 'hot dog': 'हॉट डॉग', pizza: 'पिज़्ज़ा', donut: 'डोनट',
  cake: 'केक', chair: 'कुर्सी', couch: 'सोफ़ा', 'potted plant': 'गमले का पौधा', bed: 'बिस्तर',
  'dining table': 'मेज़', toilet: 'टॉयलेट', tv: 'टीवी', laptop: 'लैपटॉप', mouse: 'माउस',
  remote: 'रिमोट', keyboard: 'कीबोर्ड', 'cell phone': 'मोबाइल फ़ोन', microwave: 'माइक्रोवेव',
  oven: 'ओवन', toaster: 'टोस्टर', sink: 'सिंक', refrigerator: 'फ़्रिज', book: 'किताब',
  clock: 'घड़ी', vase: 'फूलदान', scissors: 'कैंची', 'teddy bear': 'टेडी बियर',
  'hair drier': 'हेयर ड्रायर', toothbrush: 'टूथब्रश',
}

// ─── Audio Context Unlock (Mandatory User Gesture) ───

export function unlockAudioContext(): void {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (AudioContextClass) {
        audioCtx = new AudioContextClass()
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => {
        isAudioUnlocked = true
        console.log('[ProximityEngine] AudioContext successfully unlocked by user gesture.')
      }).catch((err) => {
        console.warn('[ProximityEngine] AudioContext resume failed:', err)
      })
    } else if (audioCtx && audioCtx.state === 'running') {
      isAudioUnlocked = true
    }
  } catch (err) {
    console.warn('[ProximityEngine] Error initializing AudioContext:', err)
  }
}

export function isAudioContextReady(): boolean {
  return isAudioUnlocked && !!audioCtx && audioCtx.state === 'running'
}

// ─── Tone Synthesizer ───

function playTone(freq: number, durationMs: number, gainValue: number, delayMs = 0): void {
  try {
    unlockAudioContext()
    if (!audioCtx || audioCtx.state !== 'running') return

    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    const startTime = audioCtx.currentTime + delayMs / 1000
    const stopTime = startTime + durationMs / 1000

    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, startTime)

    const vol = Math.max(0.01, Math.min(1, gainValue))
    gain.gain.setValueAtTime(0.001, startTime)
    gain.gain.exponentialRampToValueAtTime(vol, startTime + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.001, stopTime)

    osc.connect(gain)
    gain.connect(audioCtx.destination)

    osc.start(startTime)
    osc.stop(stopTime)
  } catch {
    /* ignore audio error */
  }
}

/**
 * Real Multi-Tier Beep Pattern
 * - CRITICAL: High-urgency triple chirp (1000Hz, 1100Hz, 1200Hz)
 * - DANGER: Double chirp (800Hz)
 * - WARNING: Single low pulse (550Hz)
 */
export function playAlertPattern(level: AlertLevel): void {
  if (!config.alertsEnabled) return

  const vol = config.volume
  switch (level) {
    case 'CRITICAL':
      playTone(1000, 70, vol, 0)
      playTone(1120, 70, vol, 90)
      playTone(1250, 80, vol, 180)
      break
    case 'DANGER':
      playTone(800, 90, vol * 0.8, 0)
      playTone(800, 90, vol * 0.8, 120)
      break
    case 'WARNING':
      playTone(550, 110, vol * 0.6, 0)
      break
  }
}

// ─── Haptic Vibration ───

function triggerVibration(level: AlertLevel): void {
  if (!config.vibrationEnabled || typeof navigator === 'undefined' || !navigator.vibrate) return
  try {
    switch (level) {
      case 'CRITICAL':
        navigator.vibrate([150, 60, 150, 60, 200])
        break
      case 'DANGER':
        navigator.vibrate([100, 50, 150])
        break
      case 'WARNING':
        navigator.vibrate(80)
        break
    }
  } catch {
    /* ignore */
  }
}

// ─── State Machine Evaluator ───

function evaluatePersonState(
  smoothedArea: number,
  heightRatio: number,
  direction: ApproachDirection,
  sensitivity: 'low' | 'medium' | 'high'
): { state: ProximityState; zone: ProximityZone; level: AlertLevel } {
  const t = THRESHOLDS[sensitivity] || THRESHOLDS.medium

  // PERSON_APPEARS_CLOSE (Critical)
  if (smoothedArea >= t.closeArea || heightRatio >= t.closeHeight) {
    return { state: 'PERSON_APPEARS_CLOSE', zone: 'NEAR', level: 'CRITICAL' }
  }

  // PERSON_APPROACHING (Danger)
  if (
    (smoothedArea >= t.medArea || heightRatio >= t.medHeight) &&
    (direction === 'APPROACHING' || smoothedArea >= t.medArea * 1.5)
  ) {
    return { state: 'PERSON_APPROACHING', zone: 'MEDIUM', level: 'DANGER' }
  }

  // PERSON_DETECTED (Warning)
  if (smoothedArea >= 0.03 || heightRatio >= 0.18) {
    return { state: 'PERSON_DETECTED', zone: 'FAR', level: 'WARNING' }
  }

  return { state: 'CLEAR', zone: 'FAR', level: 'WARNING' }
}

// ─── Main Pipeline ───

export function processDetectionsForProximity(
  detections: Detection[],
  frameWidth: number,
  frameHeight: number,
  options?: { suppressRoutinePersonVoice?: boolean },
): ProximityAlert[] {
  const frameArea = frameWidth * frameHeight
  if (frameArea === 0) {
    currentState = 'UNKNOWN'
    return []
  }

  const now = Date.now()
  const activeKeys = new Set<string>()
  const alerts: ProximityAlert[] = []

  // Crowd Intelligence: Check if frame contains a group of people (>= 4)
  const persons = detections.filter(d => d.class.toLowerCase() === 'person' && d.score >= 0.46)
  const isCrowdPresent = persons.length >= 4

  if (
    isCrowdPresent &&
    !options?.suppressRoutinePersonVoice &&
    config.voiceEnabled &&
    now - lastCrowdAnnouncementTime >= CROWD_COOLDOWN_MS
  ) {
    lastCrowdAnnouncementTime = now
    const crowdMessage = config.language === 'hi'
      ? 'आसपास लोगों का एक समूह है।'
      : 'A group of people is nearby.'
    SmartAnnouncementManager.announce(crowdMessage, 'NORMAL', {
      domain: 'crowd',
      lang: config.language === 'hi' ? 'hi' : 'en',
      cooldownMs: CROWD_COOLDOWN_MS,
    })
  }

  let highestPersonAlert: ProximityAlert | null = null
  const newlyActionableAlerts: Array<{ alert: ProximityAlert; trackState: string }> = []

  for (const det of detections) {
    if (det.score < 0.55) continue
    const isPerson = det.class.toLowerCase() === 'person'
    const [, , w, h] = det.bbox
    const area = (w * h) / frameArea
    const heightRatio = h / frameHeight

    // Use the tracked object ID so two people in the same part of the frame
    // keep independent distance trends and never merge into one target.
    const key = `${det.id}`
    activeKeys.add(key)
    lastSeenAt.set(key, now)

    // Increment persistence count
    const count = (persistenceCount.get(key) || 0) + 1
    persistenceCount.set(key, count)

    // Calculate moving average size over last 5 frames
    const history = sizeHistory.get(key) || []
    history.push(area)
    if (history.length > 5) history.shift()
    sizeHistory.set(key, history)

    const smoothedArea = history.reduce((sum, v) => sum + v, 0) / history.length

    // Determine direction trend
    let direction: ApproachDirection = 'STABLE'
    if (history.length >= 4) {
      const recentDiff = history[history.length - 1] - history[0]
      // Smaller objects need a proportional threshold too; the previous
      // absolute floor meant far-away objects almost never registered growth.
      const trendThreshold = Math.max(0.002, history[0] * 0.12)
      if (recentDiff > trendThreshold) direction = 'APPROACHING'
      else if (recentDiff < -trendThreshold) direction = 'RECEDING'
    }

    const { state, zone, level } = evaluatePersonState(
      smoothedArea,
      heightRatio,
      direction,
      config.sensitivity
    )

    const closenessScore = Math.min(100, Math.round((smoothedArea * 0.5 + heightRatio * 0.5) * 100))

    const proximityLabel = bleConnected && sensorDistance !== null
      ? `Calibrated ToF Sensor: ${Math.round(sensorDistance)} cm`
      : `Approximate Relative Zone: ${zone === 'NEAR' ? 'Very Close' : zone === 'MEDIUM' ? 'Nearby' : 'Far'}`

    const alert: ProximityAlert = {
      objectId: det.id,
      objectClass: det.class,
      zone,
      direction,
      relativeSize: smoothedArea,
      heightRatio,
      closenessScore,
      level,
      state: isPerson ? state : 'CLEAR',
      position: det.position,
      timestamp: now,
      isPerson,
      isMeasuredSensor: bleConnected && sensorDistance !== null,
      measuredDistanceCm: sensorDistance,
      relativeProximityLabel: proximityLabel,
    }

    alerts.push(alert)

    // Track most critical person detection
    if (isPerson && (!highestPersonAlert || closenessScore > highestPersonAlert.closenessScore)) {
      highestPersonAlert = alert
    }

    const isStableDetection = count >= 3
    const trackState = isPerson
      ? state
      : direction === 'APPROACHING'
        ? zone === 'NEAR' ? 'OBJECT_APPROACHING_NEAR' : 'OBJECT_APPROACHING'
        : zone === 'NEAR' ? 'OBJECT_CLOSE' : 'OBJECT_CLEAR'
    const actionable = isStableDetection && (
      (isPerson && (state === 'PERSON_APPROACHING' || state === 'PERSON_APPEARS_CLOSE')) ||
      (!isPerson && (direction === 'APPROACHING' || zone === 'NEAR'))
    )
    const previousTrackState = lastTrackState.get(key)
    if (actionable && previousTrackState !== trackState) {
      newlyActionableAlerts.push({ alert, trackState })
    } else if (!actionable) {
      lastTrackState.set(key, trackState)
    }
  }

  // Cleanup lost targets from history
  for (const [key] of sizeHistory.entries()) {
    if (!activeKeys.has(key) && now - (lastSeenAt.get(key) || 0) > 1000) {
      sizeHistory.delete(key)
      persistenceCount.delete(key)
      lastTrackState.delete(key)
      lastSeenAt.delete(key)
      if (now - (lastSeenAt.get(key) || 0) > 5000) {
        lastAnnouncedTrackTime.delete(key)
      }
    }
  }

  currentState = highestPersonAlert?.state || 'CLEAR'

  // Prioritize close targets, then announce one new transition at a time.
  // Unspoken targets remain eligible on the next frame instead of being lost
  // behind a person alert or the global speech cooldown.
  const voiceEligibleAlerts = options?.suppressRoutinePersonVoice
    ? newlyActionableAlerts.filter(({ alert }) => !alert.isPerson || alert.zone === 'NEAR')
    : newlyActionableAlerts
  voiceEligibleAlerts.sort((a, b) =>
    Number(b.alert.zone === 'NEAR') - Number(a.alert.zone === 'NEAR') ||
    b.alert.closenessScore - a.alert.closenessScore,
  )
  const selected = voiceEligibleAlerts[0]
  const alertIsReadyToSpeak = selected && config.voiceEnabled && now - lastVoiceAlertTime >= 2500
  if (selected && alertIsReadyToSpeak) {
    const strongestNewlyUrgentAlert = selected.alert

    // In a crowded setting, suppress individual person spam unless someone is in the NEAR critical zone
    if (isCrowdPresent && strongestNewlyUrgentAlert.isPerson && strongestNewlyUrgentAlert.zone !== 'NEAR') {
      return alerts.sort((a, b) => b.closenessScore - a.closenessScore)
    }

    // Suppress repeated stationary announcements for the exact same tracked target (8-second debounce)
    const targetKey = `${strongestNewlyUrgentAlert.objectId}`
    const lastAnnounceForTarget = lastAnnouncedTrackTime.get(targetKey) || 0
    if (now - lastAnnounceForTarget < OBJECT_ALERT_COOLDOWN_MS && strongestNewlyUrgentAlert.zone !== 'NEAR') {
      return alerts.sort((a, b) => b.closenessScore - a.closenessScore)
    }

    const position = config.language === 'hi'
      ? strongestNewlyUrgentAlert.position === 'LEFT' ? 'आपके बाईं ओर' : strongestNewlyUrgentAlert.position === 'RIGHT' ? 'आपके दाईं ओर' : 'सामने'
      : strongestNewlyUrgentAlert.position === 'LEFT' ? 'on your left' : strongestNewlyUrgentAlert.position === 'RIGHT' ? 'on your right' : 'ahead'
    const objectName = strongestNewlyUrgentAlert.isPerson
      ? (config.language === 'hi' ? 'एक व्यक्ति' : 'A person')
      : config.language === 'hi'
        ? (HINDI_OBJECT_NAMES[strongestNewlyUrgentAlert.objectClass] || strongestNewlyUrgentAlert.objectClass)
        : `A ${strongestNewlyUrgentAlert.objectClass}`
    const isClose = strongestNewlyUrgentAlert.zone === 'NEAR'
    const message = config.language === 'hi'
      ? strongestNewlyUrgentAlert.isPerson
        ? `${position} ${objectName} ${isClose ? 'बहुत पास' : 'करीब आता हुआ'} दिखाई दे रहा है।`
        : `${position} ${objectName} ${isClose ? 'बहुत पास है' : 'दिखाई दे रहा है'}${strongestNewlyUrgentAlert.direction === 'APPROACHING' ? ' और पास आता हुआ दिखाई दे रहा है' : ''}।`
      : strongestNewlyUrgentAlert.isPerson
        ? `${objectName} ${position} ${isClose ? 'appears very close' : 'appears to be getting closer'}.`
        : `${objectName} ${position} ${strongestNewlyUrgentAlert.direction === 'APPROACHING' ? 'appears to be getting closer' : 'is very close'}.`

    lastVoiceAlertTime = now
    lastAnnouncedTrackTime.set(targetKey, now)
    lastTrackState.set(targetKey, selected.trackState)

    // Route through single authoritative SmartAnnouncementManager (anti-echo & priority)
    SmartAnnouncementManager.announce(
      message,
      strongestNewlyUrgentAlert.zone === 'NEAR' ? 'HIGH' : 'NORMAL',
      {
        domain: 'proximity',
        lang: config.language === 'hi' ? 'hi' : 'en',
        force: strongestNewlyUrgentAlert.zone === 'NEAR',
        cooldownMs: 3000,
      }
    )

    if (
      strongestNewlyUrgentAlert.zone === 'NEAR' &&
      strongestNewlyUrgentAlert.direction === 'APPROACHING' &&
      now - lastBeepTime >= config.cooldownMs.critical
    ) {
      lastBeepTime = now
      playAlertPattern('CRITICAL')
    }
  }

  return alerts.sort((a, b) => b.closenessScore - a.closenessScore)
}

// ─── Getters & Setters ───

export function getProximityState(): ProximityState {
  return currentState
}

export function setAlertsEnabled(enabled: boolean): void {
  config.alertsEnabled = enabled
  if (enabled) unlockAudioContext()
}

export function setVibrationEnabled(enabled: boolean): void {
  config.vibrationEnabled = enabled
}

export function setVoiceAlertsEnabled(enabled: boolean): void {
  config.voiceEnabled = enabled
}

export function setAlertVolume(volume: number): void {
  config.volume = Math.max(0, Math.min(1, volume))
}

export function playTestBeep(level: AlertLevel = 'CRITICAL'): void {
  unlockAudioContext()
  playAlertPattern(level)
  triggerVibration(level)
}

export function getProximityConfig(): ProximityConfig {
  return { ...config }
}

export function updateProximityConfig(partial: Partial<ProximityConfig>): void {
  config = { ...config, ...partial }
}

export function initProximityEngine(): void {
  sizeHistory.clear()
  persistenceCount.clear()
  lastTrackState.clear()
  lastSeenAt.clear()
  lastBeepTime = 0
  lastVoiceAlertTime = 0
  currentState = 'CLEAR'
}

// ─── Optional Hardware BLE Sensor ───

export function isBLESupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

export function isVibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator
}

export function isBLESensorConnected(): boolean {
  return bleConnected
}

export function getSensorDistance(): number | null {
  return Date.now() - sensorDistanceAt <= 3000 ? sensorDistance : null
}

export type SensorRangeTrend = 'APPROACHING' | 'RECEDING' | 'STABLE' | 'UNKNOWN'

export function getSensorRangeTrend(): SensorRangeTrend {
  const now = Date.now()
  if (getSensorDistance() === null) return 'UNKNOWN'
  const recent = sensorReadings.filter((reading) => now - reading.at <= 2200)
  if (recent.length < 4 || recent[recent.length - 1].at - recent[0].at < 900) return 'UNKNOWN'

  const average = (values: typeof recent) => values.reduce((total, reading) => total + reading.centimeters, 0) / values.length
  const start = average(recent.slice(0, 2))
  const end = average(recent.slice(-2))
  const threshold = Math.max(8, start * 0.12)
  if (end < start - threshold) return 'APPROACHING'
  if (end > start + threshold) return 'RECEDING'
  return 'STABLE'
}

export async function connectBLESensor(): Promise<boolean> {
  if (!isBLESupported()) return false
  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
      optionalServices: [SERVICE_UUID],
    })
    const server = await device.gatt.connect()
    const service = await server.getPrimaryService(SERVICE_UUID)
    const characteristic = await service.getCharacteristic(DISTANCE_CHARACTERISTIC_UUID)
    if (typeof characteristic.startNotifications !== 'function') {
      throw new Error('The distance characteristic does not support BLE notifications.')
    }
    await characteristic.startNotifications()
    characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
      const value = event.target?.value as DataView | undefined
      if (!value) return
      const payload = new TextDecoder().decode(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)).trim()
      const match = /^NAVIAI\s*[:,]\s*(\d+(?:\.\d+)?)\s*$/i.exec(payload)
      const centimeters = match ? Number(match[1]) : NaN
      if (Number.isFinite(centimeters) && centimeters > 0 && centimeters <= 1000) {
        sensorDistance = centimeters
        sensorDistanceAt = Date.now()
        sensorReadings.push({ centimeters, at: sensorDistanceAt })
        if (sensorReadings.length > 8) sensorReadings.shift()
      }
    })

    bleDevice = device
    bleCharacteristic = characteristic
    bleConnected = true
    sensorReadings.length = 0
    device.addEventListener('gattserverdisconnected', () => {
      bleConnected = false
      bleCharacteristic = null
      sensorDistance = null
      sensorDistanceAt = 0
      sensorReadings.length = 0
    })
    return true
  } catch (err) {
    console.warn('[BLE] Sensor connection error:', err)
    bleConnected = false
    bleCharacteristic = null
    sensorDistance = null
    sensorDistanceAt = 0
    sensorReadings.length = 0
    return false
  }
}

export function disconnectBLESensor(): void {
  try {
    bleCharacteristic?.stopNotifications?.()
  } catch {
    /* Ignore devices that have already disconnected. */
  }
  if (bleDevice && bleDevice.gatt?.connected) {
    bleDevice.gatt.disconnect()
  }
  bleDevice = null
  bleCharacteristic = null
  bleConnected = false
  sensorDistance = null
  sensorDistanceAt = 0
  sensorReadings.length = 0
}
