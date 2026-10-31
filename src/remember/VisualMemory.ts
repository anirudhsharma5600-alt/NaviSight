/**
 * NaviAble AI — Visual Memory Manager
 * 
 * High-level manager for storing, searching, and recalling visual memories.
 */

import { MemoryRepository, type VisualMemory as IVisualMemory } from './MemoryRepository'
import { VisualMemoryService, type VisualMatchResult } from '../services/VisualMemoryService'

export class VisualMemoryManager {
  public async getMemories(): Promise<IVisualMemory[]> {
    return await MemoryRepository.getVisualMemories()
  }

  public async getMemory(id: string): Promise<IVisualMemory | undefined> {
    return await MemoryRepository.getVisualMemory(id)
  }

  public async deleteMemory(id: string): Promise<boolean> {
    return await MemoryRepository.deleteVisualMemory(id)
  }

  public async findMemoryByName(name: string): Promise<IVisualMemory | null> {
    const list = await this.getMemories()
    const q = name.toLowerCase().trim()
    if (!q) return null
    return list.find(m => m.memory_name.toLowerCase().includes(q)) || null
  }

  public async saveCurrentScene(params: {
    name: string
    description?: string
    detectedObjects: string[]
    cameraElement?: HTMLVideoElement | HTMLCanvasElement
    voiceNote?: string
    includeGPS?: boolean
  }): Promise<IVisualMemory> {
    return await VisualMemoryService.createVisualMemory(params)
  }

  public async matchScene(params: {
    detectedObjects: string[]
    cameraElement?: HTMLVideoElement | HTMLCanvasElement
    currentPos?: { lat: number; lng: number }
  }): Promise<VisualMatchResult | null> {
    return await VisualMemoryService.matchCurrentScene(params)
  }

  public formatMatchAnnouncement(match: VisualMatchResult): string {
    const mem = match.memory
    const date = new Date(mem.created_at).toLocaleDateString()
    return `This scene resembles your saved memory: ${mem.memory_name}. Saved on ${date}.`
  }
}

export const VisualMemory = new VisualMemoryManager()
