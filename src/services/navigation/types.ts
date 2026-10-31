/**
 * NaviAble AI — Pedestrian Voice Navigation Types & Data Contracts
 */

export interface GeoCoordinate {
  lat: number
  lng: number
  altitude?: number | null
}

export interface GPSAccuracyQuality {
  accuracyMeters: number
  quality: 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'POOR' | 'UNUSABLE'
  isReliableForTurns: boolean
}

export type ManeuverType =
  | 'depart'
  | 'continue'
  | 'turn_slight_left'
  | 'turn_left'
  | 'turn_sharp_left'
  | 'turn_slight_right'
  | 'turn_right'
  | 'turn_sharp_right'
  | 'u_turn'
  | 'roundabout'
  | 'arrive'

export interface RouteStep {
  index: number
  maneuver: ManeuverType
  instruction: string
  streetName: string
  distanceMeters: number
  durationSeconds: number
  coordinate: [number, number] // [lng, lat]
  spokenNotice60m?: string
  spokenNotice25m?: string
  spokenTurnNow?: string
}

export interface PedestrianRoute {
  id: string
  provider: 'graphhopper' | 'osrm' | 'simulated'
  profile: 'foot'
  origin: GeoCoordinate
  destination: GeoCoordinate
  destinationName: string
  totalDistanceMeters: number
  totalDurationSeconds: number
  geometry: [number, number][] // [lng, lat] coordinates line
  steps: RouteStep[]
  createdAt: number
}

export type NavigationMode = 'IDLE' | 'ROUTE_LOADED' | 'NAVIGATING' | 'PAUSED' | 'RECALCULATING' | 'ARRIVED'

export interface NavigationProgress {
  currentStepIndex: number
  currentStep: RouteStep | null
  nextStep: RouteStep | null
  distanceToNextTurnMeters: number
  distanceRemainingMeters: number
  estimatedTimeRemainingSeconds: number
  distanceFromRouteMeters: number
  isOffRoute: boolean
  lastSpokenInstruction: string
}

export interface ObstacleDetectionWarning {
  objectClass: string
  confidence: number
  position: 'LEFT' | 'CENTRE' | 'RIGHT'
  timestamp: number
  spokenWarning: string
}

export interface NavigationConfig {
  voiceGuidanceEnabled: boolean
  vibrationEnabled: boolean
  announcementDistance60m: number
  announcementDistance25m: number
  turnArrivalDistanceMeters: number
  destinationArrivalDistanceMeters: number
  offRouteThresholdMeters: number
  offRouteConsecutiveSamples: number
  gpsUncertainThresholdMeters: number
  obstacleWarningCooldownMs: number
}

export interface GeocodingResult {
  displayName: string
  name: string
  lat: number
  lng: number
  category?: string
  importance?: number
}
