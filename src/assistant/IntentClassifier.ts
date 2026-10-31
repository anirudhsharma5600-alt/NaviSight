/**
 * NaviAble AI 2.0 — Natural Voice Intent Classifier
 *
 * Implements intent classification supporting English, Hindi, and Punjabi:
 * - Robust regex & semantic pattern matching
 * - Tolerance for phonetic variations and colloquial speech
 * - Structured intent categorization matching user specifications
 */

export type IntentCategory =
  | 'CAMERA'
  | 'SCENE'
  | 'CURRENCY'
  | 'CURRENCY_CONTROL'
  | 'ROAD_HAZARD'
  | 'OCR'
  | 'ASSISTANT_CONTROL'
  | 'UNKNOWN'

export interface ParsedIntent {
  intent: string
  category: IntentCategory
  confidence: number
  rawQuery: string
  params?: Record<string, any>
}

interface IntentPattern {
  intent: string
  category: IntentCategory
  patterns: RegExp[]
}

const INTENT_CATALOG: IntentPattern[] = [
  // ─── 1. Camera Commands ───
  {
    intent: 'CAMERA_START',
    category: 'CAMERA',
    patterns: [
      /\b(open|start|turn on|activate|enable)\s*(the\s*)?(camera|video|feed)\b/i,
      /\b(camera|कैमरा|ਕੈਮਰਾ)\s*(chalu|on|start|khol|kholo|shuru)\b/i,
      /\b(कैमरा\s*चालू|कैमरा\s*शुरू|ਕੈਮਰਾ\s*ਚਾਲੂ)\b/i,
    ],
  },
  {
    intent: 'CAMERA_STOP',
    category: 'CAMERA',
    patterns: [
      /\b(stop|close|turn off|disable|shut)\s*(the\s*)?(camera|video|feed)\b/i,
      /\b(camera|कैमरा|ਕੈਮਰਾ)\s*(band|off|stop|roko)\b/i,
      /\b(कैमरा\s*बंद|ਕੈਮਰਾ\s*ਬੰਦ)\b/i,
    ],
  },
  {
    intent: 'CAMERA_SWITCH_REAR',
    category: 'CAMERA',
    patterns: [
      /\b(switch|flip|change|use)\s*(to\s*)?(the\s*)?(rear|back|environment)\s*(camera)?\b/i,
      /\b(rear|back)\s*camera\b/i,
      /\b(पीछे का कैमरा|पिछला कैमरा|ਪਿਛਲਾ ਕੈਮਰਾ)\b/i,
    ],
  },
  {
    intent: 'CAMERA_RESTART',
    category: 'CAMERA',
    patterns: [
      /\b(restart|refresh|reload|reset)\s*(the\s*)?(camera)\b/i,
      /\b(कैमरा\s*रीस्टार्ट)\b/i,
    ],
  },

  // ─── 2. Scene Understanding Commands ───
  {
    intent: 'SCENE_DESCRIBE',
    category: 'SCENE',
    patterns: [
      /\b(describe|what('s| is)|tell me what is)\s*(my\s*)?(surroundings?|environment|around me|in front of me|scene)\b/i,
      /\b(what do you see|what can you see|what's ahead|what is ahead)\b/i,
      /\b(kya dikh raha hai|samne kya hai|aas paas kya hai|kya hai)\b/i,
      /\b(सामने क्या है|आस-पास क्या है|क्या दिख रहा है|ਮੇਰੇ ਸਾਹਮਣੇ ਕੀ ਹੈ)\b/i,
    ],
  },
  {
    intent: 'SCENE_OBJECTS_NEARBY',
    category: 'SCENE',
    patterns: [
      /\b(what\s*(are\s*)?objects|list\s*objects|any\s*objects)\s*(around|near|visible)?\b/i,
      /\b(konsi chiz hai|kya chizen hain|chizen batao)\b/i,
      /\b(ਕਿਹੜੀਆਂ ਚੀਜ਼ਾਂ ਹਨ|ਕਿਹੜੀਆਂ ਵਸਤੂਆਂ ਹਨ)\b/i,
    ],
  },
  {
    intent: 'SCENE_ROAD_CHECK',
    category: 'SCENE',
    patterns: [
      /\b(tell me what('s| is) on the road|what is on the road|check road|road condition)\b/i,
      /\b(sadak par kya hai|rasta kaisa hai|road par kya hai)\b/i,
      /\b(सड़क पर क्या है|रास्ता कैसा है|ਸੜਕ 'ਤੇ ਕੀ ਹੈ)\b/i,
    ],
  },
  {
    intent: 'SCENE_VEHICLE_CHECK',
    category: 'SCENE',
    patterns: [
      /\b(is there a vehicle|any car|any bike|any vehicle nearby|traffic nearby)\b/i,
      /\b(koi gaadi hai|kya koi car hai|kya koi vehicle hai)\b/i,
      /\b(ਕੀ ਕੋਈ ਗੱਡੀ ਹੈ|ਕੀ ਕੋਈ ਵਾਹਨ ਹੈ)\b/i,
    ],
  },
  {
    intent: 'SCENE_SIGNBOARD',
    category: 'SCENE',
    patterns: [
      /\b(read\s*(the\s*)?(signboard|sign\s*board|traffic\s*sign|board))\b/i,
      /\b(board padho|signboard padho|साइनबोर्ड पढ़ो)\b/i,
    ],
  },

  // ─── 3. Currency Commands (High Importance) ───
  {
    intent: 'CURRENCY_SCAN',
    category: 'CURRENCY',
    patterns: [
      /\b(check\s*(how\s*much\s*)?(money|cash)|read\s*(this\s*)?note|how\s*many\s*rupees|scan\s*currency)\b/i,
      /\b(identify\s*(the\s*)?note|what\s*note\s*is\s*this|kitne\s*rupaye|paise\s*padho|note\s*padho)\b/i,
      /\b(note check karo|paise kitne hain|rupaye kitne hain|kitna note hai)\b/i,
      /\b(पैसे कितने हैं|नोट पढ़ो|कितने रुपये हैं|करेंसी स्कैन करो)\b/i,
      /\b(ਕਿੰਨੇ ਰੁਪਏ ਹਨ|ਨੋਟ ਪੜ੍ਹੋ|ਕਰੰਸੀ ਸਕੈਨ ਕਰੋ)\b/i,
    ],
  },

  // ─── 4. Currency Reader Commands ───
  {
    intent: 'CURRENCY_REPEAT',
    category: 'CURRENCY_CONTROL',
    patterns: [
      /\b(repeat\s*(the\s*)?amount|say\s*(the\s*)?amount\s*again|kitna\s*tha\s*dobara\s*bolo)\b/i,
      /\b(दोबारा बताओ|ਰਕਮ ਦੁਬਾਰਾ ਦੱਸੋ)\b/i,
    ],
  },
  {
    intent: 'CURRENCY_SCAN_ANOTHER',
    category: 'CURRENCY_CONTROL',
    patterns: [
      /\b(scan\s*another\s*note|rescan\s*note|next\s*note|dusra\s*note)\b/i,
      /\b(दूसरा नोट|ਦੂਜਾ ਨੋਟ ਸਕੈਨ ਕਰੋ)\b/i,
    ],
  },
  {
    intent: 'CURRENCY_STOP',
    category: 'CURRENCY_CONTROL',
    patterns: [
      /\b(stop\s*currency(\s*scanning)?|close\s*currency|currency\s*band\s*karo)\b/i,
      /\b(करेंसी बंद करो)\b/i,
    ],
  },
  {
    intent: 'CURRENCY_LANG_HINDI',
    category: 'CURRENCY_CONTROL',
    patterns: [
      /\b(read\s*(the\s*)?currency\s*in\s*hindi|hindi\s*mein\s*bolo|हिंदी\s*में\s*बताओ)\b/i,
    ],
  },

  // ─── 5. Road Hazard & Proximity Commands ───
  {
    intent: 'ROAD_HAZARDS_ENABLE',
    category: 'ROAD_HAZARD',
    patterns: [
      /\b(enable|start|turn on)\s*(road\s*detection|road\s*hazard|hazard\s*alerts)\b/i,
      /\b(road hazard chalu karo|pothole chalu karo)\b/i,
    ],
  },
  {
    intent: 'ROAD_HAZARDS_DETECT_POTHOLES',
    category: 'ROAD_HAZARD',
    patterns: [
      /\b(detect|find|look for|scan for)\s*(potholes?|cracks?|road\s*damage)\b/i,
      /\b(gaddhe dekho|gadda check karo|गड्ढे देखो|ਖੱਡੇ ਦੇਖੋ)\b/i,
    ],
  },
  {
    intent: 'ROAD_HAZARDS_DESCRIBE',
    category: 'ROAD_HAZARD',
    patterns: [
      /\b(describe\s*road\s*conditions?|how\s*is\s*the\s*road|check\s*road\s*surface)\b/i,
      /\b(सड़क की स्थिति बताओ|ਸੜਕ ਦੀ ਹਾਲਤ ਦੱਸੋ)\b/i,
    ],
  },
  {
    intent: 'ROAD_HAZARDS_STOP',
    category: 'ROAD_HAZARD',
    patterns: [
      /\b(stop\s*(road\s*detection|pothole\s*detection))\b/i,
    ],
  },
  {
    intent: 'PROXIMITY_ENABLE_ALERTS',
    category: 'ROAD_HAZARD',
    patterns: [
      /\b(enable\s*proximity\s*alerts?|proximity\s*on|turn\s*on\s*proximity)\b/i,
      /\b(warning alerts chalu|चेतावनी चालू करो)\b/i,
    ],
  },
  {
    intent: 'PROXIMITY_ENABLE_SOUND',
    category: 'ROAD_HAZARD',
    patterns: [
      /\b(enable\s*sound\s*alerts?|turn\s*on\s*sound|sound\s*alerts?)\b/i,
    ],
  },

  // ─── 6. OCR Commands ───
  {
    intent: 'OCR_READ_TEXT',
    category: 'OCR',
    patterns: [
      /\b(read\s*(this\s*)?(text|writing|words)|read\s*page)\b/i,
      /\b(yeh padho|text padho|लिखा हुआ पढ़ो|ਲਿਖਤ ਪੜ੍ਹੋ)\b/i,
    ],
  },
  {
    intent: 'OCR_READ_BOARD',
    category: 'OCR',
    patterns: [
      /\b(read\s*(the\s*)?(board|sign|banner))\b/i,
      /\b(बोर्ड पढ़ो|ਬੋਰਡ ਪੜ੍ਹੋ)\b/i,
    ],
  },
  {
    intent: 'OCR_READ_DOCUMENT',
    category: 'OCR',
    patterns: [
      /\b(read\s*(this\s*)?(document|letter|paper))\b/i,
      /\b(दस्तावेज़ पढ़ो|ਦਸਤਾਵੇਜ਼ ਪੜ੍ਹੋ)\b/i,
    ],
  },
  {
    intent: 'OCR_READ_LABEL',
    category: 'OCR',
    patterns: [
      /\b(read\s*(the\s*)?(label|product\s*name|tag))\b/i,
      /\b(लेबल पढ़ो|ਲੇਬਲ ਪੜ੍ਹੋ)\b/i,
    ],
  },

  // ─── 7. Assistant Control Commands ───
  {
    intent: 'ASSISTANT_SPEAK_SLOWER',
    category: 'ASSISTANT_CONTROL',
    patterns: [
      /\b(speak\s*slower|slow\s*down|dhire\s*bolo|dhime\s*bolo|ਹੌਲੀ\s*ਬੋਲੋ|धीरे\s*बोलो)\b/i,
    ],
  },
  {
    intent: 'ASSISTANT_SPEAK_LOUDER',
    category: 'ASSISTANT_CONTROL',
    patterns: [
      /\b(speak\s*louder|increase\s*volume|awaz\s*badhao|ऊंची\s*आवाज़|ਉੱਚੀ\s*ਆਵਾਜ਼)\b/i,
    ],
  },
  {
    intent: 'ASSISTANT_LANG_HINDI',
    category: 'ASSISTANT_CONTROL',
    patterns: [
      /\b(change\s*language\s*to\s*hindi|speak\s*in\s*hindi|hindi\s*language|हिंदी\s*में\s*बात\s*करो)\b/i,
    ],
  },
  {
    intent: 'ASSISTANT_LANG_PUNJABI',
    category: 'ASSISTANT_CONTROL',
    patterns: [
      /\b(change\s*language\s*to\s*punjabi|speak\s*in\s*punjabi|punjabi\s*language|ਪੰਜਾਬੀ\s*ਵਿੱਚ\s*ਗੱਲ\s*ਕਰੋ)\b/i,
    ],
  },
  {
    intent: 'ASSISTANT_LANG_ENGLISH',
    category: 'ASSISTANT_CONTROL',
    patterns: [
      /\b(change\s*language\s*to\s*english|speak\s*in\s*english|english\s*language)\b/i,
    ],
  },
  {
    intent: 'ASSISTANT_STOP_SPEAKING',
    category: 'ASSISTANT_CONTROL',
    patterns: [
      /\b(stop\s*speaking|be\s*quiet|shut\s*up|silence|stop\s*talking|shant\s*raho|chup\s*raho|bolna\s*band\s*karo)\b/i,
      /\b(चुप रहो|शांत रहो|ਬੰਦ ਕਰੋ|ਚੁੱਪ ਰਹੋ)\b/i,
    ],
  },
  {
    intent: 'ASSISTANT_REPEAT',
    category: 'ASSISTANT_CONTROL',
    patterns: [
      /\b(repeat|say\s*again|what\s*did\s*you\s*say|phir\s*se\s*bolo|dobara\s*bolo)\b/i,
      /\b(दोबारा बोलो|ਫਿਰ ਤੋਂ ਬੋਲੋ)\b/i,
    ],
  },
  {
    intent: 'ASSISTANT_HELP',
    category: 'ASSISTANT_CONTROL',
    patterns: [
      /\b(help|what\s*can\s*you\s*do|madad|मदद|ਸਹਾਇਤਾ)\b/i,
    ],
  },
  {
    intent: 'ASSISTANT_DISABLE',
    category: 'ASSISTANT_CONTROL',
    patterns: [
      /\b(disable\s*voice\s*assistant|turn\s*off\s*navi|stop\s*listening)\b/i,
    ],
  },
  {
    intent: 'ASSISTANT_ENABLE',
    category: 'ASSISTANT_CONTROL',
    patterns: [
      /\b(enable\s*voice\s*assistant|start\s*navi|listen\s*to\s*me)\b/i,
    ],
  },
]

export class IntentClassifierEngine {
  public classify(text: string): ParsedIntent {
    const query = text.trim()
    if (!query) {
      return {
        intent: 'EMPTY',
        category: 'UNKNOWN',
        confidence: 0,
        rawQuery: query,
      }
    }

    for (const item of INTENT_CATALOG) {
      for (const pattern of item.patterns) {
        if (pattern.test(query)) {
          return {
            intent: item.intent,
            category: item.category,
            confidence: 0.95,
            rawQuery: query,
          }
        }
      }
    }

    // Default fallback
    return {
      intent: 'UNKNOWN_QUERY',
      category: 'UNKNOWN',
      confidence: 0.2,
      rawQuery: query,
    }
  }
}

export const IntentClassifier = new IntentClassifierEngine()
