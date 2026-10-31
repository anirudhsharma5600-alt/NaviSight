/**
 * NaviAble AI — People Memory (Consent-Based Contact Manager)
 * 
 * Manages trusted people profiles, relationships, voice notes, and 
 * consent-based identity tokens.
 */

import { MemoryRepository, type SavedPerson } from './MemoryRepository'
import { IdentityTokenService } from '../services/IdentityTokenService'

export class PeopleMemoryManager {
  /**
   * Get all contacts saved by the user
   */
  public async getContacts(): Promise<SavedPerson[]> {
    return await MemoryRepository.getPeople()
  }

  /**
   * Get contact by ID
   */
  public async getContact(id: string): Promise<SavedPerson | null> {
    return (await MemoryRepository.getPerson(id)) || null
  }

  /**
   * Save or update a contact profile
   */
  public async saveContact(contact: Omit<SavedPerson, 'id' | 'user_id' | 'created_at'> & { id?: string }): Promise<SavedPerson> {
    const existing = contact.id ? (await MemoryRepository.getPerson(contact.id)) || null : null
    const person: SavedPerson = {
      id: contact.id || 'person_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      user_id: MemoryRepository.getUserId(),
      display_name: contact.display_name.trim(),
      nickname: contact.nickname?.trim(),
      relationship_label: contact.relationship_label || 'Friend',
      shared_identity_id: contact.shared_identity_id,
      sharing_status: contact.sharing_status || 'none',
      token_hash: contact.token_hash,
      expiry: contact.expiry,
      voice_notes: contact.voice_notes || existing?.voice_notes || [],
      created_at: existing?.created_at || new Date().toISOString(),
    }

    await MemoryRepository.savePerson(person)
    return person
  }

  /**
   * Import contact directly from a verified token
   */
  public async importContactFromToken(
    tokenStr: string,
    customNickname?: string,
    relationship?: SavedPerson['relationship_label'],
    voiceNote?: string
  ): Promise<SavedPerson> {
    const verification = await IdentityTokenService.verifyToken(tokenStr)
    if (!verification.valid || !verification.payload) {
      throw new Error(verification.reason || 'Invalid or expired token')
    }

    const payload = verification.payload
    const tokenHash = await IdentityTokenService.hashToken(tokenStr)

    const person: SavedPerson = {
      id: 'person_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      user_id: MemoryRepository.getUserId(),
      display_name: payload.name,
      nickname: customNickname?.trim() || payload.nick || payload.name,
      relationship_label: relationship || payload.rel || 'Friend',
      shared_identity_id: payload.id,
      sharing_status: 'active',
      token_hash: tokenHash,
      expiry: payload.exp,
      voice_notes: voiceNote ? [voiceNote] : [],
      created_at: new Date().toISOString(),
    }

    await MemoryRepository.savePerson(person)
    return person
  }

  /**
   * Add a voice note or memo to a contact
   */
  public async addVoiceNote(personId: string, note: string): Promise<SavedPerson | null> {
    const person = await MemoryRepository.getPerson(personId)
    if (!person) return null

    if (!person.voice_notes) person.voice_notes = []
    person.voice_notes.push(note.trim())
    await MemoryRepository.savePerson(person)
    return person
  }

  /**
   * Delete contact
   */
  public async deleteContact(personId: string): Promise<boolean> {
    return await MemoryRepository.deletePerson(personId)
  }

  /**
   * Lookup contact by name or nickname (fuzzy)
   */
  public async findContactByName(query: string): Promise<SavedPerson | null> {
    const people = await this.getContacts()
    const q = query.toLowerCase().trim()
    if (!q) return null

    const match = people.find(p => 
      p.display_name.toLowerCase().includes(q) || 
      (p.nickname && p.nickname.toLowerCase().includes(q))
    )
    return match || null
  }
}

export const PeopleMemory = new PeopleMemoryManager()
