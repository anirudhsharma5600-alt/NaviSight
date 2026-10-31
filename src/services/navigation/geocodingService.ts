/**
 * NaviAble AI — Nominatim Geocoding & Address Resolution Service
 * 
 * Provides:
 * - Free OpenStreetMap Nominatim destination search with debouncing & cache.
 * - Reverse geocoding (coordinates to street/landmark name).
 * - Full attribution compliant with OpenStreetMap Foundation guidelines.
 */

import type { GeocodingResult, GeoCoordinate } from './types'

class GeocodingServiceClass {
  private cache: Map<string, GeocodingResult[]> = new Map()
  private reverseCache: Map<string, string> = new Map()
  private lastRequestTime = 0

  /**
   * Search destination locations matching a text query
   */
  public async searchPlaces(query: string, limit = 5): Promise<GeocodingResult[]> {
    const q = query.trim()
    if (!q || q.length < 2) return []

    const cacheKey = `${q.toLowerCase()}_${limit}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    // Rate-limit: Nominatim policy requires at most 1 req/sec
    const now = Date.now()
    const elapsed = now - this.lastRequestTime
    if (elapsed < 1000) {
      await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed))
    }
    this.lastRequestTime = Date.now()

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=${limit}&addressdetails=1`
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'NaviAble-Assistive-Navigation/3.0 (naviable.ai; accessible walking guidance)',
        },
      })

      if (!res.ok) {
        console.warn(`[Geocoding] HTTP error ${res.status}`)
        return []
      }

      const data = await res.json()
      const results: GeocodingResult[] = data.map((item: any) => ({
        displayName: item.display_name,
        name: item.name || item.display_name.split(',')[0],
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        category: item.type || item.class || 'place',
        importance: item.importance || 0,
      }))

      this.cache.set(cacheKey, results)
      return results
    } catch (err: any) {
      console.warn('[Geocoding] Search error:', err.message)
      return []
    }
  }

  /**
   * Reverse-geocode coordinates to human-readable street or area name
   */
  public async reverseGeocode(coord: GeoCoordinate): Promise<string> {
    const key = `${coord.lat.toFixed(4)},${coord.lng.toFixed(4)}`
    if (this.reverseCache.has(key)) {
      return this.reverseCache.get(key)!
    }

    const now = Date.now()
    const elapsed = now - this.lastRequestTime
    if (elapsed < 1000) {
      await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed))
    }
    this.lastRequestTime = Date.now()

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coord.lat}&lon=${coord.lng}&zoom=18&addressdetails=1`
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'NaviAble-Assistive-Navigation/3.0 (naviable.ai; accessible walking guidance)',
        },
      })

      if (!res.ok) return `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}`

      const data = await res.json()
      const name = data.address?.road || data.address?.neighbourhood || data.name || data.display_name?.split(',')[0] || 'Unknown Location'
      this.reverseCache.set(key, name)
      return name
    } catch {
      return `${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}`
    }
  }
}

export const geocodingService = new GeocodingServiceClass()
