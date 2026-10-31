# NaviAble AI — AI Implementation Report

**Date:** 2026-10-31
**Auditor:** AI Engine

---

## System Hardware

| Component | Details |
|-----------|---------|
| OS | Windows 11 Home, Build 26300 |
| CPU | AMD Ryzen 7 170, 8 cores / 16 threads |
| RAM | 15.7 GB total (~1.9 GB free at audit time) |
| GPU 1 | AMD Radeon (integrated) — 512 MB |
| GPU 2 | **NVIDIA GeForce RTX 3050 Laptop** — 4 GB VRAM |
| Disk | 260 GB free of 447 GB |
| Browser target | Chrome / Edge (WebGPU capable) |

**Assessment:** RTX 3050 + 16GB RAM = excellent for browser AI. WebGPU acceleration available. ONNX Runtime Web with WebGPU backend is viable.

---

## Existing Project Architecture

| Item | Value |
|------|-------|
| Framework | React 19 + TypeScript 7 + Vite 8 |
| Styling | Tailwind CSS 3 |
| 3D | Three.js + React Three Fiber + Drei |
| Animation | Framer Motion |
| Routing | React Router DOM 6 |
| Maps | Leaflet + React-Leaflet + OpenStreetMap |

---

## Existing AI Features — Audit

### 1. Object Detection (`src/services/objectDetection.ts`)
- **Model:** COCO-SSD via `@tensorflow-models/coco-ssd` (MobileNet v2 Lite)
- **Status: ✅ REAL AI** — loads a genuine pretrained model, runs real inference
- **Classes:** 80 COCO classes (person, car, chair, bottle, etc.)
- **Issues found:**
  - No configurable confidence threshold (hardcoded 0.4)
  - No temporal smoothing (detections flicker frame-to-frame)
  - No duplicate suppression beyond model's built-in NMS
  - No model loading progress indicator
  - No announcement cooldown (would spam TTS)
  - FPS counter shows inference speed, not actual throughput
  - Detection interval hardcoded at 200ms

### 2. OCR (`src/features/ocr/OCRReader.tsx`)
- **Engine:** Tesseract.js v7
- **Status: ✅ REAL AI** — runs genuine OCR on captured frames
- **Issues found:**
  - No image preprocessing (contrast, grayscale, threshold)
  - No language selection (English only, no Hindi/Punjabi)
  - No multi-language download
  - Progress callback works but could be more detailed
  - No pause/resume speech controls

### 3. Voice Assistant (`src/features/voice/VoiceAssistant.tsx`)
- **Engine:** Web Speech API (SpeechRecognition + SpeechSynthesis)
- **Status: ✅ REAL** — uses browser-native speech APIs
- **Issues found:**
  - Click-to-talk only (no wake word)
  - Commands are simple keyword matching, not robust intent recognition
  - No connection to live detection results (just redirects to pages)
  - No "start camera" / "stop camera" voice commands that actually work
  - No language switching
  - No session command history display

### 4. Speech Service (`src/services/speechService.ts`)
- **Status: ✅ REAL** — uses browser SpeechSynthesis
- **Issues found:**
  - `describeDetections()` is very simple — just lists objects
  - No object grouping or deduplication
  - No announcement cooldown

### 5. Navigation (`src/features/navigation/Navigation.tsx`)
- **Status: ✅ REAL** — uses Leaflet + OpenStreetMap + Geolocation API
- **Issues:** Route planning is placeholder only

### 6. 3D Hero / UI Components
- **Status: ✅ WORKING** — Beautiful glassmorphism UI, 3D orb, animations

---

## Missing Features

| Feature | Status | Action Required |
|---------|--------|-----------------|
| Configurable confidence threshold | ❌ Missing | Add slider + state |
| Temporal detection smoothing | ❌ Missing | Add tracking buffer |
| Announcement cooldown | ❌ Missing | Add debounce logic |
| Context engine (smart descriptions) | ❌ Missing | Build new service |
| Model loading progress bar | ❌ Missing | Add progress callbacks |
| AI Status Dashboard | ❌ Missing | Build new component |
| Image preprocessing for OCR | ❌ Missing | Add canvas filters |
| Hindi/Punjabi OCR | ❌ Missing | Download language data |
| Wake word detection | ❌ Missing | Investigate Porcupine / local solution |
| Voice commands controlling camera | ❌ Missing | Wire voice→dashboard |
| Road Intelligence model | ❌ Missing | Investigate pretrained models |
| Sound Intelligence model | ❌ Missing | Investigate YAMNet/audio models |
| Transport board reader | ❌ Missing | Extend OCR with text parsing |

---

## Recommended Architecture

```
COCO-SSD (TensorFlow.js) — keep as primary detector
  ↓
Enhanced Detection Pipeline
  - Configurable confidence threshold
  - Temporal smoothing (IOU tracker, 5-frame buffer)
  - Duplicate class suppression
  - Announcement cooldown (3s per object class)
  ↓
Context Engine
  - Groups detections by class
  - Builds natural language descriptions
  - Prioritizes nearby/large objects
  ↓
Speech Engine (enhanced)
  - Queue-based TTS
  - Pause/resume/repeat
  - Language selection
```

**Model choice rationale:** COCO-SSD via TensorFlow.js is the right choice for this project:
- It IS a real pretrained model (not fake)
- 80 COCO classes cover the major needs
- Runs reliably in-browser with no setup
- MobileNet v2 backbone is well-suited for the RTX 3050
- No ONNX conversion needed, no model file management
- YOLO via ONNX Runtime Web is possible but adds complexity without clear benefit for a hackathon

---

## Implementation Plan

| Phase | Task | Priority |
|-------|------|----------|
| 1 | Enhanced detection pipeline (thresholds, smoothing, NMS) | 🔴 Critical |
| 2 | Context engine (smart scene descriptions) | 🔴 Critical |
| 3 | Enhanced speech service (cooldown, queue, controls) | 🔴 Critical |
| 4 | OCR improvements (preprocessing, multi-language) | 🟡 High |
| 5 | Voice assistant improvements (camera control, intent routing) | 🟡 High |
| 6 | AI Status Dashboard | 🟡 High |
| 7 | Model management service | 🟢 Medium |
| 8 | Road Intelligence (investigate models) | 🟢 Medium |
| 9 | Sound Intelligence (investigate YAMNet) | 🟢 Medium |
| 10 | Testing & documentation | 🔴 Critical |

