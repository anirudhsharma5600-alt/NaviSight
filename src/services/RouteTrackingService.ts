/**
 * NaviAble AI — Route Tracking & Navigation Service
 * 
 * Provides:
 * - Real-time breadcrumb path recording with GPS jitter filtering.
 * - Landmark tagging with timestamp, coordinates, and voice notes.
 * - Distance calculation via Haversine formula.
 * - Route deviation detection (>35m threshold) with spoken alerts.
 * - GPS accuracy diagnostics and indoor degradation alerts.
 * - Spatial Safety Disclaimers (GPS uncertainty, real-world road changes).
 */

import { GPSService, type GPSPosition, type RouteDeviationResult } from './GPSService'
import { MemoryRepository, type SavedRoute, type SavedRoutePoint, type RouteLandmark } from '../remember/MemoryRepository'

export type TrackingMode = 'IDLE' | 'RECORDING' | 'NAVIGATING'

export interface RouteStatus {
  mode: TrackingMode
  currentRouteId?: string
  currentRouteName?: string
  pointCount: number
  distanceMeters: number
  elapsedSeconds: number
  lastAccuracyMeters: number
  landmarksCount: number
}

type StatusListener = (status: RouteStatus) => void
type DeviationListener = (result: RouteDeviationResult, currentPos: GPSPosition) => void

class RouteTrackingServiceClass {
  private mode: TrackingMode = 'IDLE'
  private recordingPoints: SavedRoutePoint[] = []
  private landmarks: RouteLandmark[] = []
  private startTime: number = 0
  private routeName: string = ''
  private startLocationName: string = ''
  private totalDistance: number = 0
  private lastPosition: GPSPosition | null = null
  private accuracySum: number = 0

  // Navigation mode state
  private activeRoute: SavedRoute | null = null
  private lastDeviationAlertTime: number = 0
  private lastDeviationDistance: number = 0

  private statusListeners: Set<StatusListener> = new Set()
  private deviationListeners: Set<DeviationListener> = new Set()

  public getMode(): TrackingMode {
    return this.mode
  }

  public getStatus(): RouteStatus {
    const elapsed = this.startTime > 0 ? Math.round((Date.now() - this.startTime) / 1000) : 0
    return {
      mode: this.mode,
      currentRouteId: this.activeRoute?.id,
      currentRouteName: this.mode === 'RECORDING' ? this.routeName : this.activeRoute?.route_name,
      pointCount: this.recordingPoints.length,
      distanceMeters: Math.round(this.totalDistance),
      elapsedSeconds: elapsed,
      lastAccuracyMeters: Math.round(this.lastPosition?.accuracy || 0),
      landmarksCount: this.landmarks.length,
    }
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener)
    listener(this.getStatus())
    return () => this.statusListeners.delete(listener)
  }

  public subscribeDeviation(listener: DeviationListener): () => void {
    this.deviationListeners.add(listener)
    return () => this.deviationListeners.delete(listener)
  }

  private notifyStatus() {
    const status = this.getStatus()
    this.statusListeners.forEach(listener => {
      try {
        listener(status)
      } catch (err) {
        console.error('Error in status listener:', err)
      }
    })
  }

  /**
   * Start recording a new walking route
   */
  public async startRecording(initialRouteName?: string, startLocName?: string): Promise<boolean> {
    if (this.mode === 'RECORDING') {
      return true
    }

    this.mode = 'RECORDING'
    this.recordingPoints = []
    this.landmarks = []
    this.startTime = Date.now()
    this.totalDistance = 0
    this.accuracySum = 0
    this.routeName = initialRouteName?.trim() || `Route ${new Date().toLocaleDateString()}`
    this.startLocationName = startLocName?.trim() || 'Current Location'
    this.activeRoute = null

    // Start continuous GPS tracking
    const ok = GPSService.startTracking(
      (pos) => this.handleGPSPoint(pos),
      (err) => console.warn('GPS tracking error:', err)
    )

    this.notifyStatus()
    return ok
  }

  /**
   * Process live GPS point while recording or navigating
   */
  private handleGPSPoint(pos: GPSPosition) {
    if (this.mode === 'RECORDING') {
      this.accuracySum += pos.accuracy

      // Filter jitter: only append point if moved >= 2.5 meters from last point
      if (this.lastPosition) {
        const stepDist = GPSService.calculateDistanceMeters(
          this.lastPosition.lat,
          this.lastPosition.lng,
          pos.lat,
          pos.lng
        )
        if (stepDist >= 2.5) {
          this.totalDistance += stepDist
          this.recordingPoints.push({
            lat: pos.lat,
            lng: pos.lng,
            accuracy: pos.accuracy,
            altitude: pos.altitude || undefined,
            speed: pos.speed || undefined,
            timestamp: pos.timestamp,
          })
          this.lastPosition = pos
        }
      } else {
        // First point
        this.recordingPoints.push({
          lat: pos.lat,
          lng: pos.lng,
          accuracy: pos.accuracy,
          altitude: pos.altitude || undefined,
          speed: pos.speed || undefined,
          timestamp: pos.timestamp,
        })
        this.lastPosition = pos
      }
      this.notifyStatus()
    } else if (this.mode === 'NAVIGATING' && this.activeRoute) {
      this.lastPosition = pos
      const dev = GPSService.calculateRouteDeviation(pos, this.activeRoute.recorded_points, 35)

      if (dev.isOffRoute) {
        const now = Date.now()
        // Alert deviation if at least 15s elapsed or deviation distance increased significantly
        if (now - this.lastDeviationAlertTime > 15000 || Math.abs(dev.deviationDistanceMeters - this.lastDeviationDistance) > 15) {
          this.lastDeviationAlertTime = now
          this.lastDeviationDistance = dev.deviationDistanceMeters
          this.deviationListeners.forEach(listener => listener(dev, pos))
        }
      }
      this.notifyStatus()
    }
  }

  /**
   * Add landmark along the currently recording route
   */
  public async addLandmark(name: string, voiceNote?: string): Promise<RouteLandmark> {
    if (this.mode !== 'RECORDING') {
      throw new Error('Cannot add landmark: route recording is not active.')
    }

    const pos = this.lastPosition || await GPSService.getCurrentPosition()
    const landmark: RouteLandmark = {
      id: 'lm_' + Math.random().toString(36).substring(2, 8) + Date.now().toString(36),
      name: name.trim(),
      lat: pos.lat,
      lng: pos.lng,
      accuracy: pos.accuracy,
      timestamp: Date.now(),
      voiceNote: voiceNote?.trim(),
      distanceFromStartMeters: Math.round(this.totalDistance),
    }

    this.landmarks.push(landmark)
    this.notifyStatus()
    return landmark
  }

  /**
   * Finish and save the recorded route
   */
  public async stopAndSaveRecording(params?: {
    routeName?: string
    endLocation?: string
    startLocation?: string
  }): Promise<SavedRoute> {
    if (this.mode !== 'RECORDING') {
      throw new Error('No active route recording to save.')
    }

    const now = Date.now()
    const duration = Math.max(1, Math.round((now - this.startTime) / 1000))
    const avgAccuracy = this.recordingPoints.length > 0 
      ? Math.round(this.accuracySum / this.recordingPoints.length) 
      : 10

    const routeName = params?.routeName?.trim() || this.routeName
    const startLoc = params?.startLocation?.trim() || this.startLocationName
    const endLoc = params?.endLocation?.trim() || 'Destination'

    const savedRoute: SavedRoute = {
      id: 'route_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      user_id: MemoryRepository.getUserId(),
      route_name: routeName,
      start_location: startLoc,
      end_location: endLoc,
      distance: Math.round(this.totalDistance),
      duration,
      recorded_points: this.recordingPoints,
      landmarks: this.landmarks,
      voice_notes: [],
      created_at: new Date().toISOString(),
      gps_accuracy_avg: avgAccuracy,
    }

    await MemoryRepository.saveRoute(savedRoute)

    this.mode = 'IDLE'
    this.recordingPoints = []
    this.landmarks = []
    this.activeRoute = null
    this.notifyStatus()

    return savedRoute
  }

  /**
   * Cancel ongoing recording without saving
   */
  public cancelRecording() {
    this.mode = 'IDLE'
    this.recordingPoints = []
    this.landmarks = []
    this.activeRoute = null
    this.notifyStatus()
  }

  /**
   * Start following / navigating a previously saved route
   */
  public startNavigation(route: SavedRoute): { safetyDisclaimer: string } {
    this.mode = 'NAVIGATING'
    this.activeRoute = route
    this.startTime = Date.now()
    this.lastDeviationAlertTime = 0

    GPSService.startTracking(
      (pos) => this.handleGPSPoint(pos),
      (err) => console.warn('Navigation GPS error:', err)
    )

    this.notifyStatus()

    return {
      safetyDisclaimer: 
        `Navigating route: ${route.route_name}. Total distance is ${route.distance} meters. ` +
        `Safety reminder: Saved routes reflect past conditions. Road hazards, obstacles, and traffic can change at any time. ` +
        `Always rely on live senses and physical guidance.`
    }
  }

  /**
   * Stop navigation
   */
  public stopNavigation() {
    this.mode = 'IDLE'
    this.activeRoute = null
    this.notifyStatus()
  }
}

export const RouteTrackingService = new RouteTrackingServiceClass()
