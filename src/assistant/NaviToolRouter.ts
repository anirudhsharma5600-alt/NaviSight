/**
 * NaviAble AI — Central NAVI Tool Router
 * 
 * Executes real system capabilities for both:
 * 1. Gemini Multimodal Live Assistant tool calls
 * 2. On-Device Voice Command Router intents
 */

import { RouteMemory } from '../remember/RouteMemory'
import { RouteTrackingService } from '../services/RouteTrackingService'
import { SavedPlaces } from '../remember/SavedPlaces'
import { VisualMemory } from '../remember/VisualMemory'
import { PeopleMemory } from '../remember/PeopleMemory'
import { MemoryManager } from '../remember/MemoryManager'
import { RoadIntelligence } from '../services/roadIntelligence'
import { getLatestDetections } from '../services/naviEventBus'
import { recognizeBanknote } from '../services/currencyDetection'
import { GPSService } from '../services/GPSService'

export interface ToolExecutionResponse {
  success: boolean
  spokenResponse: string
  data?: any
}

class NaviToolRouterClass {
  private activeVideoElement: HTMLVideoElement | null = null

  public setActiveVideoElement(video: HTMLVideoElement | null) {
    this.activeVideoElement = video
  }

  public getActiveVideoElement(): HTMLVideoElement | null {
    if (this.activeVideoElement && this.activeVideoElement.readyState >= 2) {
      return this.activeVideoElement
    }
    // Search DOM if not explicitly set
    if (typeof document !== 'undefined') {
      const el = document.querySelector('video')
      if (el && el.readyState >= 2) {
        return el
      }
    }
    return null
  }

  /**
   * Execute a tool by name with arguments
   */
  public async executeTool(toolName: string, args: Record<string, any> = {}): Promise<ToolExecutionResponse> {
    try {
      switch (toolName) {
        case 'startRouteRecording': {
          const routeName = args.routeName || 'My Route'
          const spoken = await RouteMemory.startVoiceRecording(routeName)
          return { success: true, spokenResponse: spoken, data: { routeName } }
        }

        case 'stopAndSaveRoute': {
          const routeName = args.routeName
          const endLocation = args.endLocation
          const spoken = await RouteMemory.stopVoiceRecording(routeName, endLocation)
          return { success: true, spokenResponse: spoken }
        }

        case 'addRouteLandmark': {
          const name = args.landmarkName || 'Landmark'
          const note = args.voiceNote
          const lm = await RouteTrackingService.addLandmark(name, note)
          return {
            success: true,
            spokenResponse: `Landmark ${lm.name} recorded at ${lm.distanceFromStartMeters || 0} meters.`,
            data: lm
          }
        }

        case 'recallRoute': {
          const name = args.routeName || ''
          const route = await RouteMemory.findRouteByName(name)
          if (!route) {
            return {
              success: false,
              spokenResponse: `I couldn't find any saved route named "${name}".`,
            }
          }
          const spoken = RouteMemory.describeRoute(route)
          return { success: true, spokenResponse: spoken, data: route }
        }

        case 'getSavedRoutes': {
          const routes = await RouteMemory.getRoutes()
          if (!routes.length) {
            return { success: true, spokenResponse: "You don't have any saved routes yet." }
          }
          const names = routes.map(r => r.route_name).slice(0, 5).join(', ')
          return {
            success: true,
            spokenResponse: `You have ${routes.length} saved route${routes.length > 1 ? 's' : ''}: ${names}.`,
            data: routes
          }
        }

        case 'savePlace': {
          const name = args.placeName
          if (!name) throw new Error('Place name is required.')
          const saved = await SavedPlaces.saveCurrentLocation(name, args.description)
          return {
            success: true,
            spokenResponse: `Place ${saved.place_name} saved at your current GPS location.`,
            data: saved
          }
        }

        case 'getSavedPlaces': {
          const places = await SavedPlaces.getPlaces()
          if (!places.length) {
            return { success: true, spokenResponse: "You have not saved any places yet." }
          }
          const names = places.map(p => p.place_name).slice(0, 5).join(', ')
          return {
            success: true,
            spokenResponse: `You have ${places.length} saved place${places.length > 1 ? 's' : ''}: ${names}.`,
            data: places
          }
        }

        case 'saveVisualMemory': {
          const name = args.memoryName
          if (!name) throw new Error('Memory name is required.')
          const video = this.getActiveVideoElement()
          const detections = getLatestDetections()
          const detectedLabels = detections.map(d => d.class)

          const memory = await VisualMemory.saveCurrentScene({
            name,
            description: args.description,
            detectedObjects: detectedLabels,
            cameraElement: video || undefined,
            includeGPS: true,
          })

          return {
            success: true,
            spokenResponse: `Visual memory for ${memory.memory_name} saved successfully with ${memory.detected_objects.length} detected reference items.`,
            data: memory
          }
        }

        case 'checkSceneResemblance': {
          const video = this.getActiveVideoElement()
          const detections = getLatestDetections()
          const labels = detections.map(d => d.class)

          let pos: { lat: number; lng: number } | undefined
          if (GPSService.isSupported()) {
            const last = GPSService.getLastPosition()
            if (last) pos = { lat: last.lat, lng: last.lng }
          }

          const match = await VisualMemory.matchScene({
            detectedObjects: labels,
            cameraElement: video || undefined,
            currentPos: pos,
          })

          if (!match) {
            return {
              success: true,
              spokenResponse: "I do not recognize this scene from any of your saved visual memories.",
            }
          }

          const announcement = VisualMemory.formatMatchAnnouncement(match)
          return { success: true, spokenResponse: announcement, data: match }
        }

        case 'scanCurrency': {
          const video = this.getActiveVideoElement()
          if (!video) {
            return {
              success: false,
              spokenResponse: "Camera is not currently active. Please open camera feed to scan currency.",
            }
          }
          const result = await recognizeBanknote(video)
          if (!result.banknotePresence || !result.isConfident || result.denomination === 'NEGATIVE') {
            return {
              success: true,
              spokenResponse: "No genuine Indian banknote detected. Please hold the banknote flat in front of the camera.",
              data: result
            }
          }
          const spoken = result.spokenFeedback || `Detected ${result.displayName} with ${result.confidence} percent confidence.`
          return { success: true, spokenResponse: spoken, data: result }
        }

        case 'describeScene': {
          const detections = getLatestDetections()
          const summary = RoadIntelligence.buildSceneDescription('en')
          return {
            success: true,
            spokenResponse: summary || "The road ahead appears clear.",
            data: detections
          }
        }

        case 'saveContact': {
          const name = args.name
          if (!name) throw new Error('Contact name is required.')
          const saved = await PeopleMemory.saveContact({
            display_name: name,
            nickname: args.nickname,
            relationship_label: args.relationship || 'Friend',
            sharing_status: 'none'
          })
          return {
            success: true,
            spokenResponse: `Saved ${saved.relationship_label} ${saved.nickname || saved.display_name} to your contacts.`,
            data: saved
          }
        }

        case 'searchMemories': {
          const q = args.query || ''
          const spoken = await MemoryManager.summarizeMemories(q)
          return { success: true, spokenResponse: spoken }
        }

        default:
          return {
            success: false,
            spokenResponse: `Tool ${toolName} is not recognized.`,
          }
      }
    } catch (err: any) {
      console.error(`[NaviToolRouter] Error executing ${toolName}:`, err)
      return {
        success: false,
        spokenResponse: `I encountered an issue executing ${toolName}: ${err.message}`,
      }
    }
  }
}

export const NaviToolRouter = new NaviToolRouterClass()
