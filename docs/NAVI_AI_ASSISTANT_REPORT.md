# NaviAble AI 2.0 — Navi Voice Assistant Architectural Report

**Date:** 2026-10-31  
**Assistant Name:** **NAVI**  
**Architecture:** Modular Event-Driven Conversational AI Engine (`src/assistant/`)  
**Status:** FULLY OPERATIONAL (Alexa-Style Wake-Word + Trilingual Intent Execution)

---

## 1. Modular Architecture Overview

In accordance with architectural specifications, the conversational assistant is decoupled into 6 reusable modules located in `src/assistant/`:

| Module Path | Responsibility | Key Classes & Functions |
|---|---|---|
| `src/assistant/AssistantState.ts` | Reactive state management, conversation logs, language/volume state, subscriber pub/sub | `AssistantState`, `AssistantStateData`, `AssistantMessage` |
| `src/assistant/VoiceRecognition.ts` | Cross-browser SpeechRecognition wrapper, wake-phrase detection, self-healing reconnect, mobile permission checks | `VoiceRecognition`, `VoiceRecognitionEngine` |
| `src/assistant/IntentClassifier.ts` | Trilingual natural language pattern matching (English, Hindi, Punjabi) across 7 intent domains | `IntentClassifier`, `ParsedIntent`, `INTENT_CATALOG` |
| `src/assistant/VoiceResponse.ts` | Concise, calm, conversational response formatting in English, Hindi, and Punjabi | `VoiceResponse`, `VoiceResponseFormatter` |
| `src/assistant/VoiceCommandRouter.ts` | Central command router executing REAL application functions (Currency inference, camera control, scene narration, speech silence) | `VoiceCommandRouter`, `CommandExecutionResult` |
| `src/assistant/NaviAssistant.ts` | Master facade coordinating wake-word detection, follow-up listening, intent routing, and speech dispatch | `NaviAssistant`, `NaviAssistantController` |

---

## 2. Interaction Experience & Wake-Word Workflow

### Alexa-Like Conversational Flow
1. **Activation:**
   - User enables Navi via opt-in button $\rightarrow$ Navi speaks: *"Voice assistant activated. I'm listening."*
   - Or user taps the large accessible microphone button.
2. **Wake Phrase Detection:**
   - User says: `"Hey Navi"` (or `"हे नवी"`, `"ਹੇ ਨਵੀ"`)
   - Outer glow pulses purple $\rightarrow$ Navi responds: *"Yes, how can I help?"*
3. **Follow-Up Command Execution:**
   - User says: `"Check how much money this is."`
   - Navi captures live camera frame $\rightarrow$ invokes `recognizeBanknote()` ONNX model $\rightarrow$ speaks: *"This is a 500-rupee note."*
4. **Immediate Mute Control:**
   - User says: `"Stop speaking"` or `"Be quiet"` $\rightarrow$ all audio halts immediately.

---

## 3. Command Execution Flow

$$\text{Voice Input} \longrightarrow \text{VoiceRecognition} \longrightarrow \text{IntentClassifier} \longrightarrow \text{VoiceCommandRouter} \longrightarrow \text{Real AI Feature} \longrightarrow \text{Model Result} \longrightarrow \text{Spoken Response}$$

### Real Operation Execution (No Fake Replies)
When the user asks *"Hey Navi, check how much money this is"*:
1. `VoiceCommandRouter` does NOT simply say "opening currency page".
2. It accesses the active `<video>` element from DOM.
3. It passes the video stream to `recognizeBanknote()`.
4. It executes the MobileNetV3 multi-series model.
5. It inspects predicted class, neural confidence, and quality filters.
6. It speaks the verified result (*"This is a 500-rupee note."*).

---

## 4. Mobile Browser Optimization & Technical Constraints

### Browser Limitations & Architectural Solutions
1. **Screen Locked / Background Limitations:**
   - Web browsers (Chrome on Android, Safari on iOS) suspend `getUserMedia` and `SpeechRecognition` when the screen locks or the tab is backgrounded.
   - **Documented Native Roadmap:** For enterprise 24/7 background operation, an Android Native App utilizing a visible Foreground Service (`android.permission.FOREGROUND_SERVICE_MICROPHONE`) with an on-device wake-word model (e.g. Porcupine or openWakeWord) would be required.
2. **Audio Autoplay Restrictions:**
   - Mobile Safari and Chrome block `speechSynthesis` unless unlocked on a direct user gesture.
   - `VoiceManager.unlockVoice()` triggers on the initial tap of the "Enable Navi" button or floating microphone, ensuring audio synthesis is completely unlocked.
3. **Continuous Recognition Auto-Restart:**
   - Mobile browsers occasionally terminate Web Speech API sessions on silence (`no-speech`).
   - `VoiceRecognition` implements self-healing restarts with backoff (capped at 4 consecutive real errors to prevent CPU battery drain).
4. **Accessible Tap-to-Talk Fallback:**
   - For browsers where continuous recognition is unsupported (e.g. Firefox Mobile), an accessible 48px+ push-to-talk button provides 100% feature parity.

---

## 5. Floating Widget (`NaviFloatingAssistant.tsx`)
Available globally across every route:
- Mounted in `App.tsx` for seamless multi-page control.
- Displays live pulse animation, current state badge, and quick command chips.
- Allows immediate switching between English, Hindi, and Punjabi.
