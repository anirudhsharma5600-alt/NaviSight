# NAVIABLE AI: COMPREHENSIVE AI SYSTEM ERROR REGISTER
**Document Version:** 3.1.0  
**Audit Date:** 2026-11-01  
**Lead Auditor:** Senior AI/ML Systems & Computer Vision Specialist  
**Status:** COMPLETE AUDIT & ACTIVE REMEDIATION  

---

## Executive Summary

A comprehensive, end-to-end audit was conducted across all 16 AI and accessibility subsystems of NaviAble AI. A total of **24 distinct errors** were identified, categorized, and cataloged into Categories A through M. Each entry specifies the exact root cause, source file, reproduction steps, proposed engineering remediation, validation test, and remediation status.

---

## Error Classification Categories

- **Category A:** Model Accuracy Errors
- **Category B:** Wrong Training Data
- **Category C:** Incorrect Labels
- **Category D:** Incorrect Model Preprocessing
- **Category E:** Incorrect Class Mapping
- **Category F:** Wrong Inference Output Interpretation
- **Category G:** Confidence Threshold Errors
- **Category H:** API Connection Errors
- **Category I:** Camera and Image-Processing Errors
- **Category J:** Voice Recognition Errors
- **Category K:** Repeated Announcements
- **Category L:** Performance and Memory Errors
- **Category M:** Mobile Browser Compatibility Errors

---

## Comprehensive Error Table

| Error ID | Category | Affected Feature | Severity | Source File | Status |
|---|---|---|---|---|---|
| `ERR-CURR-01` | A, F | Currency Detection | **CRITICAL** | `src/services/currencyDetection.ts` | **FIXING** |
| `ERR-CURR-02` | B, D | Currency Training Pipeline | **HIGH** | `ml/currency_recognition/train_augmented_pipeline.py` | **FIXING** |
| `ERR-CURR-03` | D, I | Currency Stage 1 Presence | **CRITICAL** | `src/services/currencyDetection.ts` | **FIXING** |
| `ERR-CURR-04` | G | Currency Calibration Thresholds | **HIGH** | `src/services/currencyDetection.ts` | **FIXING** |
| `ERR-OBJ-01` | I, D | General Object Detection Aspect Ratio | **HIGH** | `src/services/objectDetection.ts` | **FIXING** |
| `ERR-OBJ-02` | E, G | Missing Important Navigation Classes | **MEDIUM** | `src/services/objectDetection.ts` | **FIXING** |
| `ERR-OBJ-03` | L | Offscreen Canvas Lifecycle | **MEDIUM** | `src/services/objectDetection.ts` | **FIXING** |
| `ERR-PROX-01` | K | Person Proximity Continuous Repeating | **HIGH** | `src/services/proximityEngine.ts` | **FIXING** |
| `ERR-PROX-02` | K, A | Crowd Scene Announcement Flooding | **HIGH** | `src/services/proximityEngine.ts` | **FIXING** |
| `ERR-PROX-03` | J, K | Speech Output Bypassing Central Voice Manager | **HIGH** | `src/services/proximityEngine.ts` | **FIXING** |
| `ERR-ROAD-01` | A, B | Pothole Deep Learning Weights Absence | **HIGH** | `src/services/potholeDetection.ts` | **FIXING** |
| `ERR-ROAD-02` | I, D | Road Texture Gradient Normalization | **MEDIUM** | `src/services/potholeDetection.ts` | **FIXING** |
| `ERR-OCR-01` | L, M | Tesseract Worker Memory Leak on Frame Loop | **HIGH** | `src/services/ocrService.ts` | **FIXING** |
| `ERR-OCR-02` | D, I | Low Contrast Text Preprocessing Failure | **MEDIUM** | `src/services/ocrService.ts` | **FIXING** |
| `ERR-VOIC-01` | J, K | Speech Recognition Echo Feedback Loop | **CRITICAL** | `src/assistant/voice/SpeechInput.ts` | **RESOLVED** |
| `ERR-VOIC-02` | J | Hinglish Colloquial Pattern Rejection | **HIGH** | `src/assistant/voice/VoiceLanguageManager.ts` | **RESOLVED** |
| `ERR-VOIC-03` | F | Duplicate Intent Execution within 1500ms | **HIGH** | `src/assistant/commands/CommandExecutor.ts` | **RESOLVED** |
| `ERR-VOIC-04` | J | False "Listening" UI Indicator | **HIGH** | `src/assistant/voice/VoiceStateManager.ts` | **RESOLVED** |
| `ERR-FACE-01` | L, M | Human Model WASM / WebGL Initialization Crash | **HIGH** | `src/services/knownFaceRecognition.ts` | **FIXING** |
| `ERR-FACE-02` | A | Identity Token Buffer Polyfill on Mobile Browsers | **MEDIUM** | `src/services/IdentityTokenService.ts` | **RESOLVED** |
| `ERR-API-01` | H | Gemini Live Multimodal Unhandled Disconnect | **MEDIUM** | `src/assistant/NaviConversationManager.ts` | **RESOLVED** |
| `ERR-PERF-01` | L | Concurrent Model Inferences Causing UI Stutter | **HIGH** | `src/services/modelManager.ts` | **FIXING** |
| `ERR-PERF-02` | L | ONNX WebGPU Shader Allocation Failures on iOS | **HIGH** | `src/services/currencyDetection.ts` | **FIXING** |
| `ERR-REG-01` | A, F | Lack of Model Version Registry & Rollback System | **MEDIUM** | `src/services/modelRegistry.ts` | **FIXING** |

---

## Detailed Error Specifications

### 1. Currency Recognition Subsystem

#### `ERR-CURR-01`: False Positive Banknote Detection on Non-Banknote Objects (Laptop Screen Classified as ₹100)
- **Classification:** Category A (Model accuracy errors) & Category F (Wrong inference output interpretation)
- **Affected Feature:** Indian Currency Reader (`CurrencyPage.tsx`, `currencyDetection.ts`)
- **Exact Symptom:** Pointing the camera at a laptop screen or keyboard caused NaviAble to announce: *"₹100 Banknote"* with ~57% confidence.
- **Root Cause:** In `currencyDetection.ts`, Stage 1 `detectBanknotePresence` defaulted to `hasBanknotePresence: true, presenceConfidence: 0.65` for neutral backgrounds. The single-crop aspect ratio was unverified, and the soft-margin threshold allowed non-negative classes to win when logits were diffuse.
- **Source File:** `src/services/currencyDetection.ts` (lines 535–588, 839–865)
- **Severity:** **CRITICAL**
- **Reproduction Steps:**
  1. Open NaviAble Currency Reader.
  2. Point camera at a laptop screen showing code or web pages.
  3. System outputs "₹100" despite absence of any banknote.
- **Proposed Correction:**
  1. Rewrite Stage 1 `detectBanknotePresence` to enforce strict banknote physical aspect ratios ($\sim 2.15 \pm 0.35$).
  2. Add high-frequency moiré and screen backlight color distribution check to aggressively reject screens, monitors, and laptops.
  3. Set open-set neural rejection threshold $\ge 0.75$ and margin $\ge 0.20$. If top class is `NEGATIVE` or confidence $< 0.75$, immediately emit `NO_BANKNOTE_DETECTED` with zero denomination speech.
- **Test Required:** Validation against 50 non-banknote images (laptops, phones, keyboards, blank paper, receipts) and 50 genuine banknote images. False positive rate on non-banknotes must be 0%.
- **Status:** **IN REMEDIATION**

---

#### `ERR-CURR-02`: Imbalanced Training Dataset & Insufficient Hard Negatives
- **Classification:** Category B (Wrong training data) & Category D (Incorrect model preprocessing)
- **Affected Feature:** Offline Currency Model Weights (`ml/currency_recognition/`)
- **Exact Symptom:** Model's internal representations for lavender/blue/grey tones clustered closely to laptop LCD spectra.
- **Root Cause:** Initial training dataset contained only 1,760 synthetic augmented samples from single base images per denomination. The `NEGATIVE` class had only 220 samples, mostly consisting of black/white noise rather than realistic electronics, documents, and domestic surfaces.
- **Source File:** `ml/currency_recognition/train_augmented_pipeline.py` & `generate_hard_negatives.py`
- **Severity:** **HIGH**
- **Proposed Correction:**
  1. Expand hard-negative dataset to include synthetic and authentic captures of laptop displays, keyboards, books, receipts, and wood textures.
  2. Implement Focal Loss or class weighting to heavily penalize false-positive banknote predictions on negative samples.
- **Test Required:** Test set evaluation on distinct negative holdout split.
- **Status:** **IN REMEDIATION**

---

#### `ERR-CURR-03`: Stage 1 Banknote Presence Defective Permissive Fallback
- **Classification:** Category D (Incorrect model preprocessing) & Category I (Camera & image-processing errors)
- **Affected Feature:** Stage 1 Pre-classifier in `detectBanknotePresence`
- **Exact Symptom:** Neutral gray and light surfaces passed through to Stage 2 with `presenceScore = 0.65`.
- **Root Cause:** Line 570 in `src/services/currencyDetection.ts` set `let presenceScore = 0.65` as an initial value, and line 586 returned `hasBanknotePresence: true` unless one of three narrow reject filters triggered.
- **Source File:** `src/services/currencyDetection.ts`
- **Severity:** **CRITICAL**
- **Proposed Correction:** Invert logic to default to `hasBanknotePresence: false`. Require positive structural, dimensional, and edge-contour evidence of a banknote before setting `hasBanknotePresence: true`.
- **Test Required:** Automated test feeding blank canvas, solid desk, and laptop photo; ensure `hasBanknotePresence === false`.
- **Status:** **IN REMEDIATION**

---

### 2. General Object Detection & Tracking Subsystem

#### `ERR-OBJ-01`: Camera Frame Distortion from Non-Letterboxed Downsampling
- **Classification:** Category I (Camera and image-processing errors) & Category D (Incorrect model preprocessing)
- **Affected Feature:** COCO-SSD Object Detection (`objectDetection.ts`)
- **Exact Symptom:** Bounding boxes on portrait mobile screens drift vertically or appear squashed.
- **Root Cause:** `getResizedFrame()` stretched video frames non-uniformly when aspect ratios differed, causing neural tensor aspect-ratio distortion and bounding box scale inaccuracies.
- **Source File:** `src/services/objectDetection.ts` (lines 256–278)
- **Severity:** **HIGH**
- **Proposed Correction:** Implement uniform aspect-ratio preservation with centered letterboxing (padding) or proportional dimension scaling.
- **Test Required:** Validate box intersection on 16:9, 4:3, and 9:16 video streams.
- **Status:** **IN REMEDIATION**

---

#### `ERR-OBJ-02`: Missing Important Navigation Classes & Fixed Default Thresholds
- **Classification:** Category E (Incorrect class mapping) & Category G (Confidence threshold errors)
- **Affected Feature:** Environmental Obstacle Detection (`objectDetection.ts`)
- **Exact Symptom:** Walkway obstacles like chairs, tables, and fire hydrants dropped out prematurely while distant cars flickered.
- **Root Cause:** Confidence thresholds were globally uniform at 0.40 without class-specific calibration for low-visibility indoor objects versus high-contrast road vehicles.
- **Source File:** `src/services/objectDetection.ts`
- **Severity:** **MEDIUM**
- **Proposed Correction:** Expand `CATEGORY_THRESHOLDS` mapping for all 20 accessibility-relevant classes, with hysteresis for persistent items.
- **Test Required:** Test on indoor obstacle dataset.
- **Status:** **IN REMEDIATION**

---

### 3. Proximity Engine & Crowd Intelligence

#### `ERR-PROX-01`: Unnecessary Repeated Person Announcements
- **Classification:** Category K (Repeated announcements)
- **Affected Feature:** Person Proximity Alerter (`proximityEngine.ts`)
- **Exact Symptom:** When a person stood stationary ahead, the assistant announced *"A person ahead appears very close"* every 2.5 seconds.
- **Root Cause:** In `proximityEngine.ts`, line 389 checked only `now - lastVoiceAlertTime >= 2500` without verifying if the target's zone, state, or proximity had actually changed.
- **Source File:** `src/services/proximityEngine.ts`
- **Severity:** **HIGH**
- **Proposed Correction:** Enforce state-transition gating and hysteresis. Stationary tracks must not trigger repeated spoken announcements once announced, unless proximity increases by $\ge 25\%$ or zone changes.
- **Test Required:** Simulate 100 frames of stationary target; verify exactly 1 spoken alert.
- **Status:** **IN REMEDIATION**

---

#### `ERR-PROX-02`: Crowd Scene Flooding (No Scene-Level Aggregation)
- **Classification:** Category K (Repeated announcements) & Category A (Model accuracy errors)
- **Affected Feature:** Crowd Intelligence in `proximityEngine.ts`
- **Exact Symptom:** In crowded areas (4–15 people), Navi attempted to announce individuals sequentially in rapid succession.
- **Root Cause:** Detections were processed strictly as independent individual tracks. There was no spatial cluster analysis or crowd density aggregator.
- **Source File:** `src/services/proximityEngine.ts`
- **Severity:** **HIGH**
- **Proposed Correction:** When $\ge 4$ persons are detected in the active frame, aggregate into a crowd event (*"A group of people is nearby"* / *"Ahead is crowded"* in English/Hindi) and suppress individual track notifications unless an individual approaches into the critical zone.
- **Test Required:** Crowd simulation test with 8 simultaneous tracks.
- **Status:** **IN REMEDIATION**

---

#### `ERR-PROX-03`: Speech Output Direct Bypass of Central Voice Manager
- **Classification:** Category J (Voice recognition errors) & Category K (Repeated announcements)
- **Affected Feature:** Proximity Speech Delivery in `proximityEngine.ts`
- **Exact Symptom:** Proximity voice alerts spoke over the voice assistant or caused the microphone to pick up the assistant's own voice.
- **Root Cause:** Line 411 directly called `speak(message)` from `speechService.ts`, bypassing `VoiceAnnouncementManager` and `SpeechOutput`, which prevented `SpeechInput.suspendListening()` from suppressing acoustic echo.
- **Source File:** `src/services/proximityEngine.ts` (line 411)
- **Severity:** **HIGH**
- **Proposed Correction:** Route all proximity voice messages through `VoiceManager.announce(message, 'HIGH', { category: 'PROXIMITY' })`, ensuring proper priority queuing, deduplication, and anti-echo suspension.
- **Test Required:** Verify `VoiceManager` receives proximity alerts and mic suspends during speech.
- **Status:** **IN REMEDIATION**

---

### 4. Road Hazards & Pothole Detection

#### `ERR-ROAD-01`: Deep Learning Model Absence & Status Discrepancy
- **Classification:** Category A (Model accuracy errors) & Category B (Wrong training data)
- **Affected Feature:** Road Hazard Detection (`potholeDetection.ts`)
- **Exact Symptom:** UI or documentation previously claimed active YOLOv8n pothole neural inference when no certified ONNX weights file existed at `/models/pothole/model.onnx`.
- **Root Cause:** Training pipeline was designed for Colab GPU execution with RDD2022, but local client-side model was not bundled.
- **Source File:** `src/services/potholeDetection.ts` & `ml/pothole_detection/`
- **Severity:** **HIGH**
- **Proposed Correction:** Maintain strict safety transparency: report status as `'not_trained'` for neural weights while operating the verified texture/Laplacian gradient heuristic for genuine road surface anomalies. Package complete Colab training pipeline with dataset loader in `ml/road_hazards/`.
- **Test Required:** Unit test checking `getPotholeModelInfo().status` reflects exact truth.
- **Status:** **IN REMEDIATION**

---

### 5. Performance, Memory & Model Registry

#### `ERR-PERF-01`: Concurrent Model Inferences Causing Main-Thread Frame Drops
- **Classification:** Category L (Performance and memory errors)
- **Affected Feature:** Multi-Model Orchestration (`modelManager.ts`)
- **Exact Symptom:** Running COCO-SSD, OCR, and ONNX Currency inference simultaneously caused camera stutter (<10 FPS) on mobile devices.
- **Root Cause:** All inference sessions competed on the JavaScript main thread without cooperative scheduling or on-demand gating.
- **Source File:** `src/services/modelManager.ts`
- **Severity:** **HIGH**
- **Proposed Correction:** Implement on-demand model activation: OCR and Currency models only execute when the user navigates to their respective pages or issues explicit voice commands. General object detection runs at throttled 150ms intervals on mobile.
- **Test Required:** Measure FPS and CPU usage before and after on-demand scheduling.
- **Status:** **IN REMEDIATION**

---

#### `ERR-REG-01`: Lack of Model Version Registry & Rollback System
- **Classification:** Category A (Model accuracy) & Category F (Output interpretation)
- **Affected Feature:** Model Version Management (`src/services/`)
- **Exact Symptom:** No unified registry existed to track model versions, dataset hashes, evaluation scores, or trigger clean rollbacks if a newly deployed model regressed.
- **Root Cause:** Model files were loaded directly from hardcoded static paths.
- **Source File:** `src/services/modelRegistry.ts` (new)
- **Severity:** **MEDIUM**
- **Proposed Correction:** Create a typed `ModelRegistry` service maintaining manifests for `object-model-v1`, `currency-model-v1`, `currency-model-v2`, `road-model-v1`, with checksum validation and runtime rollback capability.
- **Test Required:** Test switching models via `ModelRegistry.rollback()` and verifying fallback loading.
- **Status:** **IN REMEDIATION**

---

*End of Register. All cataloged issues are scheduled for immediate engineering remediation in Phases 2 through 14.*
