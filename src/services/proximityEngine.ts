import type { Detection } from './objectDetection'

// ─── Types ───

export type AlertLevel = 'WARNING' | 'DANGER' | 'CRITICAL'
export type ProximityZone = 'NEAR' | 'MEDIUM' | 'FAR'
export type ApproachDirection = 'APPROACHING' | 'STABLE' | 'RECEDING'

export interface ProximityAlert {
  objectClass: string
  zone: ProximityZone
  direction: ApproachDirection
  relativeSize: number
  level: AlertLevel
  position: 'LEFT' | 'CENTRE' | 'RIGHT'
  timestamp: number
}

export interface ProximityConfig {
  alertsEnabled: boolean
  vibrationEnabled: boolean
  voiceEnabled: boolean
  volume: number
  sensitivity: 'low' | 'medium' | 'high'
}

// ─── State ───

let audioCtx: AudioContext | null = null
let config: ProximityConfig = {
  alertsEnabled: true,
  vibrationEnabled: true,
  voiceEnabled: true,
  volume: 0.6,
  sensitivity: 'medium',
}

const previousSizes: Map<string, number[]> = new Map()
const lastAlertTime: Map<string, number> = new Map()

// BLE sensor state
let bleDevice: BluetoothDevice | null = null
let bleConnected = false
let sensorDistance: number | null = null

// ─── Thresholds per sensitivity ───

const THRESHOLDS: Record<string, { near: number; medium: number }> = {
  low: { near: 0.35, medium: 0.12 },
  medium: { near: 0.25, medium: 0.08 },
  high: { near: 0.18, medium: 0.05 },
}

// ─── Audio Context (lazy init) ───

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

// ─── Beep Generation ───

function playBeep(frequency: number, duration: number, vol: number): void {
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(frequency, ctx.currentTime)
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch {
    // Audio not available
  }
}

function playAlertBeep(level: AlertLevel, volume: number): void {
  const vol = Math.max(0, Math.min(1, volume))
  switch (level) {
    case 'WARNING':
      playBeep(600, 0.15, vol * 0.5)
      break
    case 'DANGER':
      playBeep(800, 0.12, vol * 0.7)
      setTimeout(() => playBeep(800, 0.12, vol * 0.7), 150)
      break
    case 'CRITICAL':
      playBeep(1000, 0.1, vol)
      setTimeout(() => playBeep(1000, 0.1, vol), 130)
      setTimeout(() => playBeep(1000, 0.1, vol), 260)
      break
  }
}

// ─── Vibration ───

function vibrateForLevel(level: AlertLevel): void {
  if (!navigator.vibrate) return
  switch (level) {
    case 'WARNING':
      navigator.vibrate(100)
      break
    case 'DANGER':
      navigator.vibrate([100, 50, 200])
      break
    case 'CRITICAL':
      navigator.vibrate([100, 50, 200, 50, 300])
      break
  }
}

// ─── Proximity Zone Calculation ───

function calcZone(relativeSize: number, sensitivity: string): ProximityZone {
  const t = THRESHOLDS[sensitivity] || THRESHOLDS.medium
  if (relativeSize >= t.near) return 'NEAR'
  if (relativeSize >= t.medium) return 'MEDIUM'
  return 'FAR'
}

function zoneToLevel(zone: ProximityZone): AlertLevel {
  switch (zone) {
    case 'NEAR': return 'CRITICAL'
    case 'MEDIUM': return 'DANGER'
    case 'FAR': return 'WARNING'
  }
}

// ─── Temporal Smoothing ───

function getSmoothedSize(key: string, currentSize: number): number {
  const history = previousSizes.get(key) || []
  history.push(currentSize)
  if (history.length > 5) history.shift()
  previousSizes.set(key, history)
  return history.reduce((a, b) => a + b, 0) / history.length
}

function getDirection(key: string): ApproachDirection {
  const history = previousSizes.get(key) || []
  if (history.length < 3) return 'STABLE'
  const recent = history.slice(-3)
  const trend = recent[2] - recent[0]
  if (trend > 0.02) return 'APPROACHING'
  if (trend < -0.02) return 'RECEDING'
  return 'STABLE'
}

// ─── Cooldown ───

function shouldAlert(key: string, level: AlertLevel): boolean {
  const now = Date.now()
  const last = lastAlertTime.get(key) || 0
  const cooldown = level === 'CRITICAL' ? 500 : level === 'DANGER' ? 1000 : 2000
  if (now - last < cooldown) return false
  lastAlertTime.set(key, now)
  return true
}

// ─── Public API ───

export function initProximityEngine(): void {
  previousSizes.clear()
  lastAlertTime.clear()
}

export function processDetectionsForProximity(
  detections: Detection[],
  frameWidth: number,
  frameHeight: number
): ProximityAlert[] {
  const frameArea = frameWidth * frameHeight
  if (frameArea === 0) return []

  const alerts: ProximityAlert[] = []

  for (const det of detections) {
    const [, , w, h] = det.bbox
    const objArea = w * h
    const relativeSize = objArea / frameArea
    const key = `${det.class}-${det.position}`

    const smoothed = getSmoothedSize(key, relativeSize)
    const zone = calcZone(smoothed, config.sensitivity)
    const direction = getDirection(key)
    const level = zoneToLevel(zone)

    const alert: ProximityAlert = {
      objectClass: det.class,
      zone,
      direction,
      relativeSize: smoothed,
      level,
      position: det.position,
      timestamp: Date.now(),
    }
    alerts.push(alert)

    // Trigger audio/vibration for MEDIUM and NEAR only
    if (zone !== 'FAR' && shouldAlert(key, level)) {
      if (config.alertsEnabled) {
        playAlertBeep(level, config.volume)
      }
      if (config.vibrationEnabled) {
        vibrateForLevel(level)
      }
    }
  }

  return alerts.sort((a, b) => b.relativeSize - a.relativeSize)
}

export function setAlertVolume(vol: number): void {
  config.volume = Math.max(0, Math.min(1, vol))
}

export function setAlertsEnabled(enabled: boolean): void {
  config.alertsEnabled = enabled
}

export function setVibrationEnabled(enabled: boolean): void {
  config.vibrationEnabled = enabled
}

export function setVoiceAlertsEnabled(enabled: boolean): void {
  config.voiceEnabled = enabled
}

export function playTestBeep(level: AlertLevel): void {
  playAlertBeep(level, config.volume)
}

export function getProximityConfig(): ProximityConfig {
  return { ...config }
}

export function updateProximityConfig(partial: Partial<ProximityConfig>): void {
  config = { ...config, ...partial }
}

// ─── BLE Sensor Integration (Optional) ───

const BLE_SERVICE_UUID = '12345678-1234-1234-1234-123456789abc'
const BLE_CHAR_UUID = '12345678-1234-1234-1234-123456789abd'

export function isBLESupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

export async function connectBLESensor(): Promise<boolean> {
  if (!isBLESupported()) {
    console.warn('[Proximity] Web Bluetooth not supported')
    return false
  }

  try {
    bleDevice = await navigator.bluetooth.requestDevice({
      filters: [{ services: [BLE_SERVICE_UUID] }],
      optionalServices: [BLE_SERVICE_UUID],
    })

    if (!bleDevice.gatt) return false

    const server = await bleDevice.gatt.connect()
    const service = await server.getPrimaryService(BLE_SERVICE_UUID)
    const characteristic = await service.getCharacteristic(BLE_CHAR_UUID)

    characteristic.addEventListener('characteristicvaluechanged', (event: Event) => {
      const target = event.target as BluetoothRemoteGATTCharacteristic
      if (target.value) {
        sensorDistance = target.value.getFloat32(0, true)
      }
    })

    await characteristic.startNotifications()
    bleConnected = true
    console.log('[Proximity] BLE sensor connected')
    return true
  } catch (err) {
    console.warn('[Proximity] BLE connection failed:', err)
    bleConnected = false
    return false
  }
}

export function disconnectBLESensor(): void {
  if (bleDevice?.gatt?.connected) {
    bleDevice.gatt.disconnect()
  }
  bleConnected = false
  sensorDistance = null
}

export function isBLESensorConnected(): boolean {
  return bleConnected
}

export function getSensorDistance(): number | null {
  return sensorDistance
}

export function isVibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator
}
