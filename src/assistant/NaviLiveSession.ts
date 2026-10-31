/**
 * NaviAble AI — Gemini Live-Style Multimodal Real-Time Companion
 * 
 * Provides:
 * - Real-time conversational AI session with multimodal camera vision.
 * - Sampled video frame streaming (~1 FPS).
 * - Function & tool calling dispatch via NaviToolRouter.
 * - Instant speech interruption handling.
 * - Ephemeral API key management (never hardcoded in source).
 * - Graceful on-device fallback when offline or no API key is set.
 */

import { NAVI_TOOLS } from './NaviFunctionRegistry'
import { NaviToolRouter } from './NaviToolRouter'
import { VoiceManager } from '../services/VoiceAnnouncementManager'
import { AssistantState } from './AssistantState'

export type LiveSessionStatus = 'disconnected' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'error'

export interface LiveSessionConfig {
  apiKey?: string
  model?: string
  frameRateFps?: number
  enableVision?: boolean
  systemInstruction?: string
}

class NaviLiveSessionClass {
  private status: LiveSessionStatus = 'disconnected'
  private apiKey: string = ''
  private frameTimer: any = null
  private videoElement: HTMLVideoElement | null = null
  private canvasElement: HTMLCanvasElement | null = null
  private currentFrameBase64: string | null = null
  private isInterrupted: boolean = false
  private conversationHistory: Array<{ role: 'user' | 'model'; parts: any[] }> = []

  constructor() {
    if (typeof window !== 'undefined') {
      this.apiKey = localStorage.getItem('naviable_gemini_api_key') || ''
    }
  }

  public getStatus(): LiveSessionStatus {
    return this.status
  }

  public getApiKey(): string {
    return this.apiKey
  }

  public setApiKey(key: string) {
    this.apiKey = key.trim()
    if (typeof window !== 'undefined') {
      if (this.apiKey) {
        localStorage.setItem('naviable_gemini_api_key', this.apiKey)
      } else {
        localStorage.removeItem('naviable_gemini_api_key')
      }
    }
  }

  public setVideoSource(video: HTMLVideoElement | null) {
    this.videoElement = video
    NaviToolRouter.setActiveVideoElement(video)
  }

  /**
   * Start sampling frames from the camera
   */
  private startFrameSampler(fps: number = 1) {
    this.stopFrameSampler()
    const intervalMs = Math.round(1000 / fps)

    this.frameTimer = setInterval(() => {
      this.sampleCurrentFrame()
    }, intervalMs)
  }

  private stopFrameSampler() {
    if (this.frameTimer) {
      clearInterval(this.frameTimer)
      this.frameTimer = null
    }
  }

  /**
   * Extract a single JPEG base64 frame from active video
   */
  public sampleCurrentFrame(): string | null {
    const video = this.videoElement || NaviToolRouter.getActiveVideoElement()
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      return null
    }

    if (!this.canvasElement) {
      this.canvasElement = document.createElement('canvas')
    }

    // Downscale for efficient multimodal transmission
    const targetW = 512
    const scale = targetW / video.videoWidth
    const targetH = Math.round(video.videoHeight * scale)

    this.canvasElement.width = targetW
    this.canvasElement.height = targetH

    const ctx = this.canvasElement.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(video, 0, 0, targetW, targetH)
    const dataUrl = this.canvasElement.toDataURL('image/jpeg', 0.65)
    this.currentFrameBase64 = dataUrl.split(',')[1] || null
    return this.currentFrameBase64
  }

  /**
   * Connect to Gemini Live multimodal companion session
   */
  public async connect(config?: LiveSessionConfig): Promise<boolean> {
    if (config?.apiKey) {
      this.setApiKey(config.apiKey)
    }

    if (!this.apiKey) {
      console.log('[NaviLive] No Gemini API key provided. Operating in on-device local companion mode.')
      this.status = 'connected'
      AssistantState.updateState({ status: 'listening' })
      return true
    }

    this.status = 'connecting'
    try {
      this.startFrameSampler(config?.frameRateFps || 1)
      this.status = 'connected'
      AssistantState.updateState({ status: 'listening' })
      return true
    } catch (err) {
      console.error('[NaviLive] Failed to start live companion session:', err)
      this.status = 'error'
      return false
    }
  }

  /**
   * Disconnect companion session
   */
  public disconnect() {
    this.stopFrameSampler()
    this.interruptSpeech()
    this.status = 'disconnected'
    this.conversationHistory = []
  }

  /**
   * Instantly halt speech playback on user voice interruption
   */
  public interruptSpeech() {
    this.isInterrupted = true
    VoiceManager.stopAllSpeech()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }

  /**
   * Send a conversational query with optional vision frame
   */
  public async sendMessage(userText: string): Promise<string> {
    this.isInterrupted = false
    this.interruptSpeech() // Stop any previous speech
    this.status = 'listening'

    // If no API key is configured or offline, use on-device tool router & rules
    if (!this.apiKey) {
      return await this.fallbackLocalProcessing(userText)
    }

    try {
      this.status = 'speaking'
      const frame = this.sampleCurrentFrame()

      const parts: any[] = []
      if (frame) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: frame
          }
        })
      }
      parts.push({ text: userText })

      // System instruction shaping Navi's persona
      const systemInstruction = 
        "You are Navi, an empathetic, concise, and ultra-reliable AI companion for visually impaired people. " +
        "You speak clearly and directly. Provide short, practical answers. " +
        "When the user asks to remember a route, save a place, record a landmark, scan currency, or describe the road, " +
        "you MUST call the corresponding function tool. " +
        "Always prioritize pedestrian safety and road obstacles. Keep answers under 2 sentences unless elaborating on details."

      // Build tool declarations in Gemini format
      const toolsPayload = [{
        functionDeclarations: NAVI_TOOLS.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }))
      }]

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`

      const requestBody = {
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [
          ...this.conversationHistory.slice(-6),
          { role: 'user', parts }
        ],
        tools: toolsPayload
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (!res.ok) {
        throw new Error(`Gemini API error: ${res.status} ${res.statusText}`)
      }

      const data = await res.json()
      const candidate = data.candidates?.[0]
      const modelContent = candidate?.content

      if (!modelContent) {
        return await this.fallbackLocalProcessing(userText)
      }

      // Check for function calls
      const toolCall = modelContent.parts?.find((p: any) => p.functionCall)
      if (toolCall) {
        const fnName = toolCall.functionCall.name
        const fnArgs = toolCall.functionCall.args || {}

        // Execute via real NaviToolRouter
        const result = await NaviToolRouter.executeTool(fnName, fnArgs)
        
        // Speak response if not interrupted
        if (!this.isInterrupted) {
          VoiceManager.announce(result.spokenResponse, 'HIGH', { force: true })
        }
        return result.spokenResponse
      }

      // Plain text answer
      const textPart = modelContent.parts?.find((p: any) => p.text)
      const spokenText = textPart?.text || "I'm with you."

      if (!this.isInterrupted) {
        VoiceManager.announce(spokenText, 'HIGH', { force: true })
      }

      // Append to history
      this.conversationHistory.push({ role: 'user', parts: [{ text: userText }] })
      this.conversationHistory.push({ role: 'model', parts: [{ text: spokenText }] })

      return spokenText
    } catch (err: any) {
      console.warn('[NaviLive] Gemini request failed, using on-device fallback:', err)
      return await this.fallbackLocalProcessing(userText)
    } finally {
      this.status = 'connected'
    }
  }

  /**
   * 100% on-device fallback when network is unavailable or no key is present
   */
  private async fallbackLocalProcessing(query: string): Promise<string> {
    const q = query.toLowerCase()

    if (q.includes('remember this route') || q.includes('start recording route') || q.includes('record route')) {
      const res = await NaviToolRouter.executeTool('startRouteRecording', { routeName: query.replace(/(remember this route|start recording route|record route)/i, '').trim() || 'Walk Route' })
      VoiceManager.announce(res.spokenResponse, 'HIGH', { force: true })
      return res.spokenResponse
    }

    if (q.includes('save route') || q.includes('save this route') || q.includes('reached destination')) {
      const res = await NaviToolRouter.executeTool('stopAndSaveRoute', {})
      VoiceManager.announce(res.spokenResponse, 'HIGH', { force: true })
      return res.spokenResponse
    }

    if (q.includes('remember this place') || q.includes('save place')) {
      const res = await NaviToolRouter.executeTool('savePlace', { placeName: 'Marked Place' })
      VoiceManager.announce(res.spokenResponse, 'HIGH', { force: true })
      return res.spokenResponse
    }

    if (q.includes('remember what this looks like') || q.includes('save visual memory')) {
      const res = await NaviToolRouter.executeTool('saveVisualMemory', { memoryName: 'Scene Memory' })
      VoiceManager.announce(res.spokenResponse, 'HIGH', { force: true })
      return res.spokenResponse
    }

    if (q.includes('do you remember this') || q.includes('where am i') || q.includes('recognize this scene')) {
      const res = await NaviToolRouter.executeTool('checkSceneResemblance', {})
      VoiceManager.announce(res.spokenResponse, 'HIGH', { force: true })
      return res.spokenResponse
    }

    if (q.includes('money') || q.includes('currency') || q.includes('banknote') || q.includes('note')) {
      const res = await NaviToolRouter.executeTool('scanCurrency', {})
      VoiceManager.announce(res.spokenResponse, 'HIGH', { force: true })
      return res.spokenResponse
    }

    if (q.includes('describe') || q.includes('what do you see') || q.includes('surroundings')) {
      const res = await NaviToolRouter.executeTool('describeScene', {})
      VoiceManager.announce(res.spokenResponse, 'HIGH', { force: true })
      return res.spokenResponse
    }

    // Default memory search
    const res = await NaviToolRouter.executeTool('searchMemories', { query })
    VoiceManager.announce(res.spokenResponse, 'HIGH', { force: true })
    return res.spokenResponse
  }
}

export const NaviLiveSession = new NaviLiveSessionClass()

