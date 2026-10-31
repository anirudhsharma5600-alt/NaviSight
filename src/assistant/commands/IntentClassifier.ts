/**
 * NaviAble AI 3.0 — Advanced Natural Voice Intent Classifier
 * 
 * Supports:
 * - Natural English, Hindi (Devanagari), Hinglish (Romanized), and Punjabi
 * - Multi-tier classification:
 *   1. Emergency silence fast-path (<5ms)
 *   2. Confirmation state matching (Yes/No/Cancel)
 *   3. Semantic regex & phrase variation matching
 *   4. Jaccard token overlap against registered command keywords
 * - Parameter extraction (route names, place names, contact names)
 * - Clarification generation for ambiguous commands ("Stop it")
 */

import { COMMAND_CATALOG, type CommandDefinition } from './CommandRegistry'
import { VoiceLanguageManager } from '../voice/VoiceLanguageManager'
import { VoiceStateManager } from '../voice/VoiceStateManager'

export interface ParsedCommandIntent {
  intent: string
  category: string
  confidence: number
  rawText: string
  normalizedText: string
  params: Record<string, any>
  isAmbiguous?: boolean
  clarificationPrompt?: string
}

export class IntentClassifierClass {
  // Emergency stop phrases for instant bypass
  private readonly EMERGENCY_SILENCE_PATTERNS = [
    /\b(stop\s*speaking|be\s*quiet|shut\s*up|silence|stop\s*talking|stop\s*audio)\b/i,
    /\b(चुप\s*रहो|शांत\s*हो\s*जाओ|बोलना\s*बंद\s*करो|आवाज़\s*बंद)\b/i,
    /\b(chup\s*raho|shant|bolna\s*band|aawaz\s*band)\b/i,
    /\b(ਚੁੱਪ\s*ਕਰੋ|ਬੋਲਣਾ\s*ਬੰਦ)\b/i,
  ]

  // Ambiguous stop phrases requiring clarification
  private readonly AMBIGUOUS_STOP_PATTERNS = [
    /^(stop\s*it|stop|cancel\s*it|cancel|rok\s*do|bas|ruk\s*jao)$/i,
  ]

  // Semantic intent regex catalog for rich natural language variants
  private readonly INTENT_PATTERNS: Array<{ intent: string; patterns: RegExp[] }> = [
    // ─── CAMERA ───
    {
      intent: 'CAMERA_OPEN',
      patterns: [
        /\b(open|start|turn on|activate|enable|launch)\s*(the\s*)?(camera|video|feed)\b/i,
        /\b(camera|कैमरा|ਕੈਮਰਾ)\s*(on|chalu|shuru|start|khol|kholo|khologe)\b/i,
        /\b(कैमरा\s*चालू|कैमरा\s*शुरू|ਕੈਮਰਾ\s*ਚਾਲੂ|ਕੈਮਰਾ\s*ਖੋਲ੍ਹੋ)\b/i,
      ],
    },
    {
      intent: 'CAMERA_STOP',
      patterns: [
        /\b(stop|close|turn off|disable|shut)\s*(the\s*)?(camera|video|feed)\b/i,
        /\b(camera|कैमरा|ਕੈਮਰਾ)\s*(off|band|roko|stop)\b/i,
        /\b(कैमरा\s*बंद|ਕੈਮਰਾ\s*ਬੰਦ)\b/i,
      ],
    },
    {
      intent: 'CAMERA_SWITCH',
      patterns: [
        /\b(switch|flip|change|reverse)\s*(the\s*)?(camera)?\b/i,
        /\b(rear|back|environment|front)\s*camera\b/i,
        /\b(पीछे का कैमरा|पिछला कैमरा|ਪਿਛਲਾ ਕੈਮਰਾ)\b/i,
        /\b(pichhla|piche ka)\s*camera\b/i,
      ],
    },
    {
      intent: 'CAMERA_RESTART',
      patterns: [
        /\b(restart|reload|refresh|reset)\s*(the\s*)?(camera)\b/i,
        /\b(कैमरा\s*रीस्टार्ट)\b/i,
      ],
    },
    {
      intent: 'CAMERA_FULLSCREEN',
      patterns: [
        /\b(fullscreen|full screen|maximize)\s*(camera)?\b/i,
        /\b(बड़ा करो|पूरी स्क्रीन)\b/i,
      ],
    },

    // ─── SCENE UNDERSTANDING ───
    {
      intent: 'SCENE_DESCRIBE',
      patterns: [
        /\b(describe|what('s| is)|tell me what('s| is))\s*(my\s*)?(surroundings?|environment|around me|in front of me|scene|ahead)\b/i,
        /\b(what do you see|what can you see|look around|what is visible)\b/i,
        /\b(kya dikh raha hai|samne kya hai|saamne kya hai|aas paas kya hai|kya hai)\b/i,
        /\b(सामने क्या है|आस-पास क्या है|क्या दिख रहा है|ਮੇਰੇ ਸਾਹਮਣੇ ਕੀ ਹੈ)\b/i,
      ],
    },
    {
      intent: 'SCENE_ROAD_CHECK',
      patterns: [
        /\b(describe|check|how is|what is on)\s*(the\s*)?(road|path|street|walkway)\b/i,
        /\b(road condition|walking path)\b/i,
        /\b(sadak par kya hai|rasta kaisa hai|sadak kaisi hai)\b/i,
        /\b(सड़क कैसी है|रास्ता कैसा है|सड़क पर क्या है)\b/i,
      ],
    },
    {
      intent: 'SCENE_OBJECTS',
      patterns: [
        /\b(what|list|any)\s*(are\s*)?(the\s*)?objects\s*(nearby|around|visible)?\b/i,
        /\b(kya chizen hain|konsi chizen|chizen batao)\b/i,
        /\b(ਕਿਹੜੀਆਂ ਚੀਜ਼ਾਂ ਹਨ|ਕਿਹੜੀਆਂ ਵਸਤੂਆਂ ਹਨ)\b/i,
      ],
    },
    {
      intent: 'SCENE_PEOPLE',
      patterns: [
        /\b(is there a|any)\s*(person|people|pedestrian|someone|human)\b/i,
        /\b(koi insan hai|koi khada hai|log hain)\b/i,
        /\b(ਕੋਈ ਇਨਸਾਨ ਹੈ|ਕੋਈ ਵਿਅਕਤੀ ਹੈ)\b/i,
      ],
    },
    {
      intent: 'SCENE_VEHICLES',
      patterns: [
        /\b(are there|any)\s*(vehicles?|cars?|bikes?|motorcycles?|buses?|trucks?|traffic)\b/i,
        /\b(gadiyan hain|koi car hai|traffic kaisa hai)\b/i,
      ],
    },
    {
      intent: 'SCENE_LEFT',
      patterns: [
        /\b(what is|what's)\s*(on\s*)?(my\s*)?left\b/i,
        /\b(bayen kya hai|left me kya hai)\b/i,
        /\b(बाईं ओर क्या है|ਖੱਬੇ ਪਾਸੇ ਕੀ ਹੈ)\b/i,
      ],
    },
    {
      intent: 'SCENE_RIGHT',
      patterns: [
        /\b(what is|what's)\s*(on\s*)?(my\s*)?right\b/i,
        /\b(dayen kya hai|right me kya hai)\b/i,
        /\b(दाईं ओर क्या है|ਸੱਜੇ ਪਾਸੇ ਕੀ ਹੈ)\b/i,
      ],
    },

    // ─── CURRENCY READING (RICH NATURAL PHRASING) ───
    {
      intent: 'CURRENCY_SCAN',
      patterns: [
        /\b(check|scan|read|tell|count|identify)\s*(this\s*|the\s*|how\s*much\s*)?(money|cash|currency|rupees?|note|banknote|bill)\b/i,
        /\b(how much\s*(money\s*)?is this|how many rupees|what note is this|tell me the value|check\s*this\s*currency)\b/i,
        /\b(paise|paisa|rupaye|note)\s*(check|dekho|padho|batao|kitna)\b/i,
        /\b(kitne\s*rupaye|kitna\s*paisa|yeh\s*kitna\s*hai|note\s*hai|kitne\s*ka\s*note)\b/i,
        /\b(पैसे कितने हैं|यह कितने का नोट है|नोट चेक करो|रुपये बताओ|करेंसी चेक करो)\b/i,
        /\b(ਇਹ ਕਿੰਨੇ ਰੁਪਏ ਹਨ|ਨੋਟ ਚੈੱਕ ਕਰੋ)\b/i,
      ],
    },
    {
      intent: 'CURRENCY_SCAN_ANOTHER',
      patterns: [
        /\b(scan|check|read)\s*(another|next|one more)\s*(note|banknote)?\b/i,
        /\b(dusra note|agla note|ek aur note)\b/i,
      ],
    },
    {
      intent: 'CURRENCY_REPEAT',
      patterns: [
        /\b(repeat|what was)\s*(the\s*)?(amount|money|rupees|value)\b/i,
        /\b(kitna tha|dobara batao kitna paisa)\b/i,
      ],
    },
    {
      intent: 'CURRENCY_STOP',
      patterns: [
        /\b(stop|close)\s*(currency\s*)?(scanning|reader)?\b/i,
      ],
    },

    // ─── OCR TEXT READING ───
    {
      intent: 'OCR_READ_TEXT',
      patterns: [
        /\b(read\s*(the\s*board|document|text|label|sign|page|screen))\b/i,
        /\b(read\s*this(?!\s*(note|banknote|money|currency|rupee|bill)))\b/i,
        /\b(what is written|kya likha hai|yeh padho|padh kar batao)\b/i,
        /\b(ਕੀ ਲਿਖਿਆ ਹੈ|ਇਹ ਪੜ੍ਹੋ)\b/i,
      ],
    },
    {
      intent: 'OCR_READ_SLOWLY',
      patterns: [
        /\b(read\s*slowly|slow\s*down\s*reading|dheere\s*padho)\b/i,
      ],
    },
    {
      intent: 'OCR_REPEAT',
      patterns: [
        /\b(repeat\s*(the\s*)?text|read\s*again|dobara\s*padho)\b/i,
      ],
    },
    {
      intent: 'OCR_STOP',
      patterns: [
        /\b(stop\s*reading|padhna\s*band)\b/i,
      ],
    },

    // ─── ROAD HAZARDS ───
    {
      intent: 'HAZARD_START',
      patterns: [
        /\b(start\s*road\s*detection|detect\s*potholes|look\s*for\s*(road\s*)?cracks|broken\s*(pavement|road)|check\s*obstacles)\b/i,
        /\b(gaddhe|khadde|toote raste)\s*(dekho|check)\b/i,
        /\b(गड्ढे देखो|सड़क के गड्ढे|ਟੋਏ ਦੇਖੋ)\b/i,
      ],
    },
    {
      intent: 'HAZARD_STOP',
      patterns: [
        /\b(stop\s*(road|pothole)\s*detection)\b/i,
      ],
    },
    {
      intent: 'HAZARD_CHECK_TRAFFIC',
      patterns: [
        /\b(tell\s*me\s*about\s*nearby\s*traffic|traffic\s*check|check\s*traffic)\b/i,
      ],
    },

    // ─── PROXIMITY & AUDIO ALERTS ───
    {
      intent: 'PROXIMITY_ENABLE',
      patterns: [
        /\b(enable|turn on|activate)\s*(proximity\s*)?(alerts?|warnings?)\b/i,
        /\b(proximity\s*chalu)\b/i,
      ],
    },
    {
      intent: 'PROXIMITY_DISABLE',
      patterns: [
        /\b(disable|turn off)\s*(proximity\s*)?(alerts?|warnings?)\b/i,
        /\b(proximity\s*band)\b/i,
      ],
    },
    {
      intent: 'PROXIMITY_BEEP_ENABLE',
      patterns: [
        /\b(enable|turn on)\s*(the\s*)?(beep|beeping|warning\s*tone)\b/i,
        /\b(beep\s*chalu)\b/i,
      ],
    },
    {
      intent: 'PROXIMITY_BEEP_DISABLE',
      patterns: [
        /\b(disable|turn off)\s*(the\s*)?(beep|beeping|warning\s*tone)\b/i,
        /\b(beep\s*band)\b/i,
      ],
    },
    {
      intent: 'PROXIMITY_TEST_ALARM',
      patterns: [
        /\b(test\s*(the\s*)?alarm|test\s*beep|sound\s*alarm)\b/i,
        /\b(alarm\s*bajao)\b/i,
      ],
    },
    {
      intent: 'PROXIMITY_VOLUME_UP',
      patterns: [
        /\b(increase|raise|turn up)\s*(alert|alarm)\s*volume\b/i,
      ],
    },
    {
      intent: 'PROXIMITY_VOLUME_DOWN',
      patterns: [
        /\b(decrease|lower|reduce)\s*(alert|alarm)\s*volume\b/i,
      ],
    },

    // ─── REMEMBER FEATURE ───
    {
      intent: 'REMEMBER_ROUTE_START',
      patterns: [
        /\b(remember|record|track|start)\s*(this\s*)?(walking\s*)?route\b/i,
        /\b(rasta\s*yaad\s*rakho|rasta\s*record\s*karo)\b/i,
        /\b(रास्ता\s*याद\s*रखो|ਰਾਹ\s*ਯਾਦ\s*ਰੱਖੋ)\b/i,
      ],
    },
    {
      intent: 'REMEMBER_ROUTE_STOP',
      patterns: [
        /\b(save|finish|stop)\s*(this\s*)?route\b/i,
        /\b(stop\s*route\s*recording|reached\s*destination)\b/i,
        /\b(rasta\s*save\s*karo|manzil\s*par\s*pahunch\s*gaye)\b/i,
      ],
    },
    {
      intent: 'REMEMBER_SAVE_PLACE',
      patterns: [
        /\b(save|remember)\s*(this\s*)?(place|location|spot)\b/i,
        /\b(yeh\s*jagah\s*yaad\s*rakho|jagah\s*save\s*karo)\b/i,
      ],
    },
    {
      intent: 'REMEMBER_SHOW_ROUTES',
      patterns: [
        /\b(show|list|what\s*are)\s*(my\s*)?saved\s*routes\b/i,
        /\b(mere\s*raste\s*batao)\b/i,
      ],
    },
    {
      intent: 'REMEMBER_TAG_LANDMARK',
      patterns: [
        /\b(remember\s*this\s*landmark|tag\s*landmark|add\s*landmark)\b/i,
        /\b(landmark\s*lagao|landmark\s*save\s*karo)\b/i,
      ],
    },
    {
      intent: 'REMEMBER_SHOW_MEMORIES',
      patterns: [
        /\b(show\s*(my\s*)?saved\s*memories|what\s*did\s*i\s*save|what\s*did\s*i\s*save\s*yesterday)\b/i,
        /\b(meri\s*yaadein\s*batao)\b/i,
      ],
    },
    {
      intent: 'REMEMBER_DELETE_MEMORY',
      patterns: [
        /\b(delete\s*this\s*memory|delete\s*route|remove\s*memory)\b/i,
        /\b(yaad\s*hatao|yaad\s*mitao)\b/i,
      ],
    },

    // ─── PEOPLE MEMORY ───
    {
      intent: 'PEOPLE_OPEN',
      patterns: [
        /\b(open\s*people\s*memory|contacts\s*kholo)\b/i,
      ],
    },
    {
      intent: 'PEOPLE_ADD_CONTACT',
      patterns: [
        /\b(add\s*a\s*contact|save\s*contact|naya\s*contact\s*jodo)\b/i,
      ],
    },
    {
      intent: 'PEOPLE_SCAN_BADGE',
      patterns: [
        /\b(scan\s*(a\s*)?(shared\s*)?identity\s*(code|badge)|scan\s*badge|badge\s*scan\s*karo)\b/i,
      ],
    },
    {
      intent: 'PEOPLE_SHOW_CONTACTS',
      patterns: [
        /\b(show\s*saved\s*contacts|list\s*contacts|mere\s*contacts\s*batao)\b/i,
      ],
    },
    {
      intent: 'PEOPLE_REMOVE_CONTACT',
      patterns: [
        /\b(remove\s*(a\s*)?saved\s*contact|delete\s*contact|contact\s*hatao)\b/i,
      ],
    },

    // ─── ASSISTANT CONTROLS ───
    {
      intent: 'ASSISTANT_SPEAK_SLOWER',
      patterns: [
        /\b(speak\s*slower|talk\s*slower|dheere\s*bolo|slow\s*down)\b/i,
        /\b(धीमे बोलो|ਹੌਲੀ ਬੋਲੋ)\b/i,
      ],
    },
    {
      intent: 'ASSISTANT_SPEAK_FASTER',
      patterns: [
        /\b(speak\s*faster|talk\s*faster|jaldi\s*bolo|speed\s*up)\b/i,
        /\b(तेज़ बोलो|ਛੇਤੀ ਬੋਲੋ)\b/i,
      ],
    },
    {
      intent: 'ASSISTANT_VOLUME_UP',
      patterns: [
        /\b(increase\s*volume|volume\s*up|louder|aawaz\s*badhao)\b/i,
        /\b(आवाज़ बढ़ाओ|ਆਵਾਜ਼ ਵਧਾਓ)\b/i,
      ],
    },
    {
      intent: 'ASSISTANT_VOLUME_DOWN',
      patterns: [
        /\b(decrease\s*volume|volume\s*down|softer|aawaz\s*kam\s*karo)\b/i,
        /\b(आवाज़ कम करो|ਆਵਾਜ਼ ਘਟਾਓ)\b/i,
      ],
    },
    {
      intent: 'ASSISTANT_LANG_HINDI',
      patterns: [
        /\b(change\s*language\s*to\s*hindi|switch\s*to\s*hindi|speak\s*in\s*hindi|hindi\s*me\s*bolo|hindi\s*karo)\b/i,
        /\b(हिंदी में बोलो|भाषा हिंदी करो)\b/i,
      ],
    },
    {
      intent: 'ASSISTANT_LANG_ENGLISH',
      patterns: [
        /\b(change\s*language\s*to\s*english|switch\s*to\s*english|speak\s*in\s*english|english\s*karo)\b/i,
        /\b(अंग्रेज़ी में बोलो|ਅੰਗਰੇਜ਼ੀ ਵਿੱਚ ਬੋਲੋ)\b/i,
      ],
    },
    {
      intent: 'ASSISTANT_LANG_PUNJABI',
      patterns: [
        /\b(change\s*language\s*to\s*punjabi|switch\s*to\s*punjabi|punjabi\s*vich\s*bolo|punjabi\s*karo)\b/i,
        /\b(ਪੰਜਾਬੀ ਵਿੱਚ ਬੋਲੋ|ਪੰਜਾਬੀ ਕਰੋ)\b/i,
      ],
    },
    {
      intent: 'ASSISTANT_REPEAT',
      patterns: [
        /\b(repeat|say\s*that\s*again|what\s*did\s*you\s*say|phir\s*se\s*bolo|dobara\s*batao)\b/i,
        /\b(फिर से बोलो|ਦੁਬਾਰਾ ਬੋਲੋ)\b/i,
      ],
    },
    {
      intent: 'ASSISTANT_HELP',
      patterns: [
        /\b(help|what\s*can\s*you\s*do|madad|kya\s*kar\s*sakte\s*ho)\b/i,
        /\b(मदद|ਸਹਾਇਤਾ)\b/i,
      ],
    },

    // ─── NAVIGATION ───
    {
      intent: 'NAV_HOME',
      patterns: [
        /\b(open\s*home|go\s*to\s*home|main\s*page)\b/i,
      ],
    },
    {
      intent: 'NAV_CURRENCY',
      patterns: [
        /\b(open\s*currency\s*reader|go\s*to\s*currency)\b/i,
      ],
    },
    {
      intent: 'NAV_CAMERA',
      patterns: [
        /\b(open\s*camera\s*page|go\s*to\s*dashboard|vision\s*page)\b/i,
      ],
    },
    {
      intent: 'NAV_REMEMBER',
      patterns: [
        /\b(open\s*remember|go\s*to\s*remember|memories\s*page)\b/i,
      ],
    },
    {
      intent: 'NAV_STATUS',
      patterns: [
        /\b(show\s*ai\s*status|ai\s*status|system\s*status)\b/i,
      ],
    },
    {
      intent: 'NAV_CAMERA_STATUS',
      patterns: [
        /\b(show\s*camera\s*status|camera\s*diagnostics)\b/i,
      ],
    },
    // ─── REAL PEDESTRIAN VOICE NAVIGATION ───
    {
      intent: 'navigation.start',
      patterns: [
        /\b(start|begin)\s*(the\s*)?(walking|pedestrian\s*)?navigation\b/i,
        /\b(start\s*walking|start\s*route|start\s*navigation)\b/i,
        /\b(shuru\s*karo\s*navigation|navigation\s*shuru(\s*karo)?|chalo\s*shuru(\s*karo)?)\b/i,
        /\b(नेविगेशन\s*शुरू|रास्ता\s*चालू|ਨੇਵੀਗੇਸ਼ਨ\s*ਸ਼ੁਰੂ)\b/i,
      ],
    },
    {
      intent: 'navigation.stop',
      patterns: [
        /\b(stop|cancel|end|terminate)\s*(the\s*)?(walking\s*)?navigation\b/i,
        /\b(stop\s*route|cancel\s*route|stop\s*navigation)\b/i,
        /\b(navigation\s*(band\s*karo|roko|cancel\s*karo)|band\s*karo\s*navigation)\b/i,
        /\b(नेविगेशन\s*बंद|रास्ता\s*रोको|ਨੇਵੀਗੇਸ਼ਨ\s*ਬੰਦ)\b/i,
      ],
    },
    {
      intent: 'navigation.pause',
      patterns: [
        /\b(pause\s*(the\s*)?(walking\s*)?navigation|pause\s*route|pause\s*walking)\b/i,
        /\b(ruk\s*jao|pause\s*karo|thoda\s*ruko)\b/i,
        /\b(नेविगेशन\s*रोकें|ਨੇਵੀਗੇਸ਼ਨ\s*ਰੋਕੋ)\b/i,
      ],
    },
    {
      intent: 'navigation.resume',
      patterns: [
        /\b(resume\s*(the\s*)?(walking\s*)?navigation|resume\s*route|continue\s*navigation|continue\s*route)\b/i,
        /\b(phir\s*se\s*shuru(\s*karo)?|aage\s*badho)\b/i,
        /\b(नेविगेशन\s*जारी|ਨੇਵੀਗੇਸ਼ਨ\s*ਜਾਰੀ)\b/i,
      ],
    },
    {
      intent: 'navigation.setDestination',
      patterns: [
        /\b(navigate\s*to|take\s*me\s*to|find\s*(a\s*)?walking\s*route\s*to|walking\s*route\s*to|directions?\s*to)\s+(.+)/i,
        /\b(.+)\s*(ka\s*rasta\s*batao|le\s*chalo|chalo|jana\s*hai)\b/i,
      ],
    },
    {
      intent: 'navigation.repeatInstruction',
      patterns: [
        /\b(repeat\s*(the\s*)?(last\s*)?direction|repeat\s*instruction|what\s*is\s*my\s*next\s*instruction|repeat\s*that)\b/i,
        /\b(kya\s*bola|dobara\s*bolo|phir\s*se\s*bolo)\b/i,
        /\b(पिछला\s*निर्देश\s*दोहराएं|ਦਿਸ਼ਾ\s*ਦੁਹਰਾਓ)\b/i,
      ],
    },
    {
      intent: 'navigation.currentLocation',
      patterns: [
        /\b(where\s*am\s*i\s*(according\s*to\s*gps)?|what('s| is)\s*my\s*(current\s*)?(location|position|coordinates?)|current\s*location)\b/i,
        /\b(meri\s*location|mai\s*kahan\s*hu|main\s*kahan\s*hoon|mera\s*location\s*kya\s*hai)\b/i,
        /\b(मेरी\s*लोकेशन|ਮੇਰੀ\s*ਲੋਕੇਸ਼ਨ)\b/i,
      ],
    },
    {
      intent: 'navigation.remainingDistance',
      patterns: [
        /\b(how\s*much\s*distance\s*is\s*remaining|remaining\s*distance|how\s*far\s*is\s*(the\s*)?destination|how\s*much\s*(is\s*)?left|how\s*far)\b/i,
        /\b(kitni\s*door|kitna\s*bacha|kitna\s*door\s*hai)\b/i,
      ],
    },
    {
      intent: 'navigation.nextTurn',
      patterns: [
        /\b(how\s*far\s*is\s*(the\s*)?next\s*turn|what('s| is)\s*my\s*next\s*turn|next\s*turn)\b/i,
        /\b(agla\s*mod|agla\s*turn)\b/i,
      ],
    },
    {
      intent: 'navigation.recalculateRoute',
      patterns: [
        /\b(recalculate\s*(my\s*)?route|reroute|recalculate\s*navigation)\b/i,
        /\b(dobara\s*rasta\s*banao|rasta\s*badlo|naya\s*rasta|naya\s*route)\b/i,
      ],
    },
    {
      intent: 'navigation.help',
      patterns: [
        /\b(navigation\s*help|how\s*to\s*navigate|help\s*with\s*navigation|navigation\s*commands)\b/i,
      ],
    },

  ]

  /**
   * Main classification method
   */
  public classify(rawQuery: string): ParsedCommandIntent {
    const raw = (rawQuery || '').trim()
    const { normalized, tokens } = VoiceLanguageManager.normalize(raw)

    if (!raw || !normalized || tokens.length === 0) {
      return {
        intent: 'EMPTY',
        category: 'UNKNOWN',
        confidence: 0,
        rawText: raw,
        normalizedText: normalized,
        params: {},
      }
    }

    // 1. Emergency Silence Fast-Path
    for (const p of this.EMERGENCY_SILENCE_PATTERNS) {
      if (p.test(raw) || p.test(normalized)) {
        return {
          intent: 'ASSISTANT_STOP_SPEAKING',
          category: 'ASSISTANT',
          confidence: 1.0,
          rawText: raw,
          normalizedText: normalized,
          params: {},
        }
      }
    }

    // 2. Confirmation State Check (Awaiting Clarification / User Confirmation)
    if (VoiceStateManager.getState() === 'AWAITING_CLARIFICATION') {
      if (/^(yes|yeah|yep|confirm|proceed|haan|ha|sahi hai|हाँ|ਹਾਂ)$/i.test(normalized)) {
        return {
          intent: 'CONFIRM_YES',
          category: 'CONFIRMATION',
          confidence: 0.98,
          rawText: raw,
          normalizedText: normalized,
          params: {},
        }
      }
      if (/^(no|nope|cancel|don't|stop|nahi|mat karo|rok do|नहीं|ਨਹੀਂ)$/i.test(normalized)) {
        return {
          intent: 'CONFIRM_NO',
          category: 'CONFIRMATION',
          confidence: 0.98,
          rawText: raw,
          normalizedText: normalized,
          params: {},
        }
      }
    }

    // 3. Ambiguous Stop Request Check
    for (const p of this.AMBIGUOUS_STOP_PATTERNS) {
      if (p.test(raw) || p.test(normalized)) {
        return {
          intent: 'AMBIGUOUS_STOP',
          category: 'CONFIRMATION',
          confidence: 0.9,
          rawText: raw,
          normalizedText: normalized,
          params: {},
          isAmbiguous: true,
          clarificationPrompt: 'Would you like me to stop the camera or stop speaking?',
        }
      }
    }

    // 4. Semantic Regex Matching with Parameter Extraction
    for (const def of this.INTENT_PATTERNS) {
      for (const pattern of def.patterns) {
        if (pattern.test(raw) || pattern.test(normalized)) {
          const category = this.lookupCategory(def.intent)
          const params = this.extractParameters(def.intent, raw, normalized)
          return {
            intent: def.intent,
            category,
            confidence: 0.95,
            rawText: raw,
            normalizedText: normalized,
            params,
          }
        }
      }
    }

    // 5. Jaccard Token & N-Gram Overlap Fallback
    const tokenMatch = this.matchByTokenOverlap(tokens)
    if (tokenMatch && tokenMatch.score >= 0.52) {
      const params = this.extractParameters(tokenMatch.cmd.intent, raw, normalized)
      return {
        intent: tokenMatch.cmd.intent,
        category: tokenMatch.cmd.category,
        confidence: tokenMatch.score,
        rawText: raw,
        normalizedText: normalized,
        params,
      }
    }

    // 6. Unknown / Low Confidence Query
    return {
      intent: 'UNKNOWN_QUERY',
      category: 'UNKNOWN',
      confidence: 0.2,
      rawText: raw,
      normalizedText: normalized,
      params: {},
    }
  }

  private lookupCategory(intent: string): string {
    const found = COMMAND_CATALOG.find(c => c.intent === intent)
    return found ? found.category : 'UNKNOWN'
  }

  /**
   * Token overlap matching against Command Catalog keywords
   */
  private matchByTokenOverlap(tokens: string[]): { cmd: CommandDefinition; score: number } | null {
    if (!tokens.length) return null
    let bestCmd: CommandDefinition | null = null
    let bestScore = 0

    for (const cmd of COMMAND_CATALOG) {
      for (const keywordPhrase of cmd.keywords) {
        const kwTokens = keywordPhrase.toLowerCase().split(/\s+/).filter(Boolean)
        const inter = tokens.filter(t => kwTokens.includes(t)).length
        const union = new Set([...tokens, ...kwTokens]).size
        const jaccard = union > 0 ? inter / union : 0

        // Boost score if keyword phrase is a clean subset
        const subsetBoost = inter === kwTokens.length ? 0.35 : 0
        const finalScore = jaccard + subsetBoost

        if (finalScore > bestScore) {
          bestScore = finalScore
          bestCmd = cmd
        }
      }
    }

    if (bestCmd && bestScore >= 0.52) {
      return { cmd: bestCmd, score: Math.min(0.92, bestScore) }
    }
    return null
  }

  /**
   * Extract dynamic arguments like place names, route names, or direction
   */
  private extractParameters(intent: string, raw: string, normalized: string): Record<string, any> {
    const params: Record<string, any> = {}

    if (intent === 'navigation.setDestination') {
      const m = raw.match(/(?:navigate\s+to|take\s+me\s+to|find\s+(?:a\s+)?walking\s+route\s+to|walking\s+route\s+to|directions?\s+to|route\s+to)\s+([a-z0-9\s,.-]+)$/i)
      if (m && m[1]) {
        params.destination = m[1].replace(/^(the|a|an)\s+/i, '').trim()
      } else {
        const hindiMatch = raw.match(/([a-z0-9\s,.-]+?)\s*(?:le\s+chalo|chalo|ka\s+rasta|jana\s+hai)$/i)
        if (hindiMatch && hindiMatch[1]) {
          params.destination = hindiMatch[1].replace(/^(the|a|an)\s+/i, '').trim()
        } else {
          const toMatch = raw.match(/\bto\s+([a-z0-9\s,.-]+)$/i)
          if (toMatch && toMatch[1]) {
            params.destination = toMatch[1].replace(/^(the|a|an)\s+/i, '').trim()
          }
        }
      }
    } else     if (intent === 'REMEMBER_ROUTE_START' || intent === 'REMEMBER_ROUTE_STOP') {
      const m = raw.match(/(?:as|called|name)\s+([a-z0-9\s]+)$/i)
      if (m && m[1]) {
        params.routeName = m[1].trim()
      }
    } else if (intent === 'REMEMBER_SAVE_PLACE') {
      const m = raw.match(/(?:as|called|name)\s+([a-z0-9\s]+)$/i)
      if (m && m[1]) {
        params.placeName = m[1].trim()
      }
    } else if (intent === 'REMEMBER_TAG_LANDMARK') {
      const m = raw.match(/(?:landmark|called|name)\s+([a-z0-9\s]+)$/i)
      if (m && m[1]) {
        params.landmarkName = m[1].trim()
      }
    } else if (intent === 'PEOPLE_ADD_CONTACT' || intent === 'PEOPLE_REMOVE_CONTACT') {
      const m = raw.match(/(?:contact|for|name)\s+([a-z0-9\s]+)$/i)
      if (m && m[1]) {
        params.name = m[1].trim()
        params.contactName = m[1].trim()
      }
    }

    return params
  }
}

export const IntentClassifier = new IntentClassifierClass()
