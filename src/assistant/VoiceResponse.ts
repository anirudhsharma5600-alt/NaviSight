/**
 * NaviAble AI 2.0 — Voice Response Formatter
 *
 * Provides natural, calm, concise phrasing in English, Hindi, and Punjabi:
 * - Alexa-like interactive responses
 * - Avoids robotic filler or verbose essays
 * - Short sentences easily comprehended through text-to-speech
 */

import { type AssistantLanguage } from './AssistantState'

export class VoiceResponseFormatter {
  public getWakeResponse(lang: AssistantLanguage = 'en'): string {
    if (lang === 'hi') {
      return 'हाँ, मैं आपकी क्या मदद करूँ?'
    }
    if (lang === 'pa') {
      return 'ਹਾਂ, ਮੈਂ ਤੁਹਾਡੀ ਕੀ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?'
    }
    return 'Yes, how can I help?'
  }

  public getGreeting(lang: AssistantLanguage = 'en'): string {
    if (lang === 'hi') {
      return 'नमस्ते! मैं नवी हूँ। मैं आपकी सहायता के लिए तैयार हूँ।'
    }
    if (lang === 'pa') {
      return 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਨਵੀ ਹਾਂ। ਮੈਂ ਤੁਹਾਡੀ ਮਦਦ ਲਈ ਤਿਆਰ ਹਾਂ।'
    }
    return 'Hello! I am Navi, your accessibility assistant. How can I help you?'
  }

  public getHelp(lang: AssistantLanguage = 'en'): string {
    if (lang === 'hi') {
      return "आप कह सकते हैं: 'सामने क्या है', 'पैसे चेक करो', 'कैमरा चालू करो', या 'सड़क की स्थिति बताओ'।"
    }
    if (lang === 'pa') {
      return "ਤੁਸੀਂ ਕਹਿ ਸਕਦੇ ਹੋ: 'ਮੇਰੇ ਸਾਹਮਣੇ ਕੀ ਹੈ', 'ਪੈਸੇ ਚੈੱਕ ਕਰੋ', 'ਕੈਮਰਾ ਚਾਲੂ ਕਰੋ', ਜਾਂ 'ਸੜਕ ਦੀ ਹਾਲਤ ਦੱਸੋ'।"
    }
    return "You can say: 'Describe my surroundings', 'Check how much money this is', 'Start camera', or 'Detect potholes'."
  }

  public getCurrencyHoldPrompt(lang: AssistantLanguage = 'en'): string {
    if (lang === 'hi') {
      return 'कृपया नोट को कैमरे के सामने सीधा रखें।'
    }
    if (lang === 'pa') {
      return 'ਕਿਰਪਾ ਕਰਕੇ ਨੋਟ ਨੂੰ ਕੈਮਰੇ ਦੇ ਸਾਹਮਣੇ ਰੱਖੋ।'
    }
    return 'Please hold the note in front of the camera.'
  }

  public getCurrencyResult(amount: number, displayName: string, lang: AssistantLanguage = 'en'): string {
    if (lang === 'hi') {
      return `यह ${amount} रुपये का नोट प्रतीत होता है।`
    }
    if (lang === 'pa') {
      return `ਇਹ ${amount} ਰੁਪਏ ਦਾ ਨੋਟ ਜਾਪਦਾ ਹੈ।`
    }
    return `This appears to be a ${amount}-rupee note.`
  }

  public getCurrencyUncertain(lang: AssistantLanguage = 'en'): string {
    if (lang === 'hi') {
      return 'क्षमा करें, मैं इस नोट को स्पष्ट रूप से नहीं पहचान सका। कृपया पुनः प्रयास करें।'
    }
    if (lang === 'pa') {
      return 'ਮਾਫ਼ ਕਰਨਾ, ਮੈਂ ਇਸ ਨੋਟ ਨੂੰ ਸਪਸ਼ਟ ਨਹੀਂ ਪਛਾਣ ਸਕਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।'
    }
    return 'I cannot recognise this note clearly. Please try again.'
  }

  public getCameraStarted(lang: AssistantLanguage = 'en'): string {
    if (lang === 'hi') return 'कैमरा चालू कर दिया गया है।'
    if (lang === 'pa') return 'ਕੈਮਰਾ ਚਾਲੂ ਕਰ ਦਿੱਤਾ ਗਿਆ ਹੈ।'
    return 'Camera started.'
  }

  public getCameraStopped(lang: AssistantLanguage = 'en'): string {
    if (lang === 'hi') return 'कैमरा बंद कर दिया गया है।'
    if (lang === 'pa') return 'ਕੈਮਰਾ ਬੰਦ ਕਰ ਦਿੱਤਾ ਗਿਆ ਹੈ।'
    return 'Camera stopped.'
  }

  public getCameraSwitched(lang: AssistantLanguage = 'en'): string {
    if (lang === 'hi') return 'पिछले कैमरे पर स्विच कर दिया गया है।'
    if (lang === 'pa') return "ਪਿਛਲੇ ਕੈਮਰੇ 'ਤੇ ਸਵਿੱਚ ਕਰ ਦਿੱਤਾ ਗਿਆ ਹੈ।"
    return 'Switched to rear camera.'
  }

  public getUnknown(lang: AssistantLanguage = 'en'): string {
    if (lang === 'hi') {
      return 'क्षमा करें, मैं समझ नहीं सका। कृपया दोबारा बोलें या सहायता कहें।'
    }
    if (lang === 'pa') {
      return 'ਮਾਫ਼ ਕਰਨਾ, ਮੈਂ ਸਮਝ ਨਹੀਂ ਸਕਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਬੋਲੋ।'
    }
    return "I'm not sure how to help with that. Say 'help' to hear available commands."
  }
}

export const VoiceResponse = new VoiceResponseFormatter()
