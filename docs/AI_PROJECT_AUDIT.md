# NaviAble AI — Project Audit Report

**Date:** October 31, 2026  
**Auditor:** AI Implementation Engine  
**Project:** NaviAble AI — Beyond Vision. Beyond Limits.  
**Stack:** React 19.3 · TypeScript 7.0 · Vite 8.3 · TailwindCSS 3.4

---

## System Specifications

| Component | Details |
|-----------|---------|
| CPU | AMD Ryzen 7 (8 cores / 16 threads) |
| RAM | 16 GB |
| GPU | NVIDIA GeForce RTX 3050 (4 GB VRAM) |
| OS | Windows |
| Disk Free | ~259 GB |
| Node.js | v24.21.0 |
| npm | v11.19.0 |
| Browser | Chromium-based (WebGPU capable) |

---

## 1. What Already Works ✅

### Object Detection (Real AI)
- **Model:** COCO-SSD with MobileNet v2 (via TensorFlow.js)
- **Classes:** 80 COCO object classes
- **Features:** Real-time inference on camera frames, bounding boxes, confidence scores, position calculation (LEFT/CENTRE/RIGHT), Non-Maximum Suppression (NMS), temporal object tracking with stable IDs
- **File:** `src/services/objectDetection.ts`

### Camera System
- Robust initialization with environment-facing fallback
- Permission handling (granted/denied/prompt)
- Multiple camera support with device switching
- Diagnostics panel with live telemetry
- Proper lifecycle management (no leaking streams)
- **File:** `src/pages/Dashboard.tsx`

### Voice / Speech System
- Text-to-Speech via Web SpeechSynthesis API
- Queue-based speech with pause/resume/repeat
- Speech status tracking (idle/speaking/paused)
- Auto-announcement of new detections with cooldowns
- **File:** `src/services/speechService.ts`

### Context Engine
- Natural language scene descriptions from detections
- Object grouping by class with count and position
- Announcement cooldowns to prevent spam
- **File:** `src/services/contextEngine.ts`

### OCR Reader
- Tesseract.js v7 integration
- Image preprocessing (grayscale, contrast enhancement)
- Multi-language support (English, Hindi, Punjabi)
- Real text extraction from camera captures
- **File:** `src/features/ocr/OCRReader.tsx`

### Voice Assistant
- Speech recognition (Web Speech API)
- Natural language command parsing
- Camera control commands ("start camera", "stop camera")
- Object queries ("what do you see?", "find person")
- System status queries
- **File:** `src/features/voice/VoiceAssistant.tsx`

### Navigation
- Leaflet map with OpenStreetMap tiles (free, no API key)
- Geolocation support
- **File:** `src/features/navigation/Navigation.tsx`
- **Note:** Route planning is a placeholder (`alert('coming soon')`)

### AI Status Dashboard
- Health monitoring for 9 AI services
- Real-time status indicators
- **File:** `src/components/AIStatusDashboard.tsx`

### Event Bus
- Cross-component communication
- Shared detection store for voice assistant
- **File:** `src/services/naviEventBus.ts`

### UI Components (All Working)
- Navbar with mobile menu
- Hero section with animated gradient text
- AIOrb (3D Three.js animated sphere)
- FeatureCard components
- Footer with links
- LoadingScreen with Suspense
- Glass-morphism card design system

### Build System
- `npx tsc -b` passes with 0 errors ✅
- `npm run build` succeeds in ~2.4 seconds ✅
- Code splitting with lazy imports for all pages ✅
- All 7 routes return HTTP 200 ✅

---

## 2. What Is Broken or Incomplete ⚠️

| Feature | Status | Issue |
|---------|--------|-------|
| `src/features/vision/Camera.tsx` | UNUSED | Exists but not imported anywhere. Dashboard has its own camera. |
| `src/features/vision/DetectionOverlay.tsx` | UNUSED | Exists but not imported. Dashboard draws its own overlays. |
| Route planning in Navigation | PLACEHOLDER | `handleSearch` shows `alert('Route planning coming soon')` |
| `models/` directory | EMPTY | Only contains `README.md`, no actual model files |
| PWA support | MISSING | No manifest, no service worker, no installability |
| Mobile responsiveness | PARTIAL | Desktop-first design, no mobile-specific optimizations |
| Proximity alerts | MISSING | Not implemented |
| Currency recognition | MISSING | Not implemented |
| Pothole detection | MISSING | Not implemented |
| Multi-language voice | PARTIAL | TTS language parameter exists but no Hindi/Punjabi voice commands |
| `@types/leaflet` | MISSING | No type declarations for Leaflet (may cause warnings) |
| `@types/three` | MISSING | No type declarations for Three.js |

---

## 3. Available Real AI Models

| Model | Source | Status | Runs In-Browser |
|-------|--------|--------|-----------------|
| COCO-SSD (MobileNet v2) | `@tensorflow-models/coco-ssd` | ✅ Working | Yes (TF.js) |
| Tesseract.js v7 | `tesseract.js` npm | ✅ Working | Yes (WASM) |
| Web SpeechRecognition | Browser API | ✅ Working | Yes (native) |
| Web SpeechSynthesis | Browser API | ✅ Working | Yes (native) |

---

## 4. Models Needing Training 🔧

| Model | Purpose | Dataset | Training Environment | Status |
|-------|---------|---------|---------------------|--------|
| Currency Classifier | Indian note denomination | Indian Currency Dataset (~1,786 images) | Google Colab (GPU) | PENDING |
| Road Hazard Detector | Pothole/crack detection | RDD2022 | Google Colab (GPU) | PENDING |

**Why can't these be trained here?**
- Training requires a Python GPU environment
- The agent sandbox runs in Node.js/browser context
- The user should use Google Colab (free GPU) with the provided training notebooks
- Training scripts and notebooks will be provided in `ml/` directory

---

## 5. Recommended Architecture

### Current (Working):
```
Browser
├── TensorFlow.js → COCO-SSD (object detection)
├── Tesseract.js WASM → OCR
├── Web Speech API → Voice I/O
└── Leaflet → Maps
```

### Upgraded (Target):
```
Browser
├── TensorFlow.js → COCO-SSD (object detection)   ← KEEP
├── ONNX Runtime Web → Currency model (when trained)
├── ONNX Runtime Web → Pothole model (when trained)
├── Tesseract.js WASM → OCR                        ← KEEP
├── Web Audio API → Proximity beep alerts           ← NEW
├── Web Bluetooth API → ESP32 ToF sensor (optional) ← NEW
├── Web Speech API → Voice I/O                      ← KEEP
├── Vibration API → Haptic alerts                   ← NEW
├── Leaflet → Maps                                  ← KEEP
└── Service Worker → PWA offline support            ← NEW
```

### Why Keep COCO-SSD Instead of Upgrading to YOLO/ONNX?
1. COCO-SSD already works reliably in-browser with 80 classes
2. It's proven, well-tested, and the user has a working detection pipeline
3. Switching to YOLO/ONNX would require: downloading a 30MB+ model, ONNX Runtime Web setup, custom preprocessing/postprocessing, significant testing
4. The improvement in accuracy would be marginal for the assistive use case
5. **Decision:** Keep COCO-SSD for object detection. Use ONNX Runtime Web only for the new specialized models (currency, pothole) when they're trained.

---

## 6. Dependencies to Add

| Package | Purpose | Size |
|---------|---------|------|
| `onnxruntime-web` | Run currency/pothole ONNX models | ~5 MB |
| `@types/leaflet` | TypeScript types for Leaflet | dev |
| `sharp` (dev) | Generate PWA icons from SVG | dev |

---

## 7. Implementation Plan

### Phase 1: Proximity Alerts ← IN PROGRESS
- `src/services/proximityEngine.ts` — Web Audio API beeps, vibration, BLE sensor
- `src/pages/ProximityPage.tsx` — Alert controls and visualization

### Phase 2: Currency Recognition ← IN PROGRESS
- `src/services/currencyDetection.ts` — Model loading (PENDING training)
- `src/pages/CurrencyPage.tsx` — Scanner UI with training instructions
- `ml/currency_recognition/` — Training pipeline

### Phase 3: Pothole Detection ← IN PROGRESS
- `src/services/potholeDetection.ts` — Model loading (PENDING training)
- `src/pages/PotholePage.tsx` — Road hazard UI with training instructions
- `ml/pothole_detection/` — Training pipeline

### Phase 4: PWA ← IN PROGRESS
- `public/manifest.webmanifest`
- `public/sw.js` — Service worker
- `public/icons/` — PWA icons
- Mobile meta tags in `index.html`
- `dev:lan` npm script

### Phase 5: Integration
- Add new routes to `App.tsx`
- Add new nav links to `Navbar.tsx`
- Update voice assistant commands
- Update model manager

### Phase 6: Documentation
- `docs/SAFETY_AND_ACCESSIBILITY.md`
- `docs/MODEL_TRAINING_REPORT.md`
- `docs/MOBILE_SETUP.md`
- `docs/FINAL_TEST_REPORT.md`
- Update `docs/THIRD_PARTY_NOTICES.md`

### Phase 7: Testing & Deployment
- TypeScript compilation check
- Build verification
- Route testing
- Git commit and push

---

## 8. Files to Preserve (Do Not Modify Unless Required)

- `src/components/AIOrb.tsx` — 3D animated sphere
- `src/components/Hero.tsx` — Landing page hero
- `src/components/FeatureCard.tsx` — Feature cards
- `src/components/Footer.tsx` — Footer
- `src/components/LoadingScreen.tsx` — Loading screen
- `src/pages/Home.tsx` — Home page
- `src/pages/About.tsx` — About page
- `src/features/voice/VoiceAssistant.tsx` — Voice assistant (will add commands)
- `src/features/ocr/OCRReader.tsx` — OCR reader
- `src/index.css` — Global styles
- `tailwind.config.js` — Tailwind configuration

