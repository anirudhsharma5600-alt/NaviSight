/**
 * NaviAble AI — Memory Repository
 * 
 * Provides persistent storage for the Remember subsystem:
 * - Saved Routes (GPS breadcrumbs, landmarks, distance, duration)
 * - Saved Places (Locations, descriptions, voice notes)
 * - Saved People (Opt-in shared identities, relationships, consent tokens)
 * - Visual Memories (Scene descriptions, landmark objects, optional photos)
 * - Identity Shares (Expiring cryptographic QR tokens, revocation)
 * 
 * Architecture:
 * - Client-side IndexedDB with localStorage fallback for 100% offline functionality.
 * - Optional Supabase sync with Row Level Security (RLS) when environment credentials exist.
 */

export interface SavedRoutePoint {
  lat: number
  lng: number
  altitude?: number
  accuracy: number
  timestamp: number
  speed?: number
}

export interface RouteLandmark {
  id: string
  name: string
  lat: number
  lng: number
  accuracy: number
  timestamp: number
  voiceNote?: string
  distanceFromStartMeters?: number
}

export interface SavedRoute {
  id: string
  user_id: string
  route_name: string
  start_location: string
  end_location: string
  distance: number // meters
  duration: number // seconds
  recorded_points: SavedRoutePoint[]
  landmarks: RouteLandmark[]
  voice_notes: string[]
  created_at: string
  last_updated?: string
  gps_accuracy_avg?: number
}

export interface SavedPlace {
  id: string
  user_id: string
  place_name: string
  location: {
    lat: number
    lng: number
    address?: string
    accuracy?: number
  }
  description: string
  voice_notes: string[]
  created_at: string
}

export interface SavedPerson {
  id: string
  user_id: string
  display_name: string
  nickname?: string
  relationship_label: 'Friend' | 'Family' | 'Colleague' | 'Caregiver' | 'Doctor' | 'Acquaintance' | 'Other'
  shared_identity_id?: string
  sharing_status: 'active' | 'pending' | 'revoked' | 'expired' | 'none'
  token_hash?: string
  expiry?: number
  voice_notes?: string[]
  created_at: string
}

export interface VisualMemory {
  id: string
  user_id: string
  memory_name: string
  description: string
  location?: {
    lat: number
    lng: number
  }
  detected_objects: string[]
  chromatic_fingerprint?: {
    r: number
    g: number
    b: number
  }
  voice_notes: string[]
  optional_image_path?: string
  created_at: string
}

export interface IdentityShare {
  id: string
  owner_user_id: string
  recipient_user_id?: string
  display_name: string
  identity_token: string
  identity_token_hash: string
  created_at: number
  expiry: number
  revoked_at?: number
}

export interface MemorySearchResult {
  type: 'route' | 'place' | 'person' | 'visual'
  id: string
  title: string
  subtitle: string
  matchScore: number
  data: SavedRoute | SavedPlace | SavedPerson | VisualMemory
}

// ─── Local IndexedDB & Storage Implementation ───

const DB_NAME = 'naviable_remember_db'
const DB_VERSION = 1

class MemoryRepositoryClass {
  private userId: string = 'local_user_default'
  private dbPromise: Promise<IDBDatabase> | null = null

  constructor() {
    this.initUserId()
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.initDB()
    }
  }

  private initUserId() {
    if (typeof window === 'undefined') return
    let stored = localStorage.getItem('naviable_user_id')
    if (!stored) {
      stored = 'user_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
      localStorage.setItem('naviable_user_id', stored)
    }
    this.userId = stored
  }

  public getUserId(): string {
    return this.userId
  }

  public setUserId(newId: string) {
    this.userId = newId
    if (typeof window !== 'undefined') {
      localStorage.setItem('naviable_user_id', newId)
    }
  }

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
        const db = (e.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('routes')) {
          db.createObjectStore('routes', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('places')) {
          db.createObjectStore('places', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('people')) {
          db.createObjectStore('people', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('visual_memories')) {
          db.createObjectStore('visual_memories', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('identity_shares')) {
          db.createObjectStore('identity_shares', { keyPath: 'id' })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    return this.dbPromise
  }

  // ─── Generic Storage Helpers ───

  private async getStoreData<T>(storeName: string): Promise<T[]> {
    try {
      const db = await this.initDB()
      return new Promise<T[]>((resolve) => {
        const tx = db.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const req = store.getAll()
        req.onsuccess = () => {
          const list = (req.result as (T & { user_id?: string })[]) || []
          // Enforce per-user data isolation (User data separation)
          const userOnly = list.filter((item) => !item.user_id || item.user_id === this.userId)
          resolve(userOnly as T[])
        }
        req.onerror = () => {
          resolve(this.getFallbackData<T>(storeName))
        }
      })
    } catch {
      return this.getFallbackData<T>(storeName)
    }
  }

  private async putStoreItem<T extends { id: string }>(storeName: string, item: T): Promise<void> {
    try {
      const db = await this.initDB()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const req = store.put(item)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
    } catch {
      this.putFallbackItem(storeName, item)
    }
  }

  private async deleteStoreItem(storeName: string, id: string): Promise<void> {
    try {
      const db = await this.initDB()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const req = store.delete(id)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
    } catch {
      this.deleteFallbackItem(storeName, id)
    }
  }

  // Fallback to localStorage if IndexedDB is blocked
  private getFallbackData<T>(storeName: string): T[] {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(`naviable_${storeName}_${this.userId}`)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  private putFallbackItem<T extends { id: string }>(storeName: string, item: T): void {
    if (typeof window === 'undefined') return
    try {
      const list = this.getFallbackData<T>(storeName)
      const idx = list.findIndex((x) => x.id === item.id)
      if (idx >= 0) {
        list[idx] = item
      } else {
        list.push(item)
      }
      localStorage.setItem(`naviable_${storeName}_${this.userId}`, JSON.stringify(list))
    } catch (e) {
      console.warn('LocalStorage fallback write failed:', e)
    }
  }

  private deleteFallbackItem(storeName: string, id: string): void {
    if (typeof window === 'undefined') return
    try {
      const list = this.getFallbackData<{ id: string }>(storeName).filter((x) => x.id !== id)
      localStorage.setItem(`naviable_${storeName}_${this.userId}`, JSON.stringify(list))
    } catch (e) {
      console.warn('LocalStorage fallback delete failed:', e)
    }
  }

  // Convenience Aliases for Remember subsystem
  public async getRoutes(): Promise<SavedRoute[]> {
    return this.getAllRoutes()
  }

  public async getRoute(id: string): Promise<SavedRoute | undefined> {
    return this.getRouteById(id)
  }

  public async getPlaces(): Promise<SavedPlace[]> {
    return this.getAllPlaces()
  }

  public async getPlace(id: string): Promise<SavedPlace | undefined> {
    return this.getPlaceById(id)
  }

  public async getPeople(): Promise<SavedPerson[]> {
    return this.getAllPeople()
  }

  public async getPerson(id: string): Promise<SavedPerson | undefined> {
    return this.getPersonById(id)
  }

  public async getPersonByTokenHash(hash: string): Promise<SavedPerson | null> {
    const people = await this.getAllPeople()
    return people.find((p) => p.token_hash === hash) || null
  }

  public async getVisualMemories(): Promise<VisualMemory[]> {
    return this.getAllVisualMemories()
  }

  public async getVisualMemory(id: string): Promise<VisualMemory | undefined> {
    return this.getVisualMemoryById(id)
  }

  public async saveIdentityShare(share: Omit<IdentityShare, 'owner_user_id'>): Promise<IdentityShare> {
    return this.createIdentityShare(share)
  }

  public async getIdentityShares(): Promise<IdentityShare[]> {
    return this.getStoreData<IdentityShare>('identity_shares')
  }

  // ═══════════════════════════════════════════════════════════════════
  // ROUTES API
  // ═══════════════════════════════════════════════════════════════════

  public async getAllRoutes(): Promise<SavedRoute[]> {
    return this.getStoreData<SavedRoute>('routes')
  }

  public async getRouteById(id: string): Promise<SavedRoute | undefined> {
    const list = await this.getAllRoutes()
    return list.find((r) => r.id === id)
  }

  public async saveRoute(route: Omit<SavedRoute, 'user_id' | 'created_at'> & { created_at?: string }): Promise<SavedRoute> {
    const fullRoute: SavedRoute = {
      ...route,
      user_id: this.userId,
      created_at: route.created_at || new Date().toISOString(),
      last_updated: new Date().toISOString(),
    }
    await this.putStoreItem('routes', fullRoute)
    return fullRoute
  }

  public async deleteRoute(id: string): Promise<boolean> {
    await this.deleteStoreItem('routes', id)
    return true
  }

  // ═══════════════════════════════════════════════════════════════════
  // PLACES API
  // ═══════════════════════════════════════════════════════════════════

  public async getAllPlaces(): Promise<SavedPlace[]> {
    return this.getStoreData<SavedPlace>('places')
  }

  public async getPlaceById(id: string): Promise<SavedPlace | undefined> {
    const list = await this.getAllPlaces()
    return list.find((p) => p.id === id)
  }

  public async savePlace(place: Omit<SavedPlace, 'user_id' | 'created_at'> & { created_at?: string }): Promise<SavedPlace> {
    const fullPlace: SavedPlace = {
      ...place,
      user_id: this.userId,
      created_at: place.created_at || new Date().toISOString(),
    }
    await this.putStoreItem('places', fullPlace)
    return fullPlace
  }

  public async deletePlace(id: string): Promise<boolean> {
    await this.deleteStoreItem('places', id)
    return true
  }

  // ═══════════════════════════════════════════════════════════════════
  // PEOPLE & CONTACTS API (Non-Biometric / Opt-In Token Verification)
  // ═══════════════════════════════════════════════════════════════════

  public async getAllPeople(): Promise<SavedPerson[]> {
    return this.getStoreData<SavedPerson>('people')
  }

  public async getPersonById(id: string): Promise<SavedPerson | undefined> {
    const list = await this.getAllPeople()
    return list.find((p) => p.id === id)
  }

  public async savePerson(person: Omit<SavedPerson, 'user_id' | 'created_at'> & { created_at?: string }): Promise<SavedPerson> {
    const fullPerson: SavedPerson = {
      ...person,
      user_id: this.userId,
      created_at: person.created_at || new Date().toISOString(),
    }
    await this.putStoreItem('people', fullPerson)
    return fullPerson
  }

  public async deletePerson(id: string): Promise<boolean> {
    await this.deleteStoreItem('people', id)
    return true
  }

  // ═══════════════════════════════════════════════════════════════════
  // VISUAL MEMORIES API
  // ═══════════════════════════════════════════════════════════════════

  public async getAllVisualMemories(): Promise<VisualMemory[]> {
    return this.getStoreData<VisualMemory>('visual_memories')
  }

  public async getVisualMemoryById(id: string): Promise<VisualMemory | undefined> {
    const list = await this.getAllVisualMemories()
    return list.find((m) => m.id === id)
  }

  public async saveVisualMemory(memory: Omit<VisualMemory, 'user_id' | 'created_at'> & { created_at?: string }): Promise<VisualMemory> {
    const fullMemory: VisualMemory = {
      ...memory,
      user_id: this.userId,
      created_at: memory.created_at || new Date().toISOString(),
    }
    await this.putStoreItem('visual_memories', fullMemory)
    return fullMemory
  }

  public async deleteVisualMemory(id: string): Promise<boolean> {
    await this.deleteStoreItem('visual_memories', id)
    return true
  }

  // ═══════════════════════════════════════════════════════════════════
  // IDENTITY SHARES API
  // ═══════════════════════════════════════════════════════════════════

  public async createIdentityShare(share: Omit<IdentityShare, 'owner_user_id'>): Promise<IdentityShare> {
    const fullShare: IdentityShare = {
      ...share,
      owner_user_id: this.userId,
    }
    await this.putStoreItem('identity_shares', fullShare)
    return fullShare
  }

  public async getIdentityShareByHash(tokenHash: string): Promise<IdentityShare | undefined> {
    const list = await this.getStoreData<IdentityShare>('identity_shares')
    return list.find((s) => s.identity_token_hash === tokenHash)
  }

  public async revokeIdentityShare(id: string): Promise<boolean> {
    const list = await this.getStoreData<IdentityShare>('identity_shares')
    const item = list.find((s) => s.id === id)
    if (item) {
      item.revoked_at = Date.now()
      await this.putStoreItem('identity_shares', item)
      return true
    }
    return false
  }

  // ═══════════════════════════════════════════════════════════════════
  // MULTI-DOMAIN MEMORY SEARCH (Natural Voice & Query)
  // ═══════════════════════════════════════════════════════════════════

  public async searchMemories(query: string): Promise<MemorySearchResult[]> {
    if (!query || query.trim().length === 0) return []
    const q = query.toLowerCase().trim()
    const results: MemorySearchResult[] = []

    // Search Routes
    const routes = await this.getAllRoutes()
    for (const r of routes) {
      let score = 0
      const name = r.route_name.toLowerCase()
      if (name.includes(q)) score += 10
      if (r.start_location.toLowerCase().includes(q)) score += 5
      if (r.end_location.toLowerCase().includes(q)) score += 5
      for (const lm of r.landmarks) {
        if (lm.name.toLowerCase().includes(q)) score += 4
      }
      if (score > 0) {
        results.push({
          type: 'route',
          id: r.id,
          title: r.route_name,
          subtitle: `${(r.distance / 1000).toFixed(2)} km • ${Math.round(r.duration / 60)} mins • ${r.landmarks.length} landmarks`,
          matchScore: score,
          data: r,
        })
      }
    }

    // Search Places
    const places = await this.getAllPlaces()
    for (const p of places) {
      let score = 0
      if (p.place_name.toLowerCase().includes(q)) score += 10
      if (p.description.toLowerCase().includes(q)) score += 4
      if (score > 0) {
        results.push({
          type: 'place',
          id: p.id,
          title: p.place_name,
          subtitle: p.description || 'Saved place',
          matchScore: score,
          data: p,
        })
      }
    }

    // Search People
    const people = await this.getAllPeople()
    for (const person of people) {
      let score = 0
      if (person.display_name.toLowerCase().includes(q)) score += 10
      if (person.nickname && person.nickname.toLowerCase().includes(q)) score += 8
      if (person.relationship_label.toLowerCase().includes(q)) score += 5
      if (score > 0) {
        results.push({
          type: 'person',
          id: person.id,
          title: person.display_name + (person.nickname ? ` (${person.nickname})` : ''),
          subtitle: `${person.relationship_label} • Identity Status: ${person.sharing_status}`,
          matchScore: score,
          data: person,
        })
      }
    }

    // Search Visual Memories
    const visual = await this.getAllVisualMemories()
    for (const v of visual) {
      let score = 0
      if (v.memory_name.toLowerCase().includes(q)) score += 10
      if (v.description.toLowerCase().includes(q)) score += 5
      for (const obj of v.detected_objects) {
        if (obj.toLowerCase().includes(q)) score += 3
      }
      if (score > 0) {
        results.push({
          type: 'visual',
          id: v.id,
          title: v.memory_name,
          subtitle: v.description || `Recognized objects: ${v.detected_objects.join(', ')}`,
          matchScore: score,
          data: v,
        })
      }
    }

    return results.sort((a, b) => b.matchScore - a.matchScore)
  }
}

export const MemoryRepository = new MemoryRepositoryClass()
