# NaviAble AI — Gemini Live-Style Multimodal Real-Time Companion Integration

**Module:** Live Multimodal Conversational Companion  
**Date:** November 1, 2026  
**Implementation Files:** `src/assistant/NaviLiveSession.ts`, `src/assistant/NaviFunctionRegistry.ts`, `src/assistant/NaviToolRouter.ts`  

---

## 1. System Architecture

The Gemini Live multimodal companion turns Navi into a continuous conversational partner that can simultaneously **see** what the camera sees, **listen** to the user's voice, and **take action** by executing real application tools.

```mermaid
flowchart LR
    subgraph Client ["Client Device (Browser / Mobile)"]
        Cam["Camera Feed (video)"] -->|1 FPS Sample| Sampler["Frame Sampler (512px JPEG)"]
        Mic["Microphone"] -->|Voice Transcript| Assistant["NaviLiveSession"]
        Speaker["VoiceManager (Speech Synth)"]
        Router["NaviToolRouter"]
    end
    
    subgraph Cloud ["Google Gemini Multimodal API"]
        Model["Gemini 1.5 / 2.0 Flash"]
    end

    Sampler -->|inlineData (image/jpeg)| Model
    Assistant -->|User Speech + System Instruction| Model
    Model -->|Function Call (startRoute, scanCurrency, etc.)| Router
    Router -->|Execute Real App Feature| Router
    Router -->|Tool Result Text| Speaker
    Model -->|Conversational Spoken Reply| Speaker
    Assistant -->|User Interrupts Voice| Speaker
```

---

## 2. Key Architectural Features

### A. Real-Time Vision Streaming (~1 FPS)
Instead of hammering the network or mobile battery with 30 FPS video uploads, `NaviLiveSession` dynamically samples frames at **1 FPS** (or on-demand during active queries):
- Canvas captures active video feed and scales down to $512\text{px}$ width (preserving aspect ratio).
- Encoded as lightweight JPEG ($65\%$ quality, $\sim 28\text{ KB}$ per frame).
- Transmitted as multimodal `inlineData` parts directly to the Gemini API.

### B. Function & Tool Calling Dispatch (`NaviFunctionRegistry.ts`)
The model is equipped with standard Gemini function declarations matching real operations:

| Tool Name | Parameters | Real Execution |
|---|---|---|
| `startRouteRecording` | `routeName`, `startLocation` | Starts GPS breadcrumb recording via `RouteTrackingService` |
| `stopAndSaveRoute` | `routeName`, `endLocation` | Stops recording, computes distance, and saves to IndexedDB |
| `addRouteLandmark` | `landmarkName`, `voiceNote` | Tags current GPS coordinate with landmark name and memo |
| `recallRoute` | `routeName` | Queries saved route and speaks duration, landmarks, and safety notice |
| `getSavedRoutes` | None | Returns list of all routes in personal memory |
| `savePlace` | `placeName`, `description` | Saves current GPS coordinates as a named place |
| `getSavedPlaces` | None | Retrieves all saved places |
| `saveVisualMemory` | `memoryName`, `description` | Extracts scene object vector and chromatic fingerprint |
| `checkSceneResemblance`| None | Compares live frame against saved visual memories |
| `scanCurrency` | None | Executes two-stage banknote detection on current camera frame |
| `describeScene` | None | Generates spatial description of road vehicles and obstacles |
| `saveContact` | `name`, `nickname`, `relationship`| Saves contact profile in People Memory (zero biometrics) |
| `searchMemories` | `query` | Cross-domain fuzzy search across routes, places, people, visual |

### C. Instant Voice Interruption Handling
Visually impaired users need immediate control over speech output. If Navi is describing a long route and the user speaks (*"Stop"*, *"Hey Navi"*, or asks a question), `NaviLiveSession.interruptSpeech()` triggers:
1. `VoiceManager.stopAllSpeech()` immediately cancels the current utterance.
2. `window.speechSynthesis.cancel()` halts browser audio output within $<50\text{ms}$.
3. Assistant switches instantly to listening state.

---

## 3. Ephemeral Token & API Security Architecture

> [!SECURITY]
> **Strict Key Management:**
> - Gemini API keys are **NEVER** hardcoded in client source code or committed to git repositories.
> - Users can supply their personal Gemini API key via the Remember dashboard setup dialog (`localStorage.setItem('naviable_gemini_api_key')`).
> - Keys remain strictly in local browser storage and are never uploaded to intermediate third-party servers.

---

## 4. 100% On-Device Graceful Offline Fallback

If the user does not have a Gemini API key or is walking through an area with no internet connection (airplane mode, subway, rural roads), `NaviLiveSession` automatically degrades to **On-Device Local Companion Mode**:
- `fallbackLocalProcessing()` uses the local regex-based `IntentClassifier` and on-device `NaviToolRouter`.
- Object detection runs on TensorFlow.js (COCO-SSD).
- Currency recognition runs on onnxruntime-web MobileNetV3.
- GPS and route tracking run directly on device hardware.
- The user is never blocked or left without assistive capabilities due to lack of cloud connectivity.
