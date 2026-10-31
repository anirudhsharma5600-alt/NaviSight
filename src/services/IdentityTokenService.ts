/**
 * NaviAble AI — Identity Token Service (Consent-Based People Recognition)
 * 
 * STRICT PRIVACY GUARANTEE:
 * - NO Facial Recognition.
 * - NO Facial Embeddings or Biometric Scanning.
 * - NO Unconsented Identification.
 * 
 * How identification works:
 * - Voluntary, opt-in cryptographic QR identity tokens ("Digital Badges").
 * - Signed with HMAC-SHA256 and time-bounded with explicit expiration (e.g. 24h, 7d).
 * - Scanned via camera using jsQR when a contact voluntarily presents their badge.
 * - Revocable at any moment by the owner.
 * - Includes 'Quiet Public Mode' to protect privacy in crowded spaces.
 */

import jsQR from 'jsqr'
import QRCode from 'qrcode'
import { MemoryRepository, type IdentityShare, type SavedPerson } from '../remember/MemoryRepository'

export interface IdentityTokenPayload {
  v: number // version = 1
  id: string
  name: string
  nick?: string
  rel: 'Friend' | 'Family' | 'Colleague' | 'Caregiver' | 'Doctor' | 'Acquaintance' | 'Other'
  iat: number // issued at ms
  exp: number // expires at ms
  owner: string
}

export interface VerificationResult {
  valid: boolean
  reason?: string
  payload?: IdentityTokenPayload
}

export interface ScannedContactResult {
  payload: IdentityTokenPayload
  savedPerson?: SavedPerson
  isSavedContact: boolean
  rawToken: string
}

const TOKEN_PREFIX = 'NAVI_ID:v1:'
const DEFAULT_SIGNING_SALT = 'naviable_sovereign_identity_key_v1'

class IdentityTokenServiceClass {
  private quietPublicMode: boolean = false
  private scanCanvas: HTMLCanvasElement | null = null
  private scanCtx: CanvasRenderingContext2D | null = null
  private lastAnnouncedTokenHash: string = ''
  private lastAnnouncedTime: number = 0

  constructor() {
    if (typeof window !== 'undefined') {
      const storedQuiet = localStorage.getItem('naviable_quiet_public_mode')
      this.quietPublicMode = storedQuiet === 'true'
    }
  }

  public isQuietPublicMode(): boolean {
    return this.quietPublicMode
  }

  public setQuietPublicMode(enabled: boolean) {
    this.quietPublicMode = enabled
    if (typeof window !== 'undefined') {
      localStorage.setItem('naviable_quiet_public_mode', enabled ? 'true' : 'false')
    }
  }

  /**
   * Derive a Web Crypto HMAC key from secret
   */
  private async getHmacKey(secretStr: string = DEFAULT_SIGNING_SALT): Promise<CryptoKey> {
    const enc = new TextEncoder()
    return await crypto.subtle.importKey(
      'raw',
      enc.encode(secretStr),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    )
  }

  /**
   * Compute HMAC-SHA256 signature in hex
   */
  private async signPayload(dataStr: string): Promise<string> {
    const enc = new TextEncoder()
    const key = await this.getHmacKey()
    const signature = await crypto.subtle.sign('HMAC', key, enc.encode(dataStr))
    const hashArray = Array.from(new Uint8Array(signature))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Compute fast SHA-256 hash string for indexing/matching
   */
  public async hashToken(tokenStr: string): Promise<string> {
    const enc = new TextEncoder()
    const digest = await crypto.subtle.digest('SHA-256', enc.encode(tokenStr))
    const hashArray = Array.from(new Uint8Array(digest))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Issue a voluntary, expiring QR identity badge
   */
  public async issueIdentityBadge(params: {
    displayName: string
    nickname?: string
    relationship: 'Friend' | 'Family' | 'Colleague' | 'Caregiver' | 'Doctor' | 'Acquaintance' | 'Other'
    expiryHours?: number
  }): Promise<{ token: string; qrDataUrl: string; shareRecord: IdentityShare }> {
    const now = Date.now()
    const expiryMs = now + (params.expiryHours || 24) * 3600 * 1000
    const ownerId = MemoryRepository.getUserId()
    const identityId = 'id_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36)

    const payload: IdentityTokenPayload = {
      v: 1,
      id: identityId,
      name: params.displayName.trim(),
      nick: params.nickname?.trim() || undefined,
      rel: params.relationship,
      iat: now,
      exp: expiryMs,
      owner: ownerId,
    }

    const jsonStr = JSON.stringify(payload)
    const base64Data = typeof btoa !== 'undefined' 
      ? btoa(encodeURIComponent(jsonStr)) 
      : Buffer.from(jsonStr).toString('base64')

    const sigHex = await this.signPayload(base64Data)
    const token = `${TOKEN_PREFIX}${base64Data}.${sigHex}`
    const tokenHash = await this.hashToken(token)

    // Generate high-contrast QR code image
    const qrDataUrl = await QRCode.toDataURL(token, {
      errorCorrectionLevel: 'M',
      margin: 2,
      scale: 8,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })

    const shareRecord: IdentityShare = {
      id: identityId,
      owner_user_id: ownerId,
      display_name: params.displayName,
      identity_token: token,
      identity_token_hash: tokenHash,
      created_at: now,
      expiry: expiryMs,
    }

    await MemoryRepository.saveIdentityShare(shareRecord)

    return { token, qrDataUrl, shareRecord }
  }

  /**
   * Verify an identity token string
   */
  public async verifyToken(tokenStr: string): Promise<VerificationResult> {
    if (!tokenStr || !tokenStr.startsWith(TOKEN_PREFIX)) {
      return { valid: false, reason: 'Invalid token prefix. Not a NaviAble identity badge.' }
    }

    const rest = tokenStr.slice(TOKEN_PREFIX.length)
    const parts = rest.split('.')
    if (parts.length !== 2) {
      return { valid: false, reason: 'Malformed token structure.' }
    }

    const [base64Data, providedSig] = parts

    // Verify cryptographic signature
    const expectedSig = await this.signPayload(base64Data)
    if (expectedSig !== providedSig) {
      return { valid: false, reason: 'Cryptographic signature mismatch. Token is forged or corrupted.' }
    }

    // Decode payload
    let payload: IdentityTokenPayload
    try {
      const decodedJson = typeof atob !== 'undefined'
        ? decodeURIComponent(atob(base64Data))
        : Buffer.from(base64Data, 'base64').toString('utf-8')
      payload = JSON.parse(decodedJson)
    } catch {
      return { valid: false, reason: 'Failed to parse identity token payload.' }
    }

    // Check expiration
    const now = Date.now()
    if (payload.exp < now) {
      return { 
        valid: false, 
        reason: `Identity badge expired ${Math.round((now - payload.exp) / 60000)} minutes ago.`,
        payload 
      }
    }

    // Check revocation
    const tokenHash = await this.hashToken(tokenStr)
    const allShares = await MemoryRepository.getIdentityShares()
    const revoked = allShares.find((s: IdentityShare) => s.identity_token_hash === tokenHash && s.revoked_at)
    if (revoked) {
      return { valid: false, reason: 'Identity badge was revoked by the issuer.', payload }
    }

    return { valid: true, payload }
  }

  /**
   * Scan camera video feed for QR identity tokens using jsQR
   */
  public async scanVideoFrame(
    video: HTMLVideoElement | HTMLCanvasElement
  ): Promise<ScannedContactResult | null> {
    const width = ('videoWidth' in video ? video.videoWidth : video.width) || 0
    const height = ('videoHeight' in video ? video.videoHeight : video.height) || 0
    if (width === 0 || height === 0) return null

    if (!this.scanCanvas) {
      this.scanCanvas = document.createElement('canvas')
    }
    if (this.scanCanvas.width !== width || this.scanCanvas.height !== height) {
      this.scanCanvas.width = width
      this.scanCanvas.height = height
      this.scanCtx = this.scanCanvas.getContext('2d', { willReadFrequently: true })
    }

    if (!this.scanCtx) return null

    this.scanCtx.drawImage(video, 0, 0, width, height)
    const imgData = this.scanCtx.getImageData(0, 0, width, height)
    const code = jsQR(imgData.data, imgData.width, imgData.height, {
      inversionAttempts: 'dontInvert'
    })

    if (!code || !code.data) return null

    const rawData = code.data.trim()
    if (!rawData.startsWith(TOKEN_PREFIX)) return null

    const verification = await this.verifyToken(rawData)
    if (!verification.valid || !verification.payload) {
      return null
    }

    const payload = verification.payload
    const tokenHash = await this.hashToken(rawData)
    const savedPerson = await MemoryRepository.getPersonByTokenHash(tokenHash)

    return {
      payload,
      savedPerson: savedPerson || undefined,
      isSavedContact: Boolean(savedPerson),
      rawToken: rawData
    }
  }

  /**
   * Format spoken announcement respecting Quiet Public Mode
   */
  public formatSpokenAnnouncement(scanned: ScannedContactResult): string {
    const name = scanned.savedPerson?.nickname || scanned.payload.nick || scanned.payload.name
    const rel = scanned.savedPerson?.relationship_label || scanned.payload.rel

    if (this.quietPublicMode) {
      // In quiet mode, do not broadcast full name to strangers nearby
      return `Verified contact detected nearby.`
    }

    return `${rel} ${name} is in front of you.`
  }

  /**
   * Debounce announcement to avoid repeating continuously
   */
  public shouldAnnounce(tokenHash: string, cooldownMs: number = 8000): boolean {
    const now = Date.now()
    if (this.lastAnnouncedTokenHash === tokenHash && (now - this.lastAnnouncedTime) < cooldownMs) {
      return false
    }
    this.lastAnnouncedTokenHash = tokenHash
    this.lastAnnouncedTime = now
    return true
  }
}

export const IdentityTokenService = new IdentityTokenServiceClass()
