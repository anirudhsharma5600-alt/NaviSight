/**
 * NaviAble AI — Saved Places Manager
 * 
 * Manages user's important locations (home, work, clinics, classrooms, bus stops)
 * with coordinates, addresses, voice notes, and proximity lookup.
 */

import { MemoryRepository, type SavedPlace } from './MemoryRepository'
import { GPSService } from '../services/GPSService'

export class SavedPlacesManager {
  public async getPlaces(): Promise<SavedPlace[]> {
    return await MemoryRepository.getPlaces()
  }

  public async getPlace(id: string): Promise<SavedPlace | null> {
    return (await MemoryRepository.getPlace(id)) || null
  }

  public async deletePlace(id: string): Promise<boolean> {
    return await MemoryRepository.deletePlace(id)
  }

  public async savePlace(place: Omit<SavedPlace, 'id' | 'user_id' | 'created_at'> & { id?: string }): Promise<SavedPlace> {
    const existing = place.id ? await MemoryRepository.getPlace(place.id) : null
    const record: SavedPlace = {
      id: place.id || 'place_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      user_id: MemoryRepository.getUserId(),
      place_name: place.place_name.trim(),
      location: place.location,
      description: place.description || `Saved place: ${place.place_name}`,
      voice_notes: place.voice_notes || existing?.voice_notes || [],
      created_at: existing?.created_at || new Date().toISOString(),
    }

    await MemoryRepository.savePlace(record)
    return record
  }

  public async saveCurrentLocation(name: string, description?: string, voiceNote?: string): Promise<SavedPlace> {
    const pos = await GPSService.getCurrentPosition()
    return await this.savePlace({
      place_name: name,
      location: {
        lat: pos.lat,
        lng: pos.lng,
        accuracy: pos.accuracy,
      },
      description: description || `Location marked with ${Math.round(pos.accuracy)}m GPS accuracy.`,
      voice_notes: voiceNote ? [voiceNote.trim()] : [],
    })
  }

  public async findPlaceByName(name: string): Promise<SavedPlace | null> {
    const places = await this.getPlaces()
    const q = name.toLowerCase().trim()
    if (!q) return null
    return places.find(p => p.place_name.toLowerCase().includes(q)) || null
  }

  public async getNearestPlace(currentPos: { lat: number; lng: number }, maxDistanceMeters: number = 100): Promise<{ place: SavedPlace; distanceMeters: number } | null> {
    const places = await this.getPlaces()
    if (!places.length) return null

    let nearest: { place: SavedPlace; distanceMeters: number } | null = null

    for (const p of places) {
      const dist = GPSService.calculateDistanceMeters(
        currentPos.lat,
        currentPos.lng,
        p.location.lat,
        p.location.lng
      )

      if (dist <= maxDistanceMeters && (!nearest || dist < nearest.distanceMeters)) {
        nearest = { place: p, distanceMeters: Math.round(dist) }
      }
    }

    return nearest
  }
}

export const SavedPlaces = new SavedPlacesManager()
