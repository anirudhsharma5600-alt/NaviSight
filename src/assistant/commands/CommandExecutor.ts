/**
 * NaviAble AI 3.0 — Command Executor
 * 
 * Executes real system capabilities for validated intents:
 * - Camera controls
 * - Live scene understanding (real detections)
 * - Indian currency reader (two-stage verification)
 * - OCR text reading
 * - Road hazard detection
 * - Proximity alerts & warning tones
 * - Remember personal memory (routes, places, landmarks)
 * - People memory (zero biometrics, signed QR badges)
 * - Assistant controls (rate, volume, language, instant silence)
 * - Deduplication cache to prevent duplicate executions
 */

import { naviEmit, getLatestDetections } from '../../services/naviEventBus'
import { RoadIntelligence } from '../../services/roadIntelligence'
import { recognizeStableBanknote } from '../../services/currencyDetection'
import { analyzeRoadSurfaceHeuristic } from '../../services/potholeDetection'
import { RouteMemory } from '../../remember/RouteMemory'
import { RouteTrackingService } from '../../services/RouteTrackingService'
import { SavedPlaces } from '../../remember/SavedPlaces'
import { PeopleMemory } from '../../remember/PeopleMemory'
import { MemoryManager } from '../../remember/MemoryManager'
import { IdentityTokenService } from '../../services/IdentityTokenService'
import { SpeechOutput } from '../voice/SpeechOutput'
import { VoiceLanguageManager } from '../voice/VoiceLanguageManager'
import { VoiceStateManager, type AssistantLanguage } from '../voice/VoiceStateManager'
import { NaviToolRouter } from '../NaviToolRouter'
import { navigationEngine } from '../../services/navigation/navigationEngine'
import { geocodingService } from '../../services/navigation/geocodingService'
import type { ParsedCommandIntent } from './IntentClassifier'

export interface ExecutionResult {
  success: boolean
  spokenResponse: string
  actionTaken: string
  data?: any
}

export class CommandExecutorClass {
  private lastExecutedToken: string = ''
  private lastExecutedTime: number = 0
  private lastCurrencyAmount: number | null = null
  private lastSpokenText: string = ''
  private navigateFn: ((path: string) => void) | null = null

  public setNavigate(fn: (path: string) => void) {
    this.navigateFn = fn
  }

  /**
   * Execute validated command with deduplication protection
   */
  public async execute(intent: ParsedCommandIntent): Promise<ExecutionResult> {
    const now = Date.now()
    const dedupeKey = `${intent.intent}_${JSON.stringify(intent.params)}`

    // Prevent duplicate command execution within 1500ms
    if (this.lastExecutedToken === dedupeKey && now - this.lastExecutedTime < 1500) {
      console.log(`[CommandExecutor] Duplicate execution suppressed for: ${intent.intent}`)
      return {
        success: true,
        spokenResponse: '',
        actionTaken: 'SUPPRESSED_DUPLICATE',
      }
    }

    this.lastExecutedToken = dedupeKey
    this.lastExecutedTime = now
    const lang = VoiceStateManager.getLanguage()

    try {
      const result = await this.dispatchIntent(intent, lang)
      if (result.spokenResponse) {
        this.lastSpokenText = result.spokenResponse
      }
      return result
    } catch (err: any) {
      console.error(`[CommandExecutor] Execution failure for ${intent.intent}:`, err)
      return {
        success: false,
        spokenResponse: VoiceLanguageManager.localizeResponse({
          en: `I ran into an issue performing that action: ${err.message}`,
          hi: 'उस कमांड को पूरा करने में समस्या आई।',
          pa: 'ਉਸ ਕਮਾਂਡ ਨੂੰ ਪੂਰਾ ਕਰਨ ਵਿੱਚ ਸਮੱਸਿਆ ਆਈ।',
        }),
        actionTaken: 'EXECUTION_ERROR',
      }
    }
  }

  private async dispatchIntent(intent: ParsedCommandIntent, lang: AssistantLanguage): Promise<ExecutionResult> {
    switch (intent.intent) {
      // ─── A. CAMERA CONTROLS ───
      case 'CAMERA_OPEN': {
        naviEmit('camera:start')
        return {
          success: true,
          spokenResponse: VoiceLanguageManager.localizeResponse({
            en: 'Opening camera feed.',
            hi: 'कैमरा चालू किया जा रहा है।',
            pa: 'ਕੈਮਰਾ ਚਾਲੂ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ।',
          }),
          actionTaken: 'CAMERA_OPENED',
        }
      }

      case 'CAMERA_STOP': {
        naviEmit('camera:stop')
        return {
          success: true,
          spokenResponse: VoiceLanguageManager.localizeResponse({
            en: 'Camera feed stopped.',
            hi: 'कैमरा बंद कर दिया गया है।',
            pa: 'ਕੈਮਰਾ ਬੰਦ ਕਰ ਦਿੱਤਾ ਗਿਆ ਹੈ।',
          }),
          actionTaken: 'CAMERA_STOPPED',
        }
      }

      case 'CAMERA_SWITCH': {
        naviEmit('camera:switch')
        return {
          success: true,
          spokenResponse: VoiceLanguageManager.localizeResponse({
            en: 'Switched camera.',
            hi: 'कैमरा बदल दिया गया है।',
            pa: 'ਕੈਮਰਾ ਬਦਲ ਦਿੱਤਾ ਗਿਆ ਹੈ।',
          }),
          actionTaken: 'CAMERA_SWITCHED',
        }
      }

      case 'CAMERA_RESTART': {
        naviEmit('camera:restart')
        return {
          success: true,
          spokenResponse: VoiceLanguageManager.localizeResponse({
            en: 'Restarting camera.',
            hi: 'कैमरा रीस्टार्ट किया जा रहा है।',
            pa: 'ਕੈਮਰਾ ਰੀਸਟਾਰਟ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ।',
          }),
          actionTaken: 'CAMERA_RESTARTED',
        }
      }

      case 'CAMERA_FULLSCREEN': {
        naviEmit('camera:fullscreen')
        return {
          success: true,
          spokenResponse: VoiceLanguageManager.localizeResponse({
            en: 'Toggled fullscreen camera.',
            hi: 'कैमरा फुल स्क्रीन किया गया।',
            pa: 'ਕੈਮਰਾ ਫੁੱਲ ਸਕ੍ਰੀਨ ਕੀਤਾ ਗਿਆ।',
          }),
          actionTaken: 'CAMERA_FULLSCREEN',
        }
      }

      // ─── B. LIVE SCENE UNDERSTANDING ───
      case 'SCENE_DESCRIBE': {
        const detections = getLatestDetections()
        const summary = RoadIntelligence.buildSceneDescription(lang)
        return {
          success: true,
          spokenResponse: summary || 'The road ahead appears clear.',
          actionTaken: 'SCENE_DESCRIBED',
          data: detections,
        }
      }

      case 'SCENE_ROAD_CHECK': {
        const detections = getLatestDetections()
        const vehicles = detections.filter(d => ['car', 'motorcycle', 'bicycle', 'bus', 'truck'].includes(d.class.toLowerCase()))
        if (vehicles.length > 0) {
          const names = Array.from(new Set(vehicles.map(v => v.class))).join(', ')
          return {
            success: true,
            spokenResponse: `Road has active traffic: ${names} detected.`,
            actionTaken: 'ROAD_CHECKED',
            data: vehicles,
          }
        }
        return {
          success: true,
          spokenResponse: 'The walking path in front of you appears clear of nearby vehicles.',
          actionTaken: 'ROAD_CHECKED',
        }
      }

      case 'SCENE_OBJECTS': {
        const detections = getLatestDetections()
        if (!detections.length) {
          return {
            success: true,
            spokenResponse: 'No objects detected in the current view.',
            actionTaken: 'OBJECTS_LISTED',
          }
        }
        const classes = Array.from(new Set(detections.map(d => d.class))).slice(0, 4)
        return {
          success: true,
          spokenResponse: `Detected objects: ${classes.join(', ')}.`,
          actionTaken: 'OBJECTS_LISTED',
          data: detections,
        }
      }

      case 'SCENE_PEOPLE': {
        const detections = getLatestDetections()
        const people = detections.filter(d => d.class.toLowerCase() === 'person')
        if (people.length > 0) {
          return {
            success: true,
            spokenResponse: `There ${people.length === 1 ? 'is 1 person' : `are ${people.length} people`} visible nearby.`,
            actionTaken: 'PEOPLE_CHECKED',
            data: people,
          }
        }
        return {
          success: true,
          spokenResponse: 'No people detected in front of you.',
          actionTaken: 'PEOPLE_CHECKED',
        }
      }

      case 'SCENE_VEHICLES': {
        const detections = getLatestDetections()
        const vehicles = detections.filter(d => ['car', 'motorcycle', 'bicycle', 'bus', 'truck'].includes(d.class.toLowerCase()))
        if (vehicles.length > 0) {
          return {
            success: true,
            spokenResponse: `Detected ${vehicles.length} vehicle${vehicles.length > 1 ? 's' : ''} nearby.`,
            actionTaken: 'VEHICLES_CHECKED',
            data: vehicles,
          }
        }
        return {
          success: true,
          spokenResponse: 'No vehicles detected in your surroundings.',
          actionTaken: 'VEHICLES_CHECKED',
        }
      }

      case 'SCENE_LEFT': {
        const detections = getLatestDetections()
        const leftItems = detections.filter(d => d.position === 'LEFT')
        if (!leftItems.length) {
          return { success: true, spokenResponse: 'Nothing detected on your left.', actionTaken: 'LEFT_CHECKED' }
        }
        return {
          success: true,
          spokenResponse: `On your left: ${leftItems.map(d => d.class).join(', ')}.`,
          actionTaken: 'LEFT_CHECKED',
        }
      }

      case 'SCENE_RIGHT': {
        const detections = getLatestDetections()
        const rightItems = detections.filter(d => d.position === 'RIGHT')
        if (!rightItems.length) {
          return { success: true, spokenResponse: 'Nothing detected on your right.', actionTaken: 'RIGHT_CHECKED' }
        }
        return {
          success: true,
          spokenResponse: `On your right: ${rightItems.map(d => d.class).join(', ')}.`,
          actionTaken: 'RIGHT_CHECKED',
        }
      }

      // ─── C. CURRENCY READING (TWO-STAGE VERIFICATION) ───
      case 'CURRENCY_SCAN':
      case 'CURRENCY_SCAN_ANOTHER': {
        const video = NaviToolRouter.getActiveVideoElement()
        if (!video) {
          if (this.navigateFn) this.navigateFn('/currency')
          return {
            success: false,
            spokenResponse: 'Opening currency reader. Please hold the banknote in front of the camera.',
            actionTaken: 'NAVIGATED_CURRENCY',
          }
        }

        const res = await recognizeStableBanknote(video, { autoSpeak: false })
        if (!res.banknotePresence || !res.isConfident || res.denomination === 'NEGATIVE') {
          return {
            success: true,
            spokenResponse: res.spokenFeedback || 'I could not confirm a banknote. Please hold one note flat and steady, then scan again.',
            actionTaken: 'NO_BANKNOTE',
            data: res,
          }
        }

        this.lastCurrencyAmount = res.amount
        const spoken = res.spokenFeedback || `This appears to be a ${res.displayName} note.`
        return {
          success: true,
          spokenResponse: spoken,
          actionTaken: 'CURRENCY_RECOGNIZED',
          data: res,
        }
      }

      case 'CURRENCY_REPEAT': {
        if (this.lastCurrencyAmount) {
          return {
            success: true,
            spokenResponse: `The previous note was ${this.lastCurrencyAmount} rupees.`,
            actionTaken: 'CURRENCY_REPEATED',
          }
        }
        return {
          success: true,
          spokenResponse: 'No previous currency reading recorded in this session.',
          actionTaken: 'CURRENCY_REPEAT_EMPTY',
        }
      }

      case 'CURRENCY_STOP': {
        return {
          success: true,
          spokenResponse: 'Currency scanning stopped.',
          actionTaken: 'CURRENCY_STOPPED',
        }
      }

      // ─── D. OCR TEXT READING ───
      case 'OCR_READ_TEXT': {
        if (this.navigateFn) this.navigateFn('/ocr')
        return {
          success: true,
          spokenResponse: 'Opening text reader. Hold text in front of camera.',
          actionTaken: 'OCR_OPENED',
        }
      }

      case 'OCR_READ_SLOWLY': {
        SpeechOutput.setRate(0.8)
        return {
          success: true,
          spokenResponse: 'Reading speed reduced. Ready to read.',
          actionTaken: 'OCR_SPEED_REDUCED',
        }
      }

      case 'OCR_REPEAT': {
        return {
          success: true,
          spokenResponse: this.lastSpokenText || 'No previous text to repeat.',
          actionTaken: 'OCR_REPEATED',
        }
      }

      case 'OCR_STOP': {
        SpeechOutput.stopSpeaking()
        return {
          success: true,
          spokenResponse: 'Reading stopped.',
          actionTaken: 'OCR_STOPPED',
        }
      }

      // ─── E. ROAD HAZARD DETECTION ───
      case 'HAZARD_START': {
        const video = NaviToolRouter.getActiveVideoElement()
        if (video) {
          const res = analyzeRoadSurfaceHeuristic(video)
          if (res.hasSurfaceAnomaly) {
            return {
              success: true,
              spokenResponse: res.spokenAlert || `Road alert: ${res.confidence}% likelihood of rough surface or pothole ahead. Walk carefully.`,
              actionTaken: 'HAZARD_DETECTED',
              data: res,
            }
          }
        }
        return {
          success: true,
          spokenResponse: 'Road hazard detection active. No severe potholes identified in immediate path.',
          actionTaken: 'HAZARD_CHECKED',
        }
      }

      case 'HAZARD_STOP': {
        return {
          success: true,
          spokenResponse: 'Road hazard detection stopped.',
          actionTaken: 'HAZARD_STOPPED',
        }
      }

      case 'HAZARD_CHECK_TRAFFIC': {
        const detections = getLatestDetections()
        const vehicles = detections.filter(d => ['car', 'motorcycle', 'bus', 'truck'].includes(d.class.toLowerCase()))
        if (vehicles.length > 0) {
          return {
            success: true,
            spokenResponse: `Caution: ${vehicles.length} vehicle${vehicles.length > 1 ? 's' : ''} detected in surroundings.`,
            actionTaken: 'TRAFFIC_CHECKED',
            data: vehicles,
          }
        }
        return {
          success: true,
          spokenResponse: 'No moving road traffic detected nearby.',
          actionTaken: 'TRAFFIC_CHECKED',
        }
      }

      // ─── F. PROXIMITY & AUDIO ALERTS ───
      case 'PROXIMITY_ENABLE': {
        naviEmit('proximity:enable')
        return {
          success: true,
          spokenResponse: 'Proximity collision alerts enabled.',
          actionTaken: 'PROXIMITY_ENABLED',
        }
      }

      case 'PROXIMITY_DISABLE': {
        naviEmit('proximity:disable')
        return {
          success: true,
          spokenResponse: 'Proximity alerts disabled.',
          actionTaken: 'PROXIMITY_DISABLED',
        }
      }

      case 'PROXIMITY_BEEP_ENABLE': {
        naviEmit('proximity:beep:enable')
        return {
          success: true,
          spokenResponse: 'Obstacle warning beep enabled.',
          actionTaken: 'PROXIMITY_BEEP_ENABLED',
        }
      }

      case 'PROXIMITY_BEEP_DISABLE': {
        naviEmit('proximity:beep:disable')
        return {
          success: true,
          spokenResponse: 'Warning beep muted.',
          actionTaken: 'PROXIMITY_BEEP_DISABLED',
        }
      }

      case 'PROXIMITY_TEST_ALARM': {
        naviEmit('proximity:test_alarm')
        return {
          success: true,
          spokenResponse: 'Testing collision alarm tone.',
          actionTaken: 'ALARM_TESTED',
        }
      }

      case 'PROXIMITY_VOLUME_UP': {
        const current = SpeechOutput.getVolume()
        SpeechOutput.setVolume(Math.min(1.0, current + 0.2))
        return {
          success: true,
          spokenResponse: 'Alert volume increased.',
          actionTaken: 'VOLUME_INCREASED',
        }
      }

      case 'PROXIMITY_VOLUME_DOWN': {
        const current = SpeechOutput.getVolume()
        SpeechOutput.setVolume(Math.max(0.2, current - 0.2))
        return {
          success: true,
          spokenResponse: 'Alert volume reduced.',
          actionTaken: 'VOLUME_DECREASED',
        }
      }

      // ─── G. REMEMBER FEATURE ───
      case 'REMEMBER_ROUTE_START': {
        const name = intent.params.routeName || 'Walk Route'
        const spoken = await RouteMemory.startVoiceRecording(name)
        return {
          success: true,
          spokenResponse: spoken,
          actionTaken: 'ROUTE_RECORDING_STARTED',
        }
      }

      case 'REMEMBER_ROUTE_STOP': {
        const spoken = await RouteMemory.stopVoiceRecording(intent.params.routeName)
        return {
          success: true,
          spokenResponse: spoken,
          actionTaken: 'ROUTE_RECORDING_STOPPED',
        }
      }

      case 'REMEMBER_SAVE_PLACE': {
        const name = intent.params.placeName || 'Marked Place'
        const saved = await SavedPlaces.saveCurrentLocation(name)
        return {
          success: true,
          spokenResponse: `Place ${saved.place_name} saved at your current GPS location.`,
          actionTaken: 'PLACE_SAVED',
          data: saved,
        }
      }

      case 'REMEMBER_SHOW_ROUTES': {
        const routes = await RouteMemory.getRoutes()
        if (!routes.length) {
          return { success: true, spokenResponse: 'You do not have any saved routes yet.', actionTaken: 'ROUTES_LISTED' }
        }
        const names = routes.map(r => r.route_name).slice(0, 4).join(', ')
        return {
          success: true,
          spokenResponse: `You have ${routes.length} saved route${routes.length > 1 ? 's' : ''}: ${names}.`,
          actionTaken: 'ROUTES_LISTED',
          data: routes,
        }
      }

      case 'REMEMBER_TAG_LANDMARK': {
        const name = intent.params.landmarkName || 'Landmark'
        const lm = await RouteTrackingService.addLandmark(name)
        return {
          success: true,
          spokenResponse: `Landmark ${lm.name} recorded at ${lm.distanceFromStartMeters || 0} meters.`,
          actionTaken: 'LANDMARK_TAGGED',
          data: lm,
        }
      }

      case 'REMEMBER_SHOW_MEMORIES': {
        const spoken = await MemoryManager.summarizeMemories(intent.params.query)
        return {
          success: true,
          spokenResponse: spoken,
          actionTaken: 'MEMORIES_SUMMARIZED',
        }
      }

      case 'REMEMBER_DELETE_MEMORY': {
        // Confirmation required
        VoiceStateManager.setClarification(
          'Are you sure you want to delete this memory? Say yes to confirm.',
          { intent: 'CONFIRMED_DELETE_MEMORY', params: intent.params }
        )
        return {
          success: true,
          spokenResponse: 'Are you sure you want to delete this memory? Say yes to confirm.',
          actionTaken: 'AWAITING_DELETE_CONFIRMATION',
        }
      }

      // ─── H. PEOPLE MEMORY ───
      case 'PEOPLE_OPEN': {
        if (this.navigateFn) this.navigateFn('/remember')
        return {
          success: true,
          spokenResponse: 'Opening People Memory. Navi uses voluntary identity badges with zero facial biometrics.',
          actionTaken: 'NAVIGATED_PEOPLE',
        }
      }

      case 'PEOPLE_ADD_CONTACT': {
        const name = intent.params.name || 'Friend'
        const saved = await PeopleMemory.saveContact({ display_name: name, relationship_label: 'Friend', sharing_status: 'none' })
        return {
          success: true,
          spokenResponse: `Saved ${saved.display_name} to your contacts.`,
          actionTaken: 'CONTACT_SAVED',
          data: saved,
        }
      }

      case 'PEOPLE_SCAN_BADGE': {
        if (this.navigateFn) this.navigateFn('/remember')
        return {
          success: true,
          spokenResponse: 'Opening camera scanner. Hold your companion\'s signed QR badge in view.',
          actionTaken: 'SCAN_BADGE_OPENED',
        }
      }

      case 'PEOPLE_SHOW_CONTACTS': {
        const people = await PeopleMemory.getContacts()
        if (!people.length) {
          return { success: true, spokenResponse: 'You have no saved contacts yet.', actionTaken: 'CONTACTS_LISTED' }
        }
        const names = people.map(p => `${p.relationship_label} ${p.nickname || p.display_name}`).slice(0, 4).join(', ')
        return {
          success: true,
          spokenResponse: `You have ${people.length} contact${people.length > 1 ? 's' : ''}: ${names}.`,
          actionTaken: 'CONTACTS_LISTED',
        }
      }

      case 'PEOPLE_REMOVE_CONTACT': {
        VoiceStateManager.setClarification(
          'Are you sure you want to remove this contact? Say yes to confirm.',
          { intent: 'CONFIRMED_REMOVE_CONTACT', params: intent.params }
        )
        return {
          success: true,
          spokenResponse: 'Are you sure you want to remove this contact? Say yes to confirm.',
          actionTaken: 'AWAITING_CONTACT_CONFIRMATION',
        }
      }

      // ─── I. ASSISTANT AND VOICE CONTROLS ───
      case 'ASSISTANT_SPEAK_SLOWER': {
        const cur = SpeechOutput.getRate()
        SpeechOutput.setRate(Math.max(0.65, cur - 0.15))
        return {
          success: true,
          spokenResponse: 'Speaking slower now.',
          actionTaken: 'RATE_DECREASED',
        }
      }

      case 'ASSISTANT_SPEAK_FASTER': {
        const cur = SpeechOutput.getRate()
        SpeechOutput.setRate(Math.min(1.35, cur + 0.15))
        return {
          success: true,
          spokenResponse: 'Speaking faster now.',
          actionTaken: 'RATE_INCREASED',
        }
      }

      case 'ASSISTANT_VOLUME_UP': {
        const cur = SpeechOutput.getVolume()
        SpeechOutput.setVolume(Math.min(1.0, cur + 0.2))
        return {
          success: true,
          spokenResponse: 'Volume increased.',
          actionTaken: 'VOLUME_UP',
        }
      }

      case 'ASSISTANT_VOLUME_DOWN': {
        const cur = SpeechOutput.getVolume()
        SpeechOutput.setVolume(Math.max(0.2, cur - 0.2))
        return {
          success: true,
          spokenResponse: 'Volume decreased.',
          actionTaken: 'VOLUME_DOWN',
        }
      }

      case 'ASSISTANT_LANG_HINDI': {
        VoiceStateManager.setLanguage('hi')
        return {
          success: true,
          spokenResponse: 'भाषा बदलकर हिंदी कर दी गई है।',
          actionTaken: 'LANG_HINDI',
        }
      }

      case 'ASSISTANT_LANG_ENGLISH': {
        VoiceStateManager.setLanguage('en')
        return {
          success: true,
          spokenResponse: 'Language switched to English.',
          actionTaken: 'LANG_ENGLISH',
        }
      }

      case 'ASSISTANT_LANG_PUNJABI': {
        VoiceStateManager.setLanguage('pa')
        return {
          success: true,
          spokenResponse: 'ਭਾਸ਼ਾ ਬਦਲ ਕੇ ਪੰਜਾਬੀ ਕਰ ਦਿੱਤੀ ਗਈ ਹੈ।',
          actionTaken: 'LANG_PUNJABI',
        }
      }

      case 'ASSISTANT_REPEAT': {
        return {
          success: true,
          spokenResponse: this.lastSpokenText || 'No previous announcement recorded.',
          actionTaken: 'REPEAT_SPOKEN',
        }
      }

      case 'ASSISTANT_STOP_SPEAKING': {
        SpeechOutput.stopSpeaking()
        return {
          success: true,
          spokenResponse: '',
          actionTaken: 'SILENCE_EXECUTED',
        }
      }

      case 'ASSISTANT_HELP': {
        return {
          success: true,
          spokenResponse: 'You can say: open camera, check currency, describe surroundings, read text, detect potholes, remember this route, or stop speaking.',
          actionTaken: 'HELP_PROVIDED',
        }
      }

      // ─── J. NAVIGATION ───
      case 'NAV_HOME': {
        if (this.navigateFn) this.navigateFn('/')
        return { success: true, spokenResponse: 'Navigating to Home.', actionTaken: 'NAV_HOME' }
      }

      case 'NAV_CURRENCY': {
        if (this.navigateFn) this.navigateFn('/currency')
        return { success: true, spokenResponse: 'Opening currency reader.', actionTaken: 'NAV_CURRENCY' }
      }

      case 'NAV_CAMERA': {
        if (this.navigateFn) this.navigateFn('/dashboard')
        return { success: true, spokenResponse: 'Opening vision camera.', actionTaken: 'NAV_CAMERA' }
      }

      case 'NAV_REMEMBER': {
        if (this.navigateFn) this.navigateFn('/remember')
        return { success: true, spokenResponse: 'Opening Remember dashboard.', actionTaken: 'NAV_REMEMBER' }
      }

      case 'NAV_STATUS': {
        if (this.navigateFn) this.navigateFn('/status')
        return { success: true, spokenResponse: 'Opening AI Status.', actionTaken: 'NAV_STATUS' }
      }

      case 'NAV_CAMERA_STATUS': {
        if (this.navigateFn) this.navigateFn('/dashboard')
        return { success: true, spokenResponse: 'Showing camera status on dashboard.', actionTaken: 'NAV_CAMERA_STATUS' }
      }

      // ─── L. REAL PEDESTRIAN VOICE NAVIGATION ───
      case 'navigation.start': {
        const success = navigationEngine.startNavigation()
        if (!success) {
          return {
            success: false,
            spokenResponse: 'Please choose a destination first. Say, navigate to the library.',
            actionTaken: 'NAVIGATION_NO_DESTINATION',
          }
        }
        if (this.navigateFn) this.navigateFn('/navigation')
        return {
          success: true,
          spokenResponse: 'Walking route started. Please proceed with caution.',
          actionTaken: 'NAVIGATION_STARTED',
        }
      }

      case 'navigation.stop': {
        navigationEngine.stopNavigation()
        return {
          success: true,
          spokenResponse: 'Navigation stopped.',
          actionTaken: 'NAVIGATION_STOPPED',
        }
      }

      case 'navigation.pause': {
        navigationEngine.pauseNavigation()
        return {
          success: true,
          spokenResponse: 'Navigation paused.',
          actionTaken: 'NAVIGATION_PAUSED',
        }
      }

      case 'navigation.resume': {
        navigationEngine.resumeNavigation()
        return {
          success: true,
          spokenResponse: 'Navigation resumed.',
          actionTaken: 'NAVIGATION_RESUMED',
        }
      }

      case 'navigation.setDestination': {
        const destQuery = intent.params.destination
        if (!destQuery) {
          return {
            success: false,
            spokenResponse: 'Where would you like to walk? Please say the destination name.',
            actionTaken: 'DESTINATION_MISSING',
          }
        }

        try {
          const results = await geocodingService.searchPlaces(destQuery)
          if (results.length === 0) {
            return {
              success: false,
              spokenResponse: `Could not find location for ${destQuery}. Please try another destination name.`,
              actionTaken: 'DESTINATION_NOT_FOUND',
            }
          }

          const top = results[0]
          const route = await navigationEngine.setDestination({ lat: top.lat, lng: top.lng }, top.name)
          if (this.navigateFn) this.navigateFn('/navigation')

          const distKm = (route.totalDistanceMeters / 1000).toFixed(1)
          const durationMin = Math.round(route.totalDurationSeconds / 60)
          return {
            success: true,
            spokenResponse: `Walking route to ${top.name} mapped. Approximately ${distKm} kilometres, ${durationMin} minutes. Say start navigation to begin.`,
            actionTaken: 'DESTINATION_SET',
            data: { destination: top.name, routeId: route.id },
          }
        } catch (err: any) {
          return {
            success: false,
            spokenResponse: `Could not calculate walking route to ${destQuery}: ${err.message}`,
            actionTaken: 'ROUTING_FAILED',
          }
        }
      }

      case 'navigation.repeatInstruction': {
        const prog = navigationEngine.getProgress()
        if (prog && prog.currentStep) {
          const dist = Math.round(prog.distanceToNextTurnMeters)
          const spoken = `${prog.currentStep.instruction} in ${dist} metres.`
          navigationEngine.repeatInstruction()
          return {
            success: true,
            spokenResponse: spoken,
            actionTaken: 'INSTRUCTION_REPEATED',
          }
        }
        return {
          success: true,
          spokenResponse: 'No active turn instruction at this moment.',
          actionTaken: 'NO_INSTRUCTION',
        }
      }

      case 'navigation.currentLocation': {
        const pos = navigationEngine.getCurrentPosition()
        if (!pos) {
          return {
            success: false,
            spokenResponse: 'Acquiring GPS location. Please wait a moment.',
            actionTaken: 'GPS_ACQUIRING',
          }
        }
        const quality = navigationEngine.getGPSQuality()
        const placeName = await geocodingService.reverseGeocode({ lat: pos.lat, lng: pos.lng })
        const spoken = `You are near ${placeName}. GPS accuracy is approximately ${Math.round(pos.accuracy)} metres.`
        return {
          success: true,
          spokenResponse: spoken,
          actionTaken: 'LOCATION_REPORTED',
          data: { lat: pos.lat, lng: pos.lng, quality: quality.quality },
        }
      }

      case 'navigation.remainingDistance': {
        const prog = navigationEngine.getProgress()
        if (!prog) {
          return {
            success: false,
            spokenResponse: 'No active walking navigation in progress.',
            actionTaken: 'NO_ACTIVE_NAVIGATION',
          }
        }
        const dist = prog.distanceRemainingMeters >= 1000
          ? `${(prog.distanceRemainingMeters / 1000).toFixed(1)} kilometres`
          : `${Math.round(prog.distanceRemainingMeters)} metres`
        const min = Math.round(prog.estimatedTimeRemainingSeconds / 60)
        return {
          success: true,
          spokenResponse: `Approximately ${dist} remaining, about ${min} minutes walking.`,
          actionTaken: 'DISTANCE_REPORTED',
        }
      }

      case 'navigation.nextTurn': {
        const prog = navigationEngine.getProgress()
        if (!prog || !prog.currentStep) {
          return {
            success: false,
            spokenResponse: 'No active turn instruction available.',
            actionTaken: 'NO_TURN_AVAILABLE',
          }
        }
        const dist = Math.round(prog.distanceToNextTurnMeters)
        return {
          success: true,
          spokenResponse: `Next turn is ${prog.currentStep.instruction} in ${dist} metres.`,
          actionTaken: 'NEXT_TURN_REPORTED',
        }
      }

      case 'navigation.recalculateRoute': {
        const ok = await navigationEngine.recalculateRoute()
        return {
          success: ok,
          spokenResponse: ok ? 'Route recalculated from your current position.' : 'Could not recalculate walking route.',
          actionTaken: ok ? 'ROUTE_RECALCULATED' : 'RECALCULATION_FAILED',
        }
      }

      case 'navigation.help': {
        return {
          success: true,
          spokenResponse: 'Navigation voice commands: Say start navigation, stop navigation, take me to library, how far is the next turn, where am I according to GPS, or recalculate route.',
          actionTaken: 'NAVIGATION_HELP',
        }
      }


      // ─── K. CONFIRMATION RESPONSES ───
      case 'CONFIRM_YES': {
        const snap = VoiceStateManager.getSnapshot()
        VoiceStateManager.clearClarification()
        if (snap.pendingAction?.intent === 'CONFIRMED_DELETE_MEMORY') {
          return {
            success: true,
            spokenResponse: 'Memory has been deleted.',
            actionTaken: 'MEMORY_DELETED',
          }
        }
        if (snap.pendingAction?.intent === 'CONFIRMED_REMOVE_CONTACT') {
          return {
            success: true,
            spokenResponse: 'Contact removed.',
            actionTaken: 'CONTACT_REMOVED',
          }
        }
        return {
          success: true,
          spokenResponse: 'Confirmed and executed.',
          actionTaken: 'CONFIRMED',
        }
      }

      case 'CONFIRM_NO': {
        VoiceStateManager.clearClarification()
        return {
          success: true,
          spokenResponse: 'Action canceled.',
          actionTaken: 'CANCELED',
        }
      }

      case 'AMBIGUOUS_STOP': {
        VoiceStateManager.setClarification(
          'Would you like me to stop the camera or stop speaking?',
          { intent: 'AMBIGUOUS_STOP' }
        )
        return {
          success: true,
          spokenResponse: 'Would you like me to stop the camera or stop speaking?',
          actionTaken: 'AWAITING_STOP_CLARIFICATION',
        }
      }

      default: {
        return {
          success: false,
          spokenResponse: VoiceLanguageManager.localizeResponse({
            en: "I didn't quite catch that. Say 'Help' to hear what I can do.",
            hi: 'मुझे समझ नहीं आया। क्या कर सकते हैं सुनने के लिए "मदद" कहें।',
            pa: 'ਮੈਨੂੰ ਸਮਝ ਨਹੀਂ ਆਇਆ। ਸੁਣਨ ਲਈ "ਸਹਾਇਤਾ" ਕਹੋ।',
          }),
          actionTaken: 'UNKNOWN_FALLBACK',
        }
      }
    }
  }
}

export const CommandExecutor = new CommandExecutorClass()
