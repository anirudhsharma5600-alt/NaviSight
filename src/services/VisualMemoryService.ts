/**
 * NaviAble AI — Visual Memory Service
 * 
 * Captures visual signatures of familiar scenes, landmarks, and rooms.
 * Uses lightweight multi-factor scene resemblance:
 * 1. Object signature vector (COCO object classes present)
 * 2. Chromatic fingerprint (dominant color distribution)
 * 3. Spatial GPS proximity (when outdoors)
 * 
 * Matches live camera frames against saved memories to announce:
 * "This resembles your saved college entrance."
 */

import { MemoryRepository, type VisualMemory } from '../remember/MemoryRepository'
import { GPSService } from './GPSService'

export interface ChromaticFingerprint {
  r: number
  g: number
  b: number
}

export interface VisualMatchResult {
  memory: VisualMemory
  score: number // 0 to 1
  factors: {
    objectOverlap: number
    colorProximity: number
    distanceMeters?: number
  }
}

class VisualMemoryServiceClass {
  /**
   * Extract dominant RGB chromatic fingerprint from video or canvas
   */
  public extractChromaticFingerprint(source: HTMLVideoElement | HTMLCanvasElement): ChromaticFingerprint {
    const width = ('videoWidth' in source ? source.videoWidth : source.width) || 100
    const height = ('videoHeight' in source ? source.videoHeight : source.height) || 100

    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (!ctx) return { r: 128, g: 128, b: 128 }

    ctx.drawImage(source, 0, 0, 64, 64)
    const imgData = ctx.getImageData(0, 0, 64, 64)
    const data = imgData.data

    let totalR = 0, totalG = 0, totalB = 0
    const count = data.length / 4

    for (let i = 0; i < data.length; i += 4) {
      totalR += data[i]
      totalG += data[i + 1]
      totalB += data[i + 2]
    }

    return {
      r: Math.round(totalR / count),
      g: Math.round(totalG / count),
      b: Math.round(totalB / count),
    }
  }

  /**
   * Capture a low-resolution thumbnail for storage
   */
  public captureThumbnail(source: HTMLVideoElement | HTMLCanvasElement): string {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 240
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.drawImage(source, 0, 0, 320, 240)
    return canvas.toDataURL('image/jpeg', 0.6)
  }

  /**
   * Calculate Jaccard similarity between two sets of object tags
   */
  public calculateObjectOverlap(tagsA: string[], tagsB: string[]): number {
    if (!tagsA.length || !tagsB.length) return 0
    const setA = new Set(tagsA.map(t => t.toLowerCase()))
    const setB = new Set(tagsB.map(t => t.toLowerCase()))

    let intersection = 0
    setA.forEach(item => {
      if (setB.has(item)) intersection++
    })

    const union = new Set([...setA, ...setB]).size
    return union > 0 ? intersection / union : 0
  }

  /**
   * Calculate color proximity (1.0 = identical, 0.0 = opposite)
   */
  public calculateColorSimilarity(c1?: ChromaticFingerprint, c2?: ChromaticFingerprint): number {
    if (!c1 || !c2) return 0.5
    // Max RGB distance is sqrt(255^2 * 3) ~ 441.67
    const dist = Math.sqrt(
      Math.pow(c1.r - c2.r, 2) +
      Math.pow(c1.g - c2.g, 2) +
      Math.pow(c1.b - c2.b, 2)
    )
    return Math.max(0, 1 - (dist / 441.67))
  }

  /**
   * Save a new visual memory of the current scene
   */
  public async createVisualMemory(params: {
    name: string
    description?: string
    detectedObjects: string[]
    cameraElement?: HTMLVideoElement | HTMLCanvasElement
    voiceNote?: string
    includeGPS?: boolean
  }): Promise<VisualMemory> {
    let chroma: ChromaticFingerprint | undefined
    let thumbnail: string | undefined

    if (params.cameraElement) {
      chroma = this.extractChromaticFingerprint(params.cameraElement)
      thumbnail = this.captureThumbnail(params.cameraElement)
    }

    let loc: { lat: number; lng: number } | undefined
    if (params.includeGPS && GPSService.isSupported()) {
      try {
        const pos = await GPSService.getCurrentPosition()
        loc = { lat: pos.lat, lng: pos.lng }
      } catch (err) {
        console.warn('Could not record GPS for visual memory:', err)
      }
    }

    const memory: VisualMemory = {
      id: 'vm_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      user_id: MemoryRepository.getUserId(),
      memory_name: params.name.trim(),
      description: params.description?.trim() || `Visual memory of ${params.name}`,
      detected_objects: Array.from(new Set(params.detectedObjects.map(o => o.toLowerCase()))),
      chromatic_fingerprint: chroma,
      optional_image_path: thumbnail,
      location: loc,
      voice_notes: params.voiceNote ? [params.voiceNote.trim()] : [],
      created_at: new Date().toISOString(),
    }

    await MemoryRepository.saveVisualMemory(memory)
    return memory
  }

  /**
   * Find matching visual memories given current scene properties
   */
  public async matchCurrentScene(params: {
    detectedObjects: string[]
    cameraElement?: HTMLVideoElement | HTMLCanvasElement
    currentPos?: { lat: number; lng: number }
    threshold?: number
  }): Promise<VisualMatchResult | null> {
    const memories = await MemoryRepository.getVisualMemories()
    if (!memories.length) return null

    const currentChroma = params.cameraElement 
      ? this.extractChromaticFingerprint(params.cameraElement) 
      : undefined

    let bestMatch: VisualMatchResult | null = null
    const threshold = params.threshold || 0.58

    for (const mem of memories) {
      const objScore = this.calculateObjectOverlap(mem.detected_objects, params.detectedObjects)
      const colorScore = this.calculateColorSimilarity(mem.chromatic_fingerprint, currentChroma)

      let gpsScore = 0.5
      let distMeters: number | undefined

      if (params.currentPos && mem.location) {
        distMeters = GPSService.calculateDistanceMeters(
          params.currentPos.lat,
          params.currentPos.lng,
          mem.location.lat,
          mem.location.lng
        )
        // If within 30 meters, high boost; beyond 100 meters, lower
        if (distMeters <= 30) gpsScore = 1.0
        else if (distMeters <= 80) gpsScore = 0.7
        else gpsScore = 0.2
      }

      // Weight factors:
      // If GPS is present: 40% GPS + 35% objects + 25% chromatic
      // If indoor/no GPS: 65% objects + 35% chromatic
      const finalScore = mem.location && params.currentPos
        ? (gpsScore * 0.40) + (objScore * 0.35) + (colorScore * 0.25)
        : (objScore * 0.65) + (colorScore * 0.35)

      if (finalScore >= threshold && (!bestMatch || finalScore > bestMatch.score)) {
        bestMatch = {
          memory: mem,
          score: finalScore,
          factors: {
            objectOverlap: objScore,
            colorProximity: colorScore,
            distanceMeters: distMeters,
          }
        }
      }
    }

    return bestMatch
  }
}

export const VisualMemoryService = new VisualMemoryServiceClass()
