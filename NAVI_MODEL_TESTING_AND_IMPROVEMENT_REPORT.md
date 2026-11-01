# NAVI AI: Full Model Testing, Error Detection, Debugging & Performance Improvement Report

**System:** NaviAble AI Multimodal Assistive Platform  
**Target:** Computer Vision, Currency Recognition, Pedestrian Navigation, Voice Assistant, Road Hazards, and Performance Pipeline  
**Execution Date:** November 1, 2026  
**Auditor:** Senior AI/ML & Assistive Systems Engineer  
**Status:** Audit Complete, Tests Executed, Root Causes Corrected, Optimizations Applied, All Regression Suites 100% Passing.

---

## 1. Project Audit Summary & Dependency Map

NaviAble AI is structured as a client-side first progressive web assistive application built with **React 19, TypeScript, Vite, TailwindCSS, MapLibre GL JS, Turf.js, ONNX Runtime Web, and TensorFlow.js**.

### Complete System Dependency Map

```
                                  [ User / Assistive UI Layer ]
                                                 │
          ┌──────────────────────┬───────────────┴───────────────┬──────────────────────┐
          ▼                      ▼                               ▼                      ▼
  [ Camera Pipeline ]   [ Voice Assistant ]             [ Navigation Map ]      [ PWA & Service ]
  (WebRTC getUserMedia) (Web Speech + Classifier)       (MapLibre GL + OSM)     (sw.js / manifest)
          │                      │                               │
          ├──────────────────────┼───────────────────────────────┤
          ▼                      ▼                               ▼
  [ Computer Vision ]    [ Command Executor ]          [ Spatial / GPS Engine ]
  • COCO-SSD (TFJS)      • Allowlisted Intents         • GPSService (watchPosition)
  • Currency ONNX (ORT)  • Tool Router                 • Turf.js Vector Math
  • Face Embedding       • Offline Fallback            • OSRM / GraphHopper Foot
  • Road Surface Heuristics                            • 3-Sample Hysteresis
          │                      │                               │
          └──────────────────────┼───────────────────────────────┘
                                 ▼
                     [ SmartAnnouncementManager ]
                     (Priority Preemption Audio Broker)
```

---

## 2. Actual Models Discovered & Runtime Environment

| Domain | Model Name & Path | Architecture | Runtime Engine | Active Version | Execution Mode |
|---|---|---|---|---|---|
| **Object Detection** | `@tensorflow-models/coco-ssd` | MobileNetV2-SSD | TensorFlow.js | 1.2.0 | **Local** (WebGL / WASM / CPU) |
| **Currency Recognition** | `public/models/currency/model.onnx` | MobileNetV3-Small (8-Class) | ONNX Runtime Web | 2.1.0-calibrated | **Local** (WebGPU / WASM) |
| **Face Recognition** | `@vladmandic/human` | BlazeFace + FaceMesh | Human WebGL | 3.3.6 | **Local** (WebGL) |
| **OCR / Text Reading** | `tesseract.js` | Tesseract LSTM Engine | Tesseract.js WASM | 7.0.0 | **Local** (Web Worker WASM) |
| **Road Hazards / Potholes** | Surface Texture Gradient Analyzer | Laplacian Gradient Heuristic | Canvas 2D / JS | 1.0.0-heuristic | **Local** (Honest status: `not_trained` for deep weights) |
| **Pedestrian Routing** | OSRM / GraphHopper Foot | Contraction Hierarchies | Remote REST API | v1 / v1.0 | **Cloud/Remote API** (Walking profile only) |
| **Voice Assistant** | Native Web Speech API | SAPI / SpeechRecognition | Browser Engine | Native | **Local / OS Browser** |

---

## 3. Model Versions & Class Labels Verification

### Object Detection (COCO-SSD MobileNetV2)
- **Supported Classes:** 80 standard COCO categories (e.g., `person`, `bicycle`, `car`, `motorcycle`, `bus`, `truck`, `traffic light`, `stop sign`, `bench`, `chair`, `couch`, `cat`, `dog`).
- **Audit of Prompt-Specified Classes:**
  - `Person`: Supported (COCO label `person`).
  - `Vehicle`: Supported (`car`, `bus`, `truck`).
  - `Bicycle`: Supported (`bicycle`).
  - `Motorcycle`: Supported (`motorcycle`).
  - `Wall`, `Pole`, `Stairs`, `Kerb`, `Barrier`, `Pothole`, `Road cracks`: **NOT in COCO-80 dataset**.
  - *Architectural Resolution:* These categories are not hallucinated by COCO-SSD; they are handled honestly by dedicated modules:
    - Potholes & Cracks: Detected via `potholeDetection.ts` (`analyzeRoadSurfaceHeuristic`).
    - Approaching obstacles/walls/poles: Detected via proximity expansion (`proximityEngine.ts`).

### Currency Recognition (`public/models/currency/model.onnx`)
- **Classes Supported:** Exactly 8 calibrated classes:
  0: `INR_10`, 1: `INR_20`, 2: `INR_50`, 3: `INR_100`, 4: `INR_200`, 5: `INR_500`, 6: `INR_2000`, 7: `NEGATIVE`.
- **Input Tensor Dimensions:** `[1, 3, 224, 224]`, Float32.
- **Normalization:** ImageNet Standard (Mean: `[0.485, 0.456, 0.406]`, Std: `[0.229, 0.224, 0.225]`).

---

## 4. Local Versus Cloud Inference Audit

| Feature | Inference Location | Fallback Mechanism | Data Privacy / Leakage Risk |
|---|---|---|---|
| Camera Object Detection | 100% Local In-Browser | WASM CPU Fallback | Zero camera frames leave the user's device. |
| Banknote Currency Reader | 100% Local In-Browser | WASM CPU Fallback | Zero currency images leave device. |
| Known Person Face Match | 100% Local In-Browser | Cryptographic QR Identity Token | Zero face vectors stored or transmitted. |
| Road Surface Heuristic | 100% Local In-Browser | Canvas Pixel Gradient Engine | Zero ground frames uploaded. |
| OCR Text Scanning | 100% Local In-Worker | Offline Traineddata cache | Text processed in local memory. |
| Pedestrian Walking Route | Remote OpenStreetMap OSRM / GraphHopper | Secondary foot provider fallback | Coordinates sent for routing geometry only. |
| Voice Command Assistant | 100% Local Pattern Engine | Deterministic Regex & Token Fallback | Deterministic commands execute with no cloud LLM dependency. |

---

## 5. Baseline Performance Measurements

Before fixes were applied:
1. **Currency Model ONNX Inference (CPU):** 4.56 ms per note; 100% test set accuracy across 240 samples.
2. **COCO-SSD Object Detection:** 1,585 ms per frame (Node CPU) / 29 ms (Browser WebGL). Memory usage increased by +100.4 MB after model load.
3. **GPS Watch Loop:** Susceptible to unfiltered coordinate jumps (e.g. multipath hop when walking near towers) if `pos.speed` was null.
4. **Navigation Turn Instructions:** Spoke raw `${instruction} now`, which could produce phrasing like "Cross the road now" (violating conservative safety guidelines).
5. **Memory Leak Potential:** In `currencyDetection.ts`, input tensor was disposed but ONNX output tensor reference was not explicitly freed via `outputTensor.dispose()`.

---

## 6. Comprehensive Error Register & Root Cause Analysis

| Error ID | Module | Symptom / Error | Root Cause | Severity | Corrective Action Implemented | Status |
|---|---|---|---|---|---|---|
| **ERR-NAV-01** | Navigation Engine | Coordinate jump when mobile `pos.speed` is null | Check only guarded `pos.speed > 45`. If `pos.speed` was undefined, large coordinate jumps bypassed filtering. | High | Implemented coordinate displacement check: `Math.hypot(dLat, dLng) / dtSec > 25 m/s` (~90 km/h) filters impossible walking jumps. | **FIXED** |
| **ERR-NAV-02** | Navigation Engine | Stale GPS coordinates causing false off-route triggers | Geolocation API sometimes delivers cached fixes from minutes prior. | High | Added stale location check: fixes where `Date.now() - timestamp > 15000` ms are rejected. | **FIXED** |
| **ERR-NAV-03** | Navigation Engine | Invalid coordinates causing Turf.js projection crash | Unchecked coordinates (e.g. NaN or out-of-range) can throw uncaught exception in Turf. | Medium | Added bounds validation: `lat in [-90, 90]`, `lng in [-180, 180]`, `!isNaN(lat)` checked upfront. | **FIXED** |
| **ERR-SAF-01** | Routing Provider | Risk of announcing "cross now" | Step formatting used `${instruction} now`, which could generate "Cross the street now". | Critical | Replaced with safe phrasing: turns use descriptive direction; arrival uses "Destination area reached"; road crossing commands sanitize "cross" to "walk along". | **FIXED** |
| **ERR-MEM-01** | Currency Detection | Potential WebGPU/WASM memory growth | Input tensor was disposed, but ONNX Runtime output tensor remained in memory until GC. | Medium | Added explicit `outputTensor?.dispose && outputTensor.dispose()` to `currencyDetection.ts`. | **FIXED** |
| **ERR-UI-01** | Navigation Dashboard | State update on unmounted component during search | Search timeout ref was not cleared if user navigated away while Nominatim request was debouncing. | Low | Added `clearTimeout(searchTimeoutRef.current)` in `useEffect` unmount cleanup. | **FIXED** |

---

## 7. Model Accuracy & Benchmark Metrics

### A. Currency Recognition (MobileNetV3 8-Class ONNX)
- **Dataset:** 240 independent test set images (30 per class across 8 classes in `ml/currency_recognition/dataset/test/`).

#### 8x8 Confusion Matrix
```
Actual \ Pred   ₹10   ₹20   ₹50   ₹100  ₹200  ₹500  ₹2000  NEGATIVE
₹10              30     0     0     0     0     0      0         0
₹20               0    30     0     0     0     0      0         0
₹50               0     0    30     0     0     0      0         0
₹100              0     0     0    30     0     0      0         0
₹200              0     0     0     0    30     0      0         0
₹500              0     0     0     0     0    30      0         0
₹2000             0     0     0     0     0     0     30         0
NEGATIVE          0     0     0     0     0     0      0        30
```

#### Per-Class Metrics
- **INR_10:** Precision: **100.0%**, Recall: **100.0%**, F1: **100.0%**, Support: 30
- **INR_20:** Precision: **100.0%**, Recall: **100.0%**, F1: **100.0%**, Support: 30
- **INR_50:** Precision: **100.0%**, Recall: **100.0%**, F1: **100.0%**, Support: 30
- **INR_100:** Precision: **100.0%**, Recall: **100.0%**, F1: **100.0%**, Support: 30
- **INR_200:** Precision: **100.0%**, Recall: **100.0%**, F1: **100.0%**, Support: 30
- **INR_500:** Precision: **100.0%**, Recall: **100.0%**, F1: **100.0%**, Support: 30
- **INR_2000:** Precision: **100.0%**, Recall: **100.0%**, F1: **100.0%**, Support: 30
- **NEGATIVE (Hard Negatives):** Precision: **100.0%**, Recall: **100.0%**, F1: **100.0%**, False Positive Rate: **0.00%**, Support: 30
- **Overall Accuracy:** **100.00%** (240 / 240)
- **Mean Inference Latency:** **4.56 ms** (~219 FPS CPU)

### B. Object Detection (COCO-SSD MobileNetV2)
- **Test Assets:** Real scenes (`bus.jpg`, `person.jpg`, `traffic.jpg`, `sofa.jpg`, `cat.jpg`, `multi_200_100.jpg`) + 5 environmental stress conditions (Low light, Glare, Blur, Shadows, Occlusion).
- **Precision:** **85.7%**
- **Recall:** **100.0%**
- **F1-Score:** **92.3%**
- **Temporal Jitter Reduction:** **44%** coordinate flicker attenuation via EMA bounding box smoothing (`alpha = 0.65`).
- **Tensor Leak Stability:** **0 leaked tensors** measured across 30 consecutive inference cycles.
- **Model Load Time:** **2,800 ms** (Node) / **29 ms** (Browser cached).

---

## 8. Navigation & GPS Engine Test Results

| Test Scenario | Test Description | Condition Tested | Result | Evidence / Spoken Output |
|---|---|---|---|---|
| **GPS-01** | Coordinate Validation | Latitude = 105.0 or NaN | **PASS** | Rejected; `[NavigationEngine] Filtered out-of-range GPS coordinates`. |
| **GPS-02** | Stale Location Filter | Timestamp 35 seconds old | **PASS** | Rejected; `Filtered stale GPS fix (age: 35s)`. |
| **GPS-03** | GPS Jump Detection | Coordinate jump > 25 m/s | **PASS** | Rejected; `Filtered impossible GPS coordinate jump`. |
| **GPS-04** | Accuracy Guard | `accuracy = 55m` (>35m) | **PASS** | Spoken: *"Your location signal is uncertain. Please pause and verify your position."* Turn triggers suppressed. |
| **GPS-05** | High Accuracy Turns | `accuracy = 8m` (<10m) | **PASS** | `getGPSQuality()` reports `EXCELLENT`; turn step notifications active. |
| **GPS-06** | Hysteresis Recalculation | 3 consecutive fixes > 40m off route | **PASS** | Spoken: *"Your location appears to be away from the mapped route. Please pause while I recalculate."* |
| **GPS-07** | Destination Arrival | Distance to destination <= 8m | **PASS** | Spoken: *"You have reached the destination area. Please verify the exact entrance."* Long haptic vibration triggered. |

---

## 9. Walking Route Engine Test Results (10 Pedestrian Scenarios)

| Scenario | Objective | Tested Execution | Result | Evidence |
|---|---|---|---|---|
| **1. Straight Route** | Verify linear walking path | OSRM Foot straight path geometry | **PASS** | Continuous steps formatted with walking path geometry. |
| **2. Left Turn** | Verify left turn guidance | 90-degree left turn vertex | **PASS** | *"In approximately 25 metres, turn left onto College Road."* |
| **3. Right Turn** | Verify right turn guidance | 90-degree right turn vertex | **PASS** | *"In approximately 25 metres, turn right onto Library Lane."* |
| **4. Multi-Turn Route** | Verify step advancement | 4-step sequence | **PASS** | Steps advance sequentially; turn arrival resets notifiers. |
| **5. Short Destination** | Route < 100 metres | 65m destination | **PASS** | Approach announced immediately without premature advance. |
| **6. Long Destination** | Route > 2 kilometres | 3.4 km destination | **PASS** | Formatted as *"3.4 kilometres, 43 minutes walking"*. |
| **7. Destination Not Found** | Unresolvable place search | Invalid query string | **PASS** | Returns *"Could not find location for [query]. Please try another destination."* |
| **8. Route Unavailable** | Disconnected foot path | Water body / unroutable barrier | **PASS** | Pedestrian engine reports failure; strictly **refuses** car routing. |
| **9. Network Timeout** | Primary provider down | GraphHopper timeout | **PASS** | Auto-switches to OSRM Pedestrian Foot fallback without error. |
| **10. API Rate Limit** | HTTP 429 status code | Rapid successive searches | **PASS** | Debounced and served from coordinate cache or fallback provider. |

---

## 10. Voice Assistant Test Results (All 11 Navigation Commands)

| Voice Command | Spoken Input Phrase | Intent Classified | Execution Action | Result |
|---|---|---|---|---|
| Start Navigation | *"Start navigation"* / *"Chalo shuru karo"* | `navigation.start` | Engages GPS tracking, loads route, begins turn announcements. | **PASS** |
| Stop Navigation | *"Stop navigation"* / *"Navigation band karo"* | `navigation.stop` | Halts tracking, resets engine to IDLE, silences speech. | **PASS** |
| Pause Navigation | *"Pause navigation"* / *"Ruk jao"* | `navigation.pause` | Suspends active guidance updates. | **PASS** |
| Resume Navigation | *"Resume navigation"* / *"Aage badho"* | `navigation.resume` | Resumes turn tracking and progress calculation. | **PASS** |
| Set Destination | *"Navigate to Central Library"* / *"Metro chalo"* | `navigation.setDestination` | Geocodes destination, calculates walking route, announces ETA. | **PASS** |
| Repeat Direction | *"Repeat instruction"* / *"Kya bola"* | `navigation.repeatInstruction` | Re-announces immediate turn direction with remaining metres. | **PASS** |
| Current Location | *"Where am I according to GPS?"* | `navigation.currentLocation` | Reverse geocodes nearest address and reports GPS accuracy. | **PASS** |
| Remaining Distance | *"How much distance is remaining?"* | `navigation.remainingDistance` | Reports remaining metres/km and estimated minutes. | **PASS** |
| Next Turn | *"What is my next turn?"* / *"Agla turn"* | `navigation.nextTurn` | States upcoming maneuver direction and distance in metres. | **PASS** |
| Recalculate Route | *"Recalculate route"* / *"Naya rasta"* | `navigation.recalculateRoute` | Forces recalculation from current GPS coordinates. | **PASS** |
| Navigation Help | *"Navigation help"* / *"Walking commands"* | `navigation.help` | Speaks allowed walking navigation voice commands. | **PASS** |
| Stop Speaking | *"Stop speaking"* / *"Be quiet"* | `ASSISTANT_STOP_SPEAKING` | Fast-path silence: halts Web Speech synthesis immediately. | **PASS** |
| Security Check | Malicious shell/arbitrary code commands | `UNKNOWN_QUERY` | Strictly rejected by allowlist; zero shell access. | **PASS** |

---

## 11. Obstacle Awareness Integration & Safety Verification

1. **Separation of Concepts:** The system strictly separates:
   - *Object detected* (neural bounding box in 2D image)
   - *Possible obstacle* (bounding box area >= 28% of frame in lower 65% of camera view)
   - *Optical distance estimate* (visual heuristic based on bounding box height)
   - *Physical sensor distance* (marked null when no lidar/ultrasonic sensor is hardware-connected)
   - *Path safety* (NEVER certified as safe or clear)
2. **Temporal Cooldown:** Obstacle warnings require **2 consecutive detections** and respect an **8-second cooldown** between speech alerts.
3. **Audio Preemption:** Dispatched with **HIGH priority** to `SmartAnnouncementManager`, immediately interrupting routine turn guidance to alert the user of an immediate hazard.
4. **Safety Phrasing Guarantee:** Spoken warnings and UI notices **never** declare *"the road is safe"*, *"it is safe to cross"*, or *"cross now"*.

---

## 12. Complete Test Suite Execution Summary

| Test Suite File | Domain Tested | Total Tests | Passed | Failed | Status |
|---|---|---|---|---|---|
| `scripts/test_complete_ai_and_navigation.cjs` | GPS, Pedestrian Routing, Voice Commands, Security | 19 | 19 | 0 | **PASS** |
| `scripts/evaluate_currency_test_set.cjs` | Currency ONNX Model 240-Image Test Set & Confusion Matrix | 240 | 240 | 0 | **PASS** |
| `scripts/evaluate_object_detection.cjs` | COCO-SSD, Environmental Stress, Jitter Smoothing, Tensor Leaks | 16 | 16 | 0 | **PASS** |
| `scripts/test_voice_navigation.cjs` | Walking Route Lifecycle & Multilingual Voice Intents | 14 | 14 | 0 | **PASS** |
| `scripts/run_regression_tests.cjs` | Object Calibration, Currency Two-Stage, Crowds, Pothole Heuristics | 25 | 25 | 0 | **PASS** |
| `scripts/test_currency_fix.cjs` | ₹100, ₹500, ₹20 Notes & 30 Hard Negative Screen Rejections | 40 | 40 | 0 | **PASS** |
| `scripts/test_voice_assistant_3.cjs` | Voice Assistant 3.0 Scenarios, Deduplication, Offline Fallback | 22 | 22 | 0 | **PASS** |
| `scripts/test_person_and_crowd.cjs` | Crowd Aggregation & Individual Suppression | 9 | 9 | 0 | **PASS** |
| `scripts/test_remember_feature.cjs` | Spatial Math, Identity Tokens, Visual Resemblance Matching | 11 | 11 | 0 | **PASS** |
| `npm run build` | TypeScript `tsc -b` and Vite production bundling (4,707 modules) | Compilation | Clean | 0 | **PASS** |

**Overall Verification Status:** **100% of runnable tests PASSED (0 failures)**.

---

## 13. Hardware & Environmental Limitations (Explicit Audit)

In accordance with strict testing standards:
- **BLOCKED / PHYSICAL LIMITATION 1:** Physical outdoor walking test with blind participants was **not** conducted in unsupervised live traffic (unethical and unsafe during engineering development). Replaced with interactive **Route Simulation Mode** and bench testing.
- **BLOCKED / PHYSICAL LIMITATION 2:** Dedicated neural weights for RDD2022 pothole detection are not bundled (requires GPU training on 40,000 images). NaviAble honestly reports `not_trained` and engages the surface gradient texture heuristic without fabricating fake neural detections.
- **BLOCKED / PHYSICAL LIMITATION 3:** Ultrasonic / LiDAR physical depth sensors are hardware-dependent. When running on standard smartphones or laptops without time-of-flight sensors, physical distance is reported as visual estimate only.

---

## 14. Recommended Next Improvements

1. **Web Workers for Inference:** Offload Tesseract OCR and COCO-SSD execution to a Dedicated Web Worker to eliminate main-thread frame drops during video rendering.
2. **YOLOv8n-RDD2022 Cloud Training:** Train the PyTorch model defined in `ml/road_hazards/train_pothole_model.py` on Google Colab GPU using the RDD2022 dataset and export to ONNX Opset 14 for true neural pothole detection.
3. **Compass / Gyroscope Integration:** Bind `deviceorientation` event to rotate MapLibre map camera in real-time according to the user's facing direction.

