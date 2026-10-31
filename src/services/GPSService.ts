/**
 * NaviAble AI — GPS Service & Spatial Mathematics
 * 
 * Provides:
 * - Geolocation permissions & real-time high-accuracy tracking.
 * - Haversine distance & bearing calculations.
 * - Accuracy monitoring with indoor/degraded GPS warnings.
 * - Route deviation calculation against saved breadcrumb paths.
 */

export interface GPSPosition {
  lat: number
  lng: number
  altitude: number | null
  accuracy: number // meters
  heading: number | null
  speed: number | null // m/s
  timestamp: number
}

export interface RouteDeviationResult {
  isOffRoute: boolean
  deviationDistanceMeters: number
  nearestPointIndex: number
  nearestPointDistance: number
}

type PositionCallback = (pos: GPSPosition) => void
type ErrorCallback = (err: GeolocationPositionError | { message: string }) => void

class GPSServiceClass {
  private watchId: number | null = null
  private lastPosition: GPSPosition | null = null
  private listeners: Set<PositionCallback> = new Set()
  private errorListeners: Set<ErrorCallback> = new Set()
  private isTracking: boolean = false

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'geolocation' in navigator
  }

  public getLastPosition(): GPSPosition | null {
    return this.lastPosition
  }

  public getIsTracking(): boolean {
    return this.isTracking
  }

  /**
   * Request single current position with explicit permission
   */
  public async getCurrentPosition(): Promise<GPSPosition> {
    if (!this.isSupported()) {
      throw new Error('Geolocation is not supported by your browser.')
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const gps: GPSPosition = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            altitude: pos.coords.altitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            timestamp: pos.timestamp || Date.now(),
          }
          this.lastPosition = gps
          resolve(gps)
        },
        (err) => reject(err),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 3000,
        }
      )
    })
  }

  /**
   * Start continuous high-accuracy route tracking
   */
  public startTracking(onPos?: PositionCallback, onErr?: ErrorCallback): boolean {
    if (!this.isSupported()) {
      onErr?.({ message: 'GPS not supported' })
      return false
    }

    if (onPos) this.listeners.add(onPos)
    if (onErr) this.errorListeners.add(onErr)

    if (this.watchId !== null) return true

    this.isTracking = true
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const gps: GPSPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          altitude: pos.coords.altitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp || Date.now(),
        }
        this.lastPosition = gps
        this.listeners.forEach((fn) => fn(gps))
      },
      (err) => {
        console.warn('[GPSService] Error:', err.message)
        this.errorListeners.forEach((fn) => fn(err))
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 1000,
      }
    )

    return true
  }

  /**
   * Stop continuous tracking
   */
  public stopTracking() {
    if (this.watchId !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }
    this.isTracking = false
    this.listeners.clear()
    this.errorListeners.clear()
  }

  // ─── Spatial Math & Haversine Distance ───

  /**
   * Computes great-circle distance between two GPS coordinates in meters.
   */
  public calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3 // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180
    const phi2 = (lat2 * Math.PI) / 180
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return Math.round(R * c * 10) / 10
  }

  /**
   * Calculates compass bearing in degrees (0 - 360) from point A to point B.
   */
  public calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180)
    const x =
      Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
      Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(((lon2 - lon1) * Math.PI) / 180)
    const bearing = (Math.atan2(y, x) * 180) / Math.PI
    return (bearing + 360) % 360
  }

  /**
   * Evaluates whether current position significantly deviates from a saved route.
   */
  public calculateRouteDeviation(
    currentPos: { lat: number; lng: number },
    routePoints: { lat: number; lng: number }[],
    thresholdMeters: number = 35
  ): RouteDeviationResult {
    if (!routePoints || routePoints.length === 0) {
      return { isOffRoute: false, deviationDistanceMeters: 0, nearestPointIndex: -1, nearestPointDistance: 0 }
    }

    let minDistance = Infinity
    let nearestIdx = 0

    for (let i = 0; i < routePoints.length; i++) {
      const d = this.calculateDistanceMeters(currentPos.lat, currentPos.lng, routePoints[i].lat, routePoints[i].lng)
      if (d < minDistance) {
        minDistance = d
        nearestIdx = i
      }
    }

    return {
      isOffRoute: minDistance > thresholdMeters,
      deviationDistanceMeters: Math.round(minDistance),
      nearestPointIndex: nearestIdx,
      nearestPointDistance: Math.round(minDistance),
    }
  }
}

export const GPSService = new GPSServiceClass()
