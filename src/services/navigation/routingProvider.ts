/**
 * NaviAble AI — Pedestrian Routing Provider Abstraction
 * 
 * Implements strict walking profiles ('foot').
 * Prohibits car/driving routes for pedestrian assistive safety.
 */

import type { GeoCoordinate, PedestrianRoute, RouteStep, ManeuverType } from './types'

export interface RoutingProvider {
  name: string
  calculateWalkingRoute(origin: GeoCoordinate, destination: GeoCoordinate, destinationName?: string): Promise<PedestrianRoute>
}

// Convert OSRM maneuver modifiers/types into standardized ManeuverType
function mapOSRMToManeuver(type: string, modifier?: string): ManeuverType {
  const mod = (modifier || '').toLowerCase()
  const typ = (type || '').toLowerCase()

  if (typ === 'arrive') return 'arrive'
  if (typ === 'depart') return 'depart'
  if (typ === 'roundabout') return 'roundabout'

  if (mod.includes('sharp left')) return 'turn_sharp_left'
  if (mod.includes('slight left')) return 'turn_slight_left'
  if (mod.includes('left')) return 'turn_left'

  if (mod.includes('sharp right')) return 'turn_sharp_right'
  if (mod.includes('slight right')) return 'turn_slight_right'
  if (mod.includes('right')) return 'turn_right'

  if (mod.includes('uturn') || mod.includes('u-turn')) return 'u_turn'

  return 'continue'
}

// GraphHopper sign mapping to standardized ManeuverType
// 0 = continue, 1 = slight right, 2 = right, 3 = sharp right, -1 = slight left, -2 = left, -3 = sharp left, 4 = finish, 5 = reached via
function mapGraphHopperSignToManeuver(sign: number): ManeuverType {
  switch (sign) {
    case 4: return 'arrive'
    case -3: return 'turn_sharp_left'
    case -2: return 'turn_left'
    case -1: return 'turn_slight_left'
    case 1: return 'turn_slight_right'
    case 2: return 'turn_right'
    case 3: return 'turn_sharp_right'
    case 6: return 'roundabout'
    default: return 'continue'
  }
}

/**
 * Format human-readable walking instruction
 */
function formatStepInstruction(maneuver: ManeuverType, streetName: string, distanceMeters: number): string {
  const streetPart = streetName && streetName !== '-' ? ` onto ${streetName}` : ''

  switch (maneuver) {
    case 'depart':
      return `Head along the mapped walking path${streetPart}`
    case 'arrive':
      return 'You have reached the destination area. Please verify the exact entrance.'
    case 'turn_left':
      return `Turn left${streetPart}`
    case 'turn_slight_left':
      return `Bear slight left${streetPart}`
    case 'turn_sharp_left':
      return `Turn sharp left${streetPart}`
    case 'turn_right':
      return `Turn right${streetPart}`
    case 'turn_slight_right':
      return `Bear slight right${streetPart}`
    case 'turn_sharp_right':
      return `Turn sharp right${streetPart}`
    case 'u_turn':
      return 'Make a safe U-turn along the walking path'
    case 'roundabout':
      return `Take the roundabout path${streetPart}`
    case 'continue':
    default:
      if (streetName && streetName !== '-') {
        return `Continue straight on ${streetName}`
      }
      return `Continue straight along the mapped route for approximately ${Math.round(distanceMeters)} metres`
  }
}

/**
 * GraphHopper Pedestrian Routing Provider
 */
export class GraphHopperRoutingProvider implements RoutingProvider {
  public name = 'GraphHopper (Pedestrian)'
  private apiKey: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || (typeof process !== 'undefined' ? process.env?.VITE_GRAPHHOPPER_API_KEY || '' : '')
  }

  public async calculateWalkingRoute(origin: GeoCoordinate, destination: GeoCoordinate, destinationName?: string): Promise<PedestrianRoute> {
    if (!this.apiKey) {
      throw new Error('GraphHopper API key not configured.')
    }

    const url = `https://graphhopper.com/api/1/route?point=${origin.lat},${origin.lng}&point=${destination.lat},${destination.lng}&profile=foot&locale=en&points_encoded=false&instructions=true&elevation=false&key=${encodeURIComponent(this.apiKey)}`

    const response = await fetch(url)
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}))
      throw new Error(errBody.message || `GraphHopper error HTTP ${response.status}`)
    }

    const data = await response.json()
    if (!data.paths || data.paths.length === 0) {
      throw new Error('No pedestrian route found between these locations.')
    }

    const path = data.paths[0]
    const coords: [number, number][] = path.points.coordinates.map((c: [number, number]) => [c[0], c[1]]) // [lng, lat]

    const steps: RouteStep[] = (path.instructions || []).map((ins: any, idx: number) => {
      const maneuver = mapGraphHopperSignToManeuver(ins.sign)
      const dist = Math.round(ins.distance || 0)
      const street = ins.street_name || ''
      const instruction = formatStepInstruction(maneuver, street, dist)
      const coordIdx = ins.interval ? ins.interval[0] : 0
      const coord = coords[coordIdx] || coords[0]

      return {
        index: idx,
        maneuver,
        instruction,
        streetName: street,
        distanceMeters: dist,
        durationSeconds: Math.round((ins.time || 0) / 1000),
        coordinate: coord,
        spokenNotice60m: `In approximately 60 metres, ${instruction.toLowerCase()}`,
        spokenNotice25m: `In approximately 25 metres, ${instruction.toLowerCase()}`,
        spokenTurnNow: maneuver === 'arrive'
          ? 'Destination area reached. Please verify the exact entrance.'
          : `${instruction.replace(/\b(cross|crossing)\b/gi, 'walk along')}.`,
      }
    })

    return {
      id: `gh_${Date.now()}`,
      provider: 'graphhopper',
      profile: 'foot',
      origin,
      destination,
      destinationName: destinationName || 'Selected Destination',
      totalDistanceMeters: Math.round(path.distance),
      totalDurationSeconds: Math.round(path.time / 1000),
      geometry: coords,
      steps,
      createdAt: Date.now(),
    }
  }
}

/**
 * OpenStreetMap / OSRM Foot Pedestrian Routing Provider (Free & Open Access)
 */
export class OSRMFootRoutingProvider implements RoutingProvider {
  public name = 'OSRM (OpenStreetMap Foot)'

  public async calculateWalkingRoute(origin: GeoCoordinate, destination: GeoCoordinate, destinationName?: string): Promise<PedestrianRoute> {
    const url = `https://router.project-osrm.org/route/v1/foot/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`OSRM foot routing HTTP ${response.status}`)
    }

    const data = await response.json()
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('No pedestrian route found: destination appears unreachable on foot.')
    }

    const route = data.routes[0]
    const coords: [number, number][] = route.geometry.coordinates // [lng, lat]

    const leg = route.legs[0]
    const steps: RouteStep[] = (leg.steps || []).map((step: any, idx: number) => {
      const maneuver = mapOSRMToManeuver(step.maneuver?.type, step.maneuver?.modifier)
      const dist = Math.round(step.distance)
      const street = step.name || ''
      const instruction = formatStepInstruction(maneuver, street, dist)
      const coord = step.maneuver?.location || coords[0]

      return {
        index: idx,
        maneuver,
        instruction,
        streetName: street,
        distanceMeters: dist,
        durationSeconds: Math.round(step.duration),
        coordinate: [coord[0], coord[1]],
        spokenNotice60m: `In approximately 60 metres, ${instruction.toLowerCase()}`,
        spokenNotice25m: `In approximately 25 metres, ${instruction.toLowerCase()}`,
        spokenTurnNow: maneuver === 'arrive'
          ? 'Destination area reached. Please verify the exact entrance.'
          : `${instruction.replace(/\b(cross|crossing)\b/gi, 'walk along')}.`,
      }
    })

    return {
      id: `osrm_${Date.now()}`,
      provider: 'osrm',
      profile: 'foot',
      origin,
      destination,
      destinationName: destinationName || 'Selected Destination',
      totalDistanceMeters: Math.round(route.distance),
      totalDurationSeconds: Math.round(route.duration),
      geometry: coords,
      steps,
      createdAt: Date.now(),
    }
  }
}

/**
 * Composite Pedestrian Routing Service with automatic graceful fallback
 */
export class PedestrianRoutingService {
  private primaryProvider: RoutingProvider
  private fallbackProvider: RoutingProvider

  constructor(apiKey?: string) {
    this.primaryProvider = new GraphHopperRoutingProvider(apiKey)
    this.fallbackProvider = new OSRMFootRoutingProvider()
  }

  public async getRoute(origin: GeoCoordinate, destination: GeoCoordinate, destinationName?: string): Promise<PedestrianRoute> {
    try {
      return await this.primaryProvider.calculateWalkingRoute(origin, destination, destinationName)
    } catch (err: any) {
      console.warn(`[RoutingService] Primary provider failed (${err.message}). Falling back to OSRM Foot...`)
      return await this.fallbackProvider.calculateWalkingRoute(origin, destination, destinationName)
    }
  }
}

export const routingService = new PedestrianRoutingService()
