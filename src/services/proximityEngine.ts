import type { Detection } from './objectDetection'
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
}

export interface ProximityConfig {
  alertsEnabled: boolean
  vibrationEnabled: boolean
  voiceEnabled: boolean
  volume: number
  sensitivity: 'low' | 'medium' | 'high'
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
  cooldownMs: {
    critical: 650,
    danger: 1200,
    warning: 2500,
  },
}

// Tracking history: key -> size history
const sizeHistory: Map<string, number[]> = new Map()
// Persistence counter: key -> consecutive frame detections
const persistenceCount: Map<string, number> = new Map()
// Last beep timestamp per alert level
let lastBeepTime = 0
let lastVoiceAlertTime = 0
let currentState: ProximityState = 'CLEAR'

// BLE hardware integration
let sensorDistance: number | null = null
let bleConnected = false
let bleDevice: any = null

// ─── Sensitivity Thresholds ───

const THRESHOLDS = {
  low: { closeArea: 0.38, closeHeight: 0.70, medArea: 0.15, medHeight: 0.40 },
  medium: { closeArea: 0.26, closeHeight: 0.55, medArea: 0.08, medHeight: 0.30 },
  high: { closeArea: 0.18, closeHeight: 0.45, medArea: 0.05, medHeight: 0.22 },
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
  frameHeight: number
): ProximityAlert[] {
  const frameArea = frameWidth * frameHeight
  if (frameArea === 0) {
    currentState = 'UNKNOWN'
    return []
  }

  const now = Date.now()
  const activeKeys = new Set<string>()
  const alerts: ProximityAlert[] = []

  let highestPersonAlert: ProximityAlert | null = null

  for (const det of detections) {
    const isPerson = det.class.toLowerCase() === 'person'
    const [, , w, h] = det.bbox
    const area = (w * h) / frameArea
    const heightRatio = h / frameHeight

    const key = `${det.class}-${det.position}`
    activeKeys.add(key)

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
    if (history.length >= 3) {
      const recentDiff = history[history.length - 1] - history[0]
      if (recentDiff > 0.018) direction = 'APPROACHING'
      else if (recentDiff < -0.018) direction = 'RECEDING'
    }

    const { state, zone, level } = evaluatePersonState(
      smoothedArea,
      heightRatio,
      direction,
      config.sensitivity
    )

    const closenessScore = Math.min(100, Math.round((smoothedArea * 0.5 + heightRatio * 0.5) * 100))

    const alert: ProximityAlert = {
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
    }

    alerts.push(alert)

    // Track most critical person detection
    if (isPerson && (!highestPersonAlert || closenessScore > highestPersonAlert.closenessScore)) {
      highestPersonAlert = alert
    }
  }

  // Cleanup lost targets from history
  for (const [key] of sizeHistory.entries()) {
    if (!activeKeys.has(key)) {
      sizeHistory.delete(key)
      persistenceCount.delete(key)
    }
  }

  // Update global state machine
  if (highestPersonAlert) {
    currentState = highestPersonAlert.state
    const level = highestPersonAlert.level
    const requiredCooldown = config.cooldownMs[level === 'CRITICAL' ? 'critical' : level === 'DANGER' ? 'danger' : 'warning']

    // Trigger Beep & Haptics with debounced cooldown
    if (
      (highestPersonAlert.state === 'PERSON_APPEARS_CLOSE' || highestPersonAlert.state === 'PERSON_APPROACHING') &&
      now - lastBeepTime >= requiredCooldown
    ) {
      lastBeepTime = now
      playAlertPattern(level)
      triggerVibration(level)
    }

    // Voice announcement with calm cooldown (8.0s) to avoid repetitive alarming speech
    if (
      config.voiceEnabled &&
      highestPersonAlert.state === 'PERSON_APPEARS_CLOSE' &&
      now - lastVoiceAlertTime >= 8000
    ) {
      lastVoiceAlertTime = now
      speak('Warning! A person appears very close.', 'en-US', undefined, 'HIGH')
    }
  } else {
    currentState = 'CLEAR'
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
  return sensorDistance
}

export async function connectBLESensor(): Promise<boolean> {
  if (!isBLESupported()) return false
  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [{ services: ['0000ffe0-0000-1000-8000-00805f9b34fb'] }],
      optionalServices: ['battery_service'],
    })
    const server = await device.gatt.connect()
    bleDevice = device
    bleConnected = true
    return true
  } catch (err) {
    console.warn('[BLE] Sensor connection error:', err)
    bleConnected = false
    return false
  }
}

export function disconnectBLESensor(): void {
  if (bleDevice && bleDevice.gatt?.connected) {
    bleDevice.gatt.disconnect()
  }
  bleDevice = null
  bleConnected = false
  sensorDistance = null
}
