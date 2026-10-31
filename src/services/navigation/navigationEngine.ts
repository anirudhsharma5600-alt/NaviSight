/**
 * NaviAble AI — Pedestrian Navigation Engine
 * 
 * Central state machine for assistive turn-by-turn walking guidance:
 * - Real GPS tracking with accuracy calibration & jump filtering.
 * - Turf.js spatial route projection and off-route hysteresis.
 * - Priority-managed voice guidance via SmartAnnouncementManager.
 * - Conservative obstacle awareness integration from vision pipeline.
 * - Interactive route simulator for laptop indoor testing.
 */

import * as turf from '@turf/turf'
import { GPSService, type GPSPosition } from '../GPSService'
import { routingService } from './routingProvider'
import { SmartAnnouncementManager } from '../SmartAnnouncementManager'
import { getLatestDetections } from '../naviEventBus'
import type {
  PedestrianRoute,
  RouteStep,
  NavigationMode,
  NavigationProgress,
  NavigationConfig,
  GeoCoordinate,
  ObstacleDetectionWarning,
  GPSAccuracyQuality,
} from './types'

export type NavigationListener = (state: {
  mode: NavigationMode
  route: PedestrianRoute | null
  currentPosition: GPSPosition | null
  progress: NavigationProgress | null
  gpsQuality: GPSAccuracyQuality
  activeObstacle: ObstacleDetectionWarning | null
  isSimulating: boolean
}) => void

const DEFAULT_CONFIG: NavigationConfig = {
  voiceGuidanceEnabled: true,
  vibrationEnabled: true,
  announcementDistance60m: 65,
  announcementDistance25m: 28,
  turnArrivalDistanceMeters: 12,
  destinationArrivalDistanceMeters: 15,
  offRouteThresholdMeters: 35,
  offRouteConsecutiveSamples: 3,
  gpsUncertainThresholdMeters: 35,
  obstacleWarningCooldownMs: 8000,
}

class NavigationEngineClass {
  private mode: NavigationMode = 'IDLE'
  private route: PedestrianRoute | null = null
  private currentPosition: GPSPosition | null = null
  private progress: NavigationProgress | null = null
  private config: NavigationConfig = { ...DEFAULT_CONFIG }
  private listeners: Set<NavigationListener> = new Set()

  // Guidance state & hysteresis
  private currentStepIndex = 0
  private stepNotified60m = false
  private stepNotified25m = false
  private stepNotifiedTurnNow = false
  private offRouteCount = 0
  private lastAnnouncementText = ''
  private lastAnnouncementTime = 0

  // GPS monitoring
  private lastPositionTimestamp = 0
  private consecutivePoorGpsSamples = 0
  private lastGpsWarningTime = 0

  // Obstacle awareness
  private obstacleCheckInterval: any = null
  private activeObstacle: ObstacleDetectionWarning | null = null
  private lastObstacleWarningTime = 0
  private consecutiveObstacleHits = 0

  // Simulation mode (laptop testing)
  private isSimulating = false
  private simInterval: any = null
  private simPointIndex = 0
  private simSpeedMultiplier = 1.0 // 1x = 1.4 m/s walking speed

  constructor() {
    // Listen to GPS updates from GPSService
    GPSService.startTracking(
      (pos) => this.handleGPSUpdate(pos),
      (err) => this.handleGPSError(err)
    )

    this.startObstacleMonitoring()
  }

  // ─── Subscription & Config ───

  public subscribe(listener: NavigationListener): () => void {
    this.listeners.add(listener)
    this.notify()
    return () => this.listeners.delete(listener)
  }

  public setConfig(custom: Partial<NavigationConfig>) {
    this.config = { ...this.config, ...custom }
  }

  public getConfig(): NavigationConfig {
    return { ...this.config }
  }

  public getMode(): NavigationMode {
    return this.mode
  }

  public getRoute(): PedestrianRoute | null {
    return this.route
  }

  public getProgress(): NavigationProgress | null {
    return this.progress
  }

  public getCurrentPosition(): GPSPosition | null {
    return this.currentPosition
  }

  // ─── Route Loading & Control ───

  public async setDestination(destination: GeoCoordinate, destinationName?: string): Promise<PedestrianRoute> {
    const origin = this.currentPosition
      ? { lat: this.currentPosition.lat, lng: this.currentPosition.lng }
      : await GPSService.getCurrentPosition().then(p => ({ lat: p.lat, lng: p.lng }))

    this.speak('Calculating walking route.', 'NORMAL')
    this.mode = 'RECALCULATING'
    this.notify()

    try {
      const calculatedRoute = await routingService.getRoute(origin, destination, destinationName)
      this.route = calculatedRoute
      this.mode = 'ROUTE_LOADED'
      this.currentStepIndex = 0
      this.resetStepNotifiers()

      const distKm = (calculatedRoute.totalDistanceMeters / 1000).toFixed(1)
      const durationMin = Math.round(calculatedRoute.totalDurationSeconds / 60)
      this.speak(`Walking route found. Approximately ${distKm} kilometres, ${durationMin} minutes walking. Say start navigation to begin.`, 'NORMAL')

      this.updateProgress(origin)
      this.notify()
      return calculatedRoute
    } catch (err: any) {
      this.mode = 'IDLE'
      this.speak(`Could not calculate walking route: ${err.message}`, 'HIGH')
      this.notify()
      throw err
    }
  }

  public startNavigation(): boolean {
    if (!this.route) {
      this.speak('Please choose a destination first.', 'NORMAL')
      return false
    }

    this.mode = 'NAVIGATING'
    this.resetStepNotifiers()
    this.speak('Walking route started. Please proceed with caution and use your regular mobility aid.', 'MEDIUM')

    // Trigger initial direction
    if (this.currentPosition) {
      this.updateProgress({ lat: this.currentPosition.lat, lng: this.currentPosition.lng })
    }
    this.notify()
    return true
  }

  public stopNavigation() {
    this.mode = 'IDLE'
    this.route = null
    this.progress = null
    this.stopSimulation()
    this.speak('Navigation stopped.', 'NORMAL')
    this.notify()
  }

  public pauseNavigation() {
    if (this.mode === 'NAVIGATING') {
      this.mode = 'PAUSED'
      this.speak('Navigation paused.', 'NORMAL')
      this.notify()
    }
  }

  public resumeNavigation() {
    if (this.mode === 'PAUSED') {
      this.mode = 'NAVIGATING'
      this.speak('Navigation resumed.', 'NORMAL')
      this.notify()
    }
  }

  public async recalculateRoute(): Promise<boolean> {
    if (!this.route || !this.currentPosition) {
      this.speak('Cannot recalculate: current location or destination missing.', 'HIGH')
      return false
    }

    this.speak('Recalculating pedestrian route from your current location.', 'MEDIUM')
    this.mode = 'RECALCULATING'
    this.notify()

    try {
      const currentCoord = { lat: this.currentPosition.lat, lng: this.currentPosition.lng }
      const newRoute = await routingService.getRoute(currentCoord, this.route.destination, this.route.destinationName)
      this.route = newRoute
      this.currentStepIndex = 0
      this.resetStepNotifiers()
      this.offRouteCount = 0
      this.mode = 'NAVIGATING'
      this.speak('New walking route mapped. Follow the updated direction.', 'MEDIUM')
      this.updateProgress(currentCoord)
      this.notify()
      return true
    } catch {
      this.speak('Could not calculate a new walking route. Please pause and check your surroundings.', 'HIGH')
      this.mode = 'PAUSED'
      this.notify()
      return false
    }
  }

  public repeatInstruction() {
    if (this.progress && this.progress.currentStep) {
      const step = this.progress.currentStep
      const dist = Math.round(this.progress.distanceToNextTurnMeters)
      this.speak(`Next instruction: ${step.instruction} in ${dist} metres.`, 'MEDIUM', true)
    } else {
      this.speak('No active navigation instruction.', 'NORMAL')
    }
  }

  // ─── GPS & Spatial Processing ───

  private handleGPSUpdate(pos: GPSPosition) {
    if (this.isSimulating) return // Do not overwrite simulated GPS during simulation

    // Jump filtering: reject updates claiming > 45 m/s speed for a walking user
    if (this.currentPosition && pos.speed && pos.speed > 45) {
      console.warn('[NavigationEngine] Filtered impossible GPS jump:', pos.speed, 'm/s')
      return
    }

    this.currentPosition = pos
    this.lastPositionTimestamp = Date.now()

    // GPS Accuracy Assessment
    const quality = this.getGPSQuality()
    if (!quality.isReliableForTurns) {
      this.consecutivePoorGpsSamples++
      if (this.consecutivePoorGpsSamples >= 3 && Date.now() - this.lastGpsWarningTime > 20000) {
        this.lastGpsWarningTime = Date.now()
        this.speak('Your location signal is uncertain. Please pause and verify your position.', 'HIGH')
      }
    } else {
      this.consecutivePoorGpsSamples = 0
    }

    if (this.mode === 'NAVIGATING' && this.route) {
      this.updateProgress({ lat: pos.lat, lng: pos.lng })
    }

    this.notify()
  }

  private handleGPSError(err: any) {
    console.warn('[NavigationEngine] GPS error:', err.message)
    if (this.mode === 'NAVIGATING') {
      this.speak('Location signal lost. Please pause your movement.', 'HIGH')
    }
    this.notify()
  }

  /**
   * Turf.js Route Matching, Progress Calculation & Turn Triggering
   */
  private updateProgress(coord: { lat: number; lng: number }) {
    if (!this.route || this.route.geometry.length < 2) return

    const userPt = turf.point([coord.lng, coord.lat])
    const routeLine = turf.lineString(this.route.geometry)

    // 1. Distance from route (Turf.js)
    const distFromRouteMeters = Math.round(turf.pointToLineDistance(userPt, routeLine, { units: 'meters' }))

    // 2. Off-Route Detection with Hysteresis
    const offRouteThreshold = this.config.offRouteThresholdMeters
    if (distFromRouteMeters > offRouteThreshold) {
      this.offRouteCount++
      if (this.offRouteCount >= this.config.offRouteConsecutiveSamples) {
        this.speak('Your location appears to be away from the mapped route. Please pause while I recalculate.', 'HIGH')
        this.recalculateRoute()
        return
      }
    } else {
      this.offRouteCount = Math.max(0, this.offRouteCount - 1)
    }

    // 3. Distance to Destination & Arrival Check
    const destCoord = this.route.destination
    const destPt = turf.point([destCoord.lng, destCoord.lat])
    const distToDest = Math.round(turf.distance(userPt, destPt, { units: 'meters' }))

    if (distToDest <= this.config.destinationArrivalDistanceMeters) {
      this.mode = 'ARRIVED'
      this.speak('You have reached the destination area. Please verify the exact entrance.', 'HIGH', true)
      if (this.config.vibrationEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 400])
      }
      this.notify()
      return
    }

    // 4. Current Step Progress & Next Turn Guidance
    const steps = this.route.steps
    let activeStep = steps[this.currentStepIndex] || steps[0]
    let nextStep = steps[this.currentStepIndex + 1] || null

    if (activeStep) {
      const stepTargetPt = turf.point(activeStep.coordinate)
      const distToTurn = Math.round(turf.distance(userPt, stepTargetPt, { units: 'meters' }))

      // Advance step if user reached turn waypoint
      if (distToTurn <= this.config.turnArrivalDistanceMeters && this.currentStepIndex < steps.length - 1) {
        this.currentStepIndex++
        this.resetStepNotifiers()
        activeStep = steps[this.currentStepIndex]
        nextStep = steps[this.currentStepIndex + 1] || null
      }

      // Check Spoken Guidance Thresholds (Only if GPS is reliable)
      const quality = this.getGPSQuality()
      if (quality.isReliableForTurns && this.mode === 'NAVIGATING') {
        if (distToTurn <= this.config.announcementDistance60m && distToTurn > this.config.announcementDistance25m && !this.stepNotified60m) {
          this.stepNotified60m = true
          const msg = activeStep.spokenNotice60m || `In approximately 60 metres, ${activeStep.instruction}`
          this.speak(msg, 'MEDIUM')
        } else if (distToTurn <= this.config.announcementDistance25m && distToTurn > this.config.turnArrivalDistanceMeters && !this.stepNotified25m) {
          this.stepNotified25m = true
          const msg = activeStep.spokenNotice25m || `In approximately 25 metres, ${activeStep.instruction}`
          this.speak(msg, 'MEDIUM')
          if (this.config.vibrationEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate([150, 80, 150])
          }
        } else if (distToTurn <= this.config.turnArrivalDistanceMeters && !this.stepNotifiedTurnNow) {
          this.stepNotifiedTurnNow = true
          const msg = activeStep.spokenTurnNow || `${activeStep.instruction} now`
          this.speak(msg, 'HIGH')
        }
      }

      this.progress = {
        currentStepIndex: this.currentStepIndex,
        currentStep: activeStep,
        nextStep,
        distanceToNextTurnMeters: distToTurn,
        distanceRemainingMeters: distToDest,
        estimatedTimeRemainingSeconds: Math.round(distToDest / 1.3),
        distanceFromRouteMeters: distFromRouteMeters,
        isOffRoute: this.offRouteCount >= 2,
        lastSpokenInstruction: this.lastAnnouncementText,
      }
    }
  }

  private resetStepNotifiers() {
    this.stepNotified60m = false
    this.stepNotified25m = false
    this.stepNotifiedTurnNow = false
  }

  public getGPSQuality(): GPSAccuracyQuality {
    if (!this.currentPosition) {
      return { accuracyMeters: 999, quality: 'UNUSABLE', isReliableForTurns: false }
    }
    const acc = this.currentPosition.accuracy
    if (acc <= 10) return { accuracyMeters: acc, quality: 'EXCELLENT', isReliableForTurns: true }
    if (acc <= 20) return { accuracyMeters: acc, quality: 'GOOD', isReliableForTurns: true }
    if (acc <= 35) return { accuracyMeters: acc, quality: 'MODERATE', isReliableForTurns: true }
    if (acc <= 65) return { accuracyMeters: acc, quality: 'POOR', isReliableForTurns: false }
    return { accuracyMeters: acc, quality: 'UNUSABLE', isReliableForTurns: false }
  }

  // ─── Obstacle Awareness Integration ───

  private startObstacleMonitoring() {
    if (typeof window === 'undefined') return
    if (this.obstacleCheckInterval) clearInterval(this.obstacleCheckInterval)

    this.obstacleCheckInterval = setInterval(() => {
      if (this.mode !== 'NAVIGATING') return

      const detections = getLatestDetections()
      if (!detections || detections.length === 0) {
        this.consecutiveObstacleHits = 0
        this.activeObstacle = null
        return
      }

      // Check for prominent front obstacles (person, car, truck, bus, motorcycle, bicycle, bench, chair, stop sign)
      const obstacleCandidates = detections.filter(d => {
        const isHazardClass = ['person', 'car', 'motorcycle', 'truck', 'bus', 'bicycle', 'bench', 'chair'].includes(d.class.toLowerCase())
        // Prominent obstacle: bbox height occupies > 28% of frame and score >= 0.45
        const isClose = (d.bbox[3] >= 80 || (d.bbox[2] * d.bbox[3]) > 15000)
        return isHazardClass && d.score >= 0.45 && isClose
      })

      if (obstacleCandidates.length > 0) {
        this.consecutiveObstacleHits++
        const top = obstacleCandidates[0]

        // Temporal consistency: must be seen across 2 consecutive checks
        if (this.consecutiveObstacleHits >= 2) {
          const now = Date.now()
          if (now - this.lastObstacleWarningTime > this.config.obstacleWarningCooldownMs) {
            this.lastObstacleWarningTime = now
            const spokenWarning = `Possible obstacle detected ahead. Pause and check with your usual mobility aid.`
            this.activeObstacle = {
              objectClass: top.class,
              confidence: top.score,
              position: top.position,
              timestamp: now,
              spokenWarning,
            }
            // Dispatched with HIGH priority to preempt normal turn instructions
            this.speak(spokenWarning, 'HIGH')
            if (this.config.vibrationEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              navigator.vibrate([300, 100, 300])
            }
            this.notify()
          }
        }
      } else {
        this.consecutiveObstacleHits = 0
        this.activeObstacle = null
      }
    }, 1500)
  }

  // ─── Voice Guidance Dispatch ───

  private speak(text: string, priority: 'HIGH' | 'MEDIUM' | 'NORMAL' | 'LOW' = 'MEDIUM', force = false) {
    if (!this.config.voiceGuidanceEnabled && priority !== 'HIGH') return
    if (!text) return

    // Debounce exact duplicate phrases within 4000ms
    const now = Date.now()
    if (!force && this.lastAnnouncementText === text && now - this.lastAnnouncementTime < 4000) {
      return
    }

    this.lastAnnouncementText = text
    this.lastAnnouncementTime = now

    // Dispatch via SmartAnnouncementManager
    SmartAnnouncementManager.announce(text, priority, {
      force,
      cooldownMs: 2500,
      domain: 'system',
    })
  }

  // ─── Interactive Route Simulator (for Laptop Testing) ───

  public startSimulation(speedMultiplier = 1.0) {
    if (!this.route || this.route.geometry.length === 0) {
      this.speak('Please load a route before starting simulation.', 'NORMAL')
      return
    }

    this.stopSimulation()
    this.isSimulating = true
    this.simPointIndex = 0
    this.simSpeedMultiplier = speedMultiplier
    this.mode = 'NAVIGATING'
    this.speak('Route simulation mode started.', 'NORMAL')

    const geom = this.route.geometry
    const tickMs = 1000

    this.simInterval = setInterval(() => {
      if (this.simPointIndex >= geom.length) {
        this.stopSimulation()
        this.mode = 'ARRIVED'
        this.speak('Simulation complete: destination reached.', 'HIGH')
        this.notify()
        return
      }

      const coord = geom[this.simPointIndex]
      const simulatedPos: GPSPosition = {
        lat: coord[1],
        lng: coord[0],
        altitude: 10,
        accuracy: 8, // simulated accurate GPS
        heading: 0,
        speed: 1.4 * this.simSpeedMultiplier,
        timestamp: Date.now(),
      }

      this.currentPosition = simulatedPos
      this.updateProgress({ lat: simulatedPos.lat, lng: simulatedPos.lng })
      this.notify()

      // Advance along coordinates
      this.simPointIndex += Math.max(1, Math.round(this.simSpeedMultiplier))
    }, tickMs)

    this.notify()
  }

  public stopSimulation() {
    if (this.simInterval) {
      clearInterval(this.simInterval)
      this.simInterval = null
    }
    this.isSimulating = false
    this.notify()
  }

  public simulateDeviation() {
    if (!this.route || !this.currentPosition) return
    this.speak('Simulating off-route deviation.', 'NORMAL')
    // Offset current location by ~50 meters east
    this.currentPosition = {
      ...this.currentPosition,
      lng: this.currentPosition.lng + 0.0006,
      timestamp: Date.now(),
    }
    this.updateProgress({ lat: this.currentPosition.lat, lng: this.currentPosition.lng })
    this.notify()
  }

  private notify() {
    const state = {
      mode: this.mode,
      route: this.route,
      currentPosition: this.currentPosition,
      progress: this.progress,
      gpsQuality: this.getGPSQuality(),
      activeObstacle: this.activeObstacle,
      isSimulating: this.isSimulating,
    }
    this.listeners.forEach(fn => fn(state))
  }
}

export const navigationEngine = new NavigationEngineClass()
