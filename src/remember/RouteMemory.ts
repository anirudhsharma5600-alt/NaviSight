/**
 * NaviAble AI — Route Memory Manager
 * 
 * Manages saved walking routes, verbal explanations, GeoJSON export,
 * and retrieval for voice assistant queries.
 */

import { MemoryRepository, type SavedRoute } from './MemoryRepository'
import { RouteTrackingService } from '../services/RouteTrackingService'

export class RouteMemoryManager {
  /**
   * Get all saved routes
   */
  public async getRoutes(): Promise<SavedRoute[]> {
    return await MemoryRepository.getRoutes()
  }

  /**
   * Get route by ID
   */
  public async getRoute(id: string): Promise<SavedRoute | null> {
    return (await MemoryRepository.getRoute(id)) || null
  }

  /**
   * Delete route
   */
  public async deleteRoute(id: string): Promise<boolean> {
    return await MemoryRepository.deleteRoute(id)
  }

  /**
   * Fuzzy find route by voice query
   */
  public async findRouteByName(query: string): Promise<SavedRoute | null> {
    const routes = await this.getRoutes()
    const q = query.toLowerCase().trim()
    if (!q) return null

    // Exact or substring match
    const found = routes.find(r => 
      r.route_name.toLowerCase().includes(q) ||
      r.start_location.toLowerCase().includes(q) ||
      r.end_location.toLowerCase().includes(q)
    )
    return found || null
  }

  /**
   * Generate an accessible spoken description of a route
   */
  public describeRoute(route: SavedRoute): string {
    const mins = Math.floor(route.duration / 60)
    const secs = route.duration % 60
    const timeStr = mins > 0 ? `${mins} minutes${secs > 0 ? ` ${secs} seconds` : ''}` : `${secs} seconds`
    
    const distStr = route.distance >= 1000 
      ? `${(route.distance / 1000).toFixed(1)} kilometers` 
      : `${route.distance} meters`

    let desc = `Route ${route.route_name} goes from ${route.start_location} to ${route.end_location}. `
    desc += `Total distance is ${distStr}, recorded in about ${timeStr}. `

    if (route.landmarks && route.landmarks.length > 0) {
      desc += `It has ${route.landmarks.length} recorded landmark${route.landmarks.length > 1 ? 's' : ''}: `
      const landmarkDesc = route.landmarks.map((lm, i) => {
        const atDist = lm.distanceFromStartMeters ? ` at ${lm.distanceFromStartMeters} meters` : ''
        return `${lm.name}${atDist}${lm.voiceNote ? ` (note: ${lm.voiceNote})` : ''}`
      }).join(', ')
      desc += `${landmarkDesc}. `
    } else {
      desc += `No intermediate landmarks were recorded. `
    }

    desc += `Safety reminder: always observe real-time road conditions, as obstacles may have changed since recording.`

    return desc
  }

  /**
   * Export route as standard GeoJSON FeatureCollection
   */
  public toGeoJSON(route: SavedRoute) {
    const coordinates = route.recorded_points.map(p => [p.lng, p.lat, p.altitude || 0])

    const lineFeature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates,
      },
      properties: {
        id: route.id,
        name: route.route_name,
        distance: route.distance,
        duration: route.duration,
        start: route.start_location,
        end: route.end_location,
      }
    }

    const landmarkFeatures = route.landmarks.map(lm => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lm.lng, lm.lat],
      },
      properties: {
        id: lm.id,
        name: lm.name,
        voiceNote: lm.voiceNote,
        distanceFromStart: lm.distanceFromStartMeters,
      }
    }))

    return {
      type: 'FeatureCollection',
      features: [lineFeature, ...landmarkFeatures]
    }
  }

  /**
   * Helper to start recording with clean voice prompt
   */
  public async startVoiceRecording(name?: string): Promise<string> {
    const ok = await RouteTrackingService.startRecording(name)
    if (!ok) {
      return "Unable to start route recording. Please ensure location permissions are granted."
    }
    return `Route recording started for ${name || 'new route'}. Walk your route and tell me when you reach your destination.`
  }

  /**
   * Helper to stop recording with clean voice prompt
   */
  public async stopVoiceRecording(finalName?: string, endLocation?: string): Promise<string> {
    try {
      const saved = await RouteTrackingService.stopAndSaveRecording({
        routeName: finalName,
        endLocation,
      })
      return `Route saved as ${saved.route_name}. Total distance is ${saved.distance} meters.`
    } catch (err: any) {
      return `Failed to save route: ${err.message}`
    }
  }
}

export const RouteMemory = new RouteMemoryManager()
