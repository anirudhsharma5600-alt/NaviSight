/**
 * NaviAble AI 3.0 — Voice Language Manager
 * 
 * Manages trilingual recognition (English, Hindi, Hinglish, Punjabi):
 * - SpeechRecognition language code mapping
 * - Script identification (Latin, Devanagari, Gurmukhi)
 * - Hinglish phonetic transliteration dictionary
 * - Filler word stripping & text normalisation
 */

import { VoiceStateManager, type AssistantLanguage } from './VoiceStateManager'

export class VoiceLanguageManagerClass {
  // Common conversational filler phrases in English, Hindi, and Hinglish
  private readonly FILLER_WORDS = [
    /\b(hey|hay|hi|hello|ok|okay)\s*(navi|navvy|navy|navie)?\b/gi,
    /\b(navi|नवी|ਨਵੀ)\b/gi,
    /\b(please|can you|could you|would you|i want to|tell me|i need to)\b/gi,
    /\b(kripya|kripaya|zara|bhai|yaar|batao|bataiye|mujhe|humko|sun|suno)\b/gi,
    /\b(कृपया|ज़रा|भाई|बताओ|बताइए|मुझे|सुनो)\b/gi,
    /\b(ਮੈਨੂੰ|ਦੱਸੋ|ਕਿਰਪਾ|ਸੁਣੋ)\b/gi,
  ]

  // Hinglish to standard semantic intent token dictionary
  private readonly HINGLISH_SYNONYMS: Record<string, string> = {
    // Camera
    'chalu': 'start',
    'khol': 'start',
    'kholo': 'start',
    'shuru': 'start',
    'band': 'stop',
    'roko': 'stop',
    'piche': 'rear',
    'pichhla': 'rear',
    'aage': 'front',
    // Currency
    'paise': 'money',
    'paisa': 'money',
    'rupaye': 'rupees',
    'rupaya': 'rupees',
    'note': 'note',
    'kitna': 'how much',
    'kitne': 'how much',
    // Scene / Obstacles
    'samne': 'in front',
    'saamne': 'in front',
    'aaspaas': 'around',
    'sadak': 'road',
    'rasta': 'route',
    'khadda': 'pothole',
    'gaddha': 'pothole',
    'gaddhe': 'potholes',
    'ruk': 'stop',
    'shant': 'quiet',
    'chup': 'quiet',
    // Remember / Memory
    'yaad': 'remember',
    'rakho': 'save',
    'bachao': 'save',
    'jaga': 'place',
    'jagah': 'place',
    'dost': 'friend',
  }

  /**
   * Get Web Speech API BCP-47 language tag for current configuration
   */
  public getRecognitionLangCode(preferredLang?: AssistantLanguage): string {
    const lang = preferredLang || VoiceStateManager.getLanguage()
    switch (lang) {
      case 'hi':
        return 'hi-IN'
      case 'pa':
        return 'pa-IN'
      case 'en':
      default:
        // 'en-IN' is superior on mobile devices in India for Indian English and Hinglish recognition
        return 'en-IN'
    }
  }

  /**
   * Detect underlying script of the utterance
   */
  public detectScript(text: string): 'devanagari' | 'gurmukhi' | 'latin' {
    if (/[\u0900-\u097F]/.test(text)) return 'devanagari'
    if (/[\u0A00-\u0A7F]/.test(text)) return 'gurmukhi'
    return 'latin'
  }

  /**
   * Normalize spoken text:
   * 1. Lowercase & strip punctuation
   * 2. Strip conversational filler words ("Hey Navi", "please", "can you")
   * 3. Normalize Hinglish transliterations
   * 4. Collapse extra whitespace
   */
  public normalize(rawText: string): { normalized: string; tokens: string[] } {
    if (!rawText || !rawText.trim()) {
      return { normalized: '', tokens: [] }
    }

    let cleaned = rawText.toLowerCase()

    // Remove punctuation except apostrophes
    cleaned = cleaned.replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, ' ')

    // Strip filler words
    for (const pattern of this.FILLER_WORDS) {
      cleaned = cleaned.replace(pattern, ' ')
    }

    // Tokenize
    const rawTokens = cleaned.trim().split(/\s+/).filter(Boolean)

    // Substitute Hinglish synonyms
    const normalizedTokens = rawTokens.map(t => this.HINGLISH_SYNONYMS[t] || t)

    const normalized = normalizedTokens.join(' ').trim()
    return { normalized, tokens: normalizedTokens }
  }

  /**
   * Format spoken response in currently active language
   */
  public localizeResponse(responses: { en: string; hi?: string; pa?: string }): string {
    const lang = VoiceStateManager.getLanguage()
    if (lang === 'hi' && responses.hi) return responses.hi
    if (lang === 'pa' && responses.pa) return responses.pa
    return responses.en
  }
}

export const VoiceLanguageManager = new VoiceLanguageManagerClass()
