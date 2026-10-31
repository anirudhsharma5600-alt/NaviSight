/**
 * NaviAble AI 2.0 — Central Voice Command Router & Execution Engine
 *
 * Connects parsed voice intents to real application functions:
 * Voice Input -> Speech Recognition -> Intent Classification -> Command Router -> Relevant Feature -> Actual AI Result -> Navi Voice Response
 *
 * Executes real operations:
 * - Currency scanning: acquires active camera frame, runs ONNX model, checks confidence, formats speech
 * - Camera controls: starts, stops, or switches camera
 * - Scene & road intelligence: summarizes current detections
 * - System settings: language switching, volume, speaking speed, stop speaking
 */

import { VoiceManager } from '../services/VoiceAnnouncementManager'
import { RoadIntelligence } from '../services/roadIntelligence'
import { getLatestDetections, naviEmit } from '../services/naviEventBus'
import { recognizeStableBanknote, loadCurrencyModel } from '../services/currencyDetection'
import { analyzeRoadSurfaceHeuristic } from '../services/potholeDetection'
import { AssistantState, type AssistantLanguage } from './AssistantState'
import { VoiceResponse } from './VoiceResponse'
import type { ParsedIntent } from './IntentClassifier'
import { NaviToolRouter } from './NaviToolRouter'

export interface CommandExecutionResult {
  spokenText: string
  success: boolean
  actionTaken: string
  payload?: any
}

type CommandHandler = (
  intent: ParsedIntent,
  lang: AssistantLanguage,
  navigate?: (path: string) => void
) => Promise<CommandExecutionResult>

class VoiceCommandRouterEngine {
  private registry: Map<string, CommandHandler> = new Map()
  private lastCurrencyScanAmount: number | null = null

  constructor() {
    this.registerDefaultHandlers()
  }

  public register(intentName: string, handler: CommandHandler) {
    this.registry.set(intentName, handler)
  }

  public async execute(
    intent: ParsedIntent,
    lang: AssistantLanguage,
    navigate?: (path: string) => void
  ): Promise<CommandExecutionResult> {
    const handler = this.registry.get(intent.intent)
    if (handler) {
      try {
        return await handler(intent, lang, navigate)
      } catch (err: any) {
        console.error(`[CommandRouter] Error executing intent ${intent.intent}:`, err)
        return {
          spokenText: lang === 'hi' ? 'कमांड निष्पादित करने में समस्या आई।' : 'There was an issue processing that command.',
          success: false,
          actionTaken: 'ERROR',
        }
      }
    }

    // Fallback for unknown intent
    return {
      spokenText: VoiceResponse.getUnknown(lang),
      success: false,
      actionTaken: 'UNKNOWN_FALLBACK',
    }
  }

  private registerDefaultHandlers() {
    // ─── 1. Camera Commands ───
    this.register('CAMERA_START', async (_, lang, navigate) => {
      naviEmit('camera:start')
      return {
        spokenText: VoiceResponse.getCameraStarted(lang),
        success: true,
        actionTaken: 'CAMERA_STARTED',
      }
    })

    this.register('CAMERA_STOP', async (_, lang) => {
      naviEmit('camera:stop')
      return {
        spokenText: VoiceResponse.getCameraStopped(lang),
        success: true,
        actionTaken: 'CAMERA_STOPPED',
      }
    })

    this.register('CAMERA_SWITCH_REAR', async (_, lang) => {
      naviEmit('camera:switch')
      return {
        spokenText: VoiceResponse.getCameraSwitched(lang),
        success: true,
        actionTaken: 'CAMERA_SWITCHED',
      }
    })

    this.register('CAMERA_RESTART', async (_, lang) => {
      naviEmit('camera:stop')
      setTimeout(() => naviEmit('camera:start'), 500)
      return {
        spokenText: lang === 'hi' ? 'कैमरा रीस्टार्ट किया जा रहा है।' : 'Restarting camera.',
        success: true,
        actionTaken: 'CAMERA_RESTARTED',
      }
    })

    // ─── 2. Scene & Road Intelligence Commands ───
    this.register('SCENE_DESCRIBE', async (_, lang) => {
      const summary = RoadIntelligence.buildSceneDescription(lang)
      return {
        spokenText: summary,
        success: true,
        actionTaken: 'SCENE_DESCRIBED',
      }
    })

    this.register('SCENE_OBJECTS_NEARBY', async (_, lang) => {
      const dets = getLatestDetections()
      if (dets.length === 0) {
        return {
          spokenText: lang === 'hi' ? 'कोई वस्तु नहीं दिख रही है।' : 'No objects detected nearby.',
          success: true,
          actionTaken: 'NO_OBJECTS',
        }
      }
      const uniqueNames = Array.from(new Set(dets.map((d) => d.class)))
      const spoken =
        lang === 'hi'
          ? `दिखाई दे रही वस्तुएं हैं: ${uniqueNames.join(', ')}.`
          : `Objects in view: ${uniqueNames.join(', ')}.`
      return {
        spokenText: spoken,
        success: true,
        actionTaken: 'OBJECTS_LISTED',
      }
    })

    this.register('SCENE_ROAD_CHECK', async (_, lang) => {
      const summary = RoadIntelligence.buildSceneDescription(lang)
      return {
        spokenText: summary,
        success: true,
        actionTaken: 'ROAD_CHECKED',
      }
    })

    this.register('SCENE_VEHICLE_CHECK', async (_, lang) => {
      const dets = getLatestDetections()
      const vehicles = dets.filter((d) =>
        ['car', 'motorcycle', 'bicycle', 'bus', 'truck'].includes(d.class.toLowerCase())
      )
      if (vehicles.length === 0) {
        return {
          spokenText:
            lang === 'hi'
              ? 'पास में कोई वाहन नहीं दिख रहा है।'
              : 'No vehicles detected in your immediate view.',
          success: true,
          actionTaken: 'NO_VEHICLES',
        }
      }
      const closest = vehicles[0]
      const pos =
        closest.position === 'CENTRE'
          ? 'ahead'
          : `on the ${closest.position.toLowerCase()}`
      const spoken =
        lang === 'hi'
          ? `एक ${closest.class} ${closest.position === 'CENTRE' ? 'सामने' : closest.position === 'LEFT' ? 'बाईं ओर' : 'दाईं ओर'} दिखाई दे रही है।`
          : `A ${closest.class} is visible ${pos}.`
      return {
        spokenText: spoken,
        success: true,
        actionTaken: 'VEHICLE_DETECTED',
      }
    })

    // ─── 3. Currency Commands (REAL MODEL EXECUTION) ───
    this.register('CURRENCY_SCAN', async (_, lang, navigate) => {
      // Find active video element in DOM
      const videoEl = document.querySelector('video') as HTMLVideoElement | null

      if (!videoEl || videoEl.readyState < 2 || videoEl.videoWidth === 0) {
        // Navigate to currency page if no camera is active
        if (navigate) navigate('/currency')
        return {
          spokenText: VoiceResponse.getCurrencyHoldPrompt(lang),
          success: true,
          actionTaken: 'NAVIGATED_CURRENCY_AWAIT_FRAME',
        }
      }

      // Ensure model is ready
      await loadCurrencyModel()

      // Execute actual banknote inference on current live frame
      const res = await recognizeStableBanknote(videoEl, {
        language: lang,
        autoSpeak: false, // Router controls final announcement
        forceAnnouncement: true,
      })

      if (res && res.isConfident && res.amount > 0) {
        this.lastCurrencyScanAmount = res.amount
        const speech = VoiceResponse.getCurrencyResult(res.amount, res.displayName, lang)
        return {
          spokenText: speech,
          success: true,
          actionTaken: 'CURRENCY_RECOGNIZED',
          payload: res,
        }
      }

      // Model uncertain or note not clearly framed
      return {
        spokenText: res.spokenFeedback || VoiceResponse.getCurrencyUncertain(lang),
        success: false,
        actionTaken: 'CURRENCY_UNCERTAIN',
        payload: res,
      }
    })

    this.register('CURRENCY_REPEAT', async (_, lang) => {
      if (this.lastCurrencyScanAmount) {
        const speech = VoiceResponse.getCurrencyResult(
          this.lastCurrencyScanAmount,
          `₹${this.lastCurrencyScanAmount}`,
          lang
        )
        return {
          spokenText: speech,
          success: true,
          actionTaken: 'CURRENCY_REPEATED',
        }
      }
      return {
        spokenText:
          lang === 'hi'
            ? 'कोई पिछला स्कैन उपलब्ध नहीं है।'
            : 'No previous currency amount recorded. Say scan currency to scan a note.',
        success: false,
        actionTaken: 'NO_PREVIOUS_CURRENCY',
      }
    })

    this.register('CURRENCY_SCAN_ANOTHER', async (intent, lang, navigate) => {
      const handler = this.registry.get('CURRENCY_SCAN')
      if (handler) return handler(intent, lang, navigate)
      return {
        spokenText: VoiceResponse.getCurrencyHoldPrompt(lang),
        success: true,
        actionTaken: 'CURRENCY_RESCAN',
      }
    })

    this.register('CURRENCY_STOP', async (_, lang, navigate) => {
      if (navigate) navigate('/dashboard')
      return {
        spokenText: lang === 'hi' ? 'करेंसी मोड बंद कर दिया गया है।' : 'Currency reader stopped.',
        success: true,
        actionTaken: 'CURRENCY_STOPPED',
      }
    })

    this.register('CURRENCY_LANG_HINDI', async (_, __, navigate) => {
      AssistantState.updateState({ language: 'hi' })
      VoiceManager.setLanguage('hi')
      return {
        spokenText: 'करेंसी की भाषा अब हिंदी है।',
        success: true,
        actionTaken: 'LANG_CHANGED_HINDI',
      }
    })

    // ─── 4. Road Hazards & Potholes ───
    this.register('ROAD_HAZARDS_DETECT_POTHOLES', async (_, lang, navigate) => {
      const videoEl = document.querySelector('video') as HTMLVideoElement | null
      if (videoEl && videoEl.readyState >= 2) {
        const anomaly = analyzeRoadSurfaceHeuristic(videoEl, {
          autoAnnounce: false,
          language: lang,
        })
        if (anomaly.hasSurfaceAnomaly && anomaly.spokenAlert) {
          return {
            spokenText: anomaly.spokenAlert,
            success: true,
            actionTaken: 'POTHOLE_ANOMALY_DETECTED',
            payload: anomaly,
          }
        }
      }

      if (navigate) navigate('/pothole')
      return {
        spokenText:
          lang === 'hi'
            ? 'सड़क गड्ढा पहचान सक्रिय है। सड़क की निगरानी की जा रही है।'
            : 'Monitoring road surface for potholes and cracks. Please walk cautiously.',
        success: true,
        actionTaken: 'ROAD_HAZARD_ENABLED',
      }
    })

    this.register('ROAD_HAZARDS_DESCRIBE', async (_, lang) => {
      const videoEl = document.querySelector('video') as HTMLVideoElement | null
      if (videoEl && videoEl.readyState >= 2) {
        const anomaly = analyzeRoadSurfaceHeuristic(videoEl, {
          autoAnnounce: false,
          language: lang,
        })
        if (anomaly.hasSurfaceAnomaly && anomaly.spokenAlert) {
          return {
            spokenText: anomaly.spokenAlert,
            success: true,
            actionTaken: 'ROAD_SURFACE_ANOMALY',
          }
        }
      }
      return {
        spokenText:
          lang === 'hi'
            ? 'सड़क पर कोई गंभीर गड्ढा या अवरोध नहीं दिखा। फिर भी सावधानी बरतें।'
            : 'No immediate road surface hazards detected. Exercise standard walking caution.',
        success: true,
        actionTaken: 'ROAD_SURFACE_CHECKED',
      }
    })

    // ─── 5. Assistant Controls ───
    this.register('ASSISTANT_STOP_SPEAKING', async () => {
      VoiceManager.stopAllSpeech()
      return {
        spokenText: '', // Silence immediately
        success: true,
        actionTaken: 'STOPPED_SPEAKING',
      }
    })

    this.register('ASSISTANT_SPEAK_SLOWER', async (_, lang) => {
      const currentRate = VoiceManager.getRate ? VoiceManager.getRate() : 0.92
      const newRate = Math.max(0.65, currentRate - 0.15)
      VoiceManager.setRate(newRate)
      AssistantState.updateState({ rate: newRate })
      return {
        spokenText: lang === 'hi' ? 'अब मैं धीरे बोल रहा हूँ।' : 'I will speak slower now.',
        success: true,
        actionTaken: 'RATE_SLOWER',
      }
    })

    this.register('ASSISTANT_SPEAK_LOUDER', async (_, lang) => {
      VoiceManager.setVolume(1.0)
      AssistantState.updateState({ volume: 1.0 })
      return {
        spokenText: lang === 'hi' ? 'आवाज़ बढ़ा दी गई है।' : 'Volume set to maximum.',
        success: true,
        actionTaken: 'VOLUME_INCREASED',
      }
    })

    this.register('ASSISTANT_LANG_HINDI', async () => {
      AssistantState.updateState({ language: 'hi' })
      VoiceManager.setLanguage('hi')
      return {
        spokenText: 'भाषा बदलकर हिंदी कर दी गई है।',
        success: true,
        actionTaken: 'LANGUAGE_HINDI',
      }
    })

    this.register('ASSISTANT_LANG_PUNJABI', async () => {
      AssistantState.updateState({ language: 'pa' })
      VoiceManager.setLanguage('pa')
      return {
        spokenText: 'ਭਾਸ਼ਾ ਬਦਲ ਕੇ ਪੰਜਾਬੀ ਕਰ ਦਿੱਤੀ ਗਈ ਹੈ।',
        success: true,
        actionTaken: 'LANGUAGE_PUNJABI',
      }
    })

    this.register('ASSISTANT_LANG_ENGLISH', async () => {
      AssistantState.updateState({ language: 'en' })
      VoiceManager.setLanguage('en')
      return {
        spokenText: 'Language switched to English.',
        success: true,
        actionTaken: 'LANGUAGE_ENGLISH',
      }
    })

    this.register('ASSISTANT_REPEAT', async () => {
      const state = AssistantState.getState()
      const last = state.lastResponse || 'No previous announcement recorded.'
      return {
        spokenText: last,
        success: true,
        actionTaken: 'REPEAT_ANNOUNCEMENT',
      }
    })

    this.register('ASSISTANT_HELP', async (_, lang) => {
      return {
        spokenText: VoiceResponse.getHelp(lang),
        success: true,
        actionTaken: 'HELP_PROVIDED',
      }
    })

    this.register('OCR_READ_TEXT', async (_, lang, navigate) => {
      if (navigate) navigate('/ocr')
      return {
        spokenText:
          lang === 'hi'
            ? 'टेक्स्ट रीडर खोला जा रहा है। कैमरे को टेक्स्ट के सामने रखें।'
            : 'Opening text reader. Hold text in front of camera.',
        success: true,
        actionTaken: 'NAVIGATED_OCR',
      }
    })

    // ─── 7. Remember & Personal Memory Commands ───
    this.register('REMEMBER_OPEN', async (_, lang, navigate) => {
      if (navigate) navigate('/remember')
      return {
        spokenText: lang === 'hi' ? 'रिमेंबर डैशबोर्ड खोला जा रहा है।' : 'Opening Remember dashboard.',
        success: true,
        actionTaken: 'NAVIGATED_REMEMBER',
      }
    })

    this.register('REMEMBER_ROUTE_START', async (intent) => {
      const query = intent.rawQuery.replace(/(remember|record|track|start)\s*(this\s*)?(walking\s*)?route/i, '').trim()
      const routeName = query || 'Walk Route'
      const res = await NaviToolRouter.executeTool('startRouteRecording', { routeName })
      return {
        spokenText: res.spokenResponse,
        success: res.success,
        actionTaken: 'ROUTE_RECORDING_STARTED',
        payload: res.data,
      }
    })

    this.register('REMEMBER_ROUTE_STOP', async (intent) => {
      const query = intent.rawQuery.replace(/(save|finish|stop)\s*(this\s*)?route/i, '').replace(/as\s*/i, '').trim()
      const res = await NaviToolRouter.executeTool('stopAndSaveRoute', { routeName: query || undefined })
      return {
        spokenText: res.spokenResponse,
        success: res.success,
        actionTaken: 'ROUTE_SAVED',
      }
    })

    this.register('REMEMBER_ROUTE_RECALL', async (intent) => {
      const query = intent.rawQuery.replace(/(tell\s*me\s*about\s*route|how\s*do\s*i\s*get\s*to|recall\s*route|describe\s*route)/i, '').trim()
      const res = await NaviToolRouter.executeTool('recallRoute', { routeName: query })
      return {
        spokenText: res.spokenResponse,
        success: res.success,
        actionTaken: 'ROUTE_RECALLED',
        payload: res.data,
      }
    })

    this.register('REMEMBER_PLACE_SAVE', async (intent) => {
      const query = intent.rawQuery.replace(/(remember|save)\s*(this\s*)?(place|location|spot)/i, '').replace(/as\s*/i, '').trim()
      const placeName = query || 'Marked Place'
      const res = await NaviToolRouter.executeTool('savePlace', { placeName })
      return {
        spokenText: res.spokenResponse,
        success: res.success,
        actionTaken: 'PLACE_SAVED',
        payload: res.data,
      }
    })

    this.register('REMEMBER_VISUAL_SAVE', async (intent) => {
      const query = intent.rawQuery.replace(/(remember\s*what\s*this\s*looks\s*like|save\s*visual\s*memory|remember\s*this\s*view)/i, '').trim()
      const memName = query || 'Scene Memory'
      const res = await NaviToolRouter.executeTool('saveVisualMemory', { memoryName: memName })
      return {
        spokenText: res.spokenResponse,
        success: res.success,
        actionTaken: 'VISUAL_MEMORY_SAVED',
        payload: res.data,
      }
    })

    this.register('REMEMBER_VISUAL_RECALL', async () => {
      const res = await NaviToolRouter.executeTool('checkSceneResemblance', {})
      return {
        spokenText: res.spokenResponse,
        success: res.success,
        actionTaken: 'VISUAL_SCENE_CHECKED',
        payload: res.data,
      }
    })

    this.register('REMEMBER_SEARCH', async (intent) => {
      const query = intent.rawQuery.replace(/(what\s*did\s*i\s*save\s*about|search\s*memories\s*for|do\s*you\s*remember|find\s*in\s*memory)/i, '').trim()
      const res = await NaviToolRouter.executeTool('searchMemories', { query })
      return {
        spokenText: res.spokenResponse,
        success: res.success,
        actionTaken: 'MEMORY_SEARCHED',
      }
    })
  }
}

export const VoiceCommandRouter = new VoiceCommandRouterEngine()

