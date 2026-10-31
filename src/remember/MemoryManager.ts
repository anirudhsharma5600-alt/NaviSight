/**
 * NaviAble AI — Memory Manager (Unified Remember Coordinator)
 * 
 * Provides a single point of interaction for all 4 memory domains:
 * 1. Saved Routes
 * 2. Saved Places
 * 3. People & Contacts
 * 4. Visual Memories
 */

import { RouteMemory } from './RouteMemory'
import { SavedPlaces } from './SavedPlaces'
import { PeopleMemory } from './PeopleMemory'
import { VisualMemory } from './VisualMemory'
import { MemoryRepository, type MemorySearchResult } from './MemoryRepository'

export class MemoryManagerClass {
  public routes = RouteMemory
  public places = SavedPlaces
  public people = PeopleMemory
  public visual = VisualMemory

  /**
   * Universal search across all memories
   */
  public async search(query: string): Promise<MemorySearchResult[]> {
    return await MemoryRepository.searchMemories(query)
  }

  /**
   * Spoken summary of all memories or a specific topic
   */
  public async summarizeMemories(topic?: string): Promise<string> {
    if (topic) {
      const results = await this.search(topic)
      if (!results.length) {
        return `I couldn't find any saved memories matching "${topic}".`
      }

      const count = results.length
      const top = results[0]
      return `Found ${count} memory match${count > 1 ? 'es' : ''}. Top match: ${top.title} (${top.type}), ${top.subtitle}.`
    }

    const [routes, places, people, visual] = await Promise.all([
      this.routes.getRoutes(),
      this.places.getPlaces(),
      this.people.getContacts(),
      this.visual.getMemories(),
    ])

    return `You have ${routes.length} saved route${routes.length === 1 ? '' : 's'}, ` +
           `${places.length} saved place${places.length === 1 ? '' : 's'}, ` +
           `${people.length} contact${people.length === 1 ? '' : 's'}, and ` +
           `${visual.length} visual memor${visual.length === 1 ? 'y' : 'ies'}.`
  }
}

export const MemoryManager = new MemoryManagerClass()
