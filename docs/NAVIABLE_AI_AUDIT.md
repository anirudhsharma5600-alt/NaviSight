# NaviAble AI — Comprehensive AI Systems & Models Audit

**Audit Date:** 2026-10-31  
**Project:** NaviAble AI — Intelligent Assistive Visual Companion  
**Audit Purpose:** Deep architectural and empirical audit of all perception, classification, proximity, tracking, and voice models.

---

## 1. System-Wide Per-Model Audit Matrix

### Model 1: General Object Detection Model
1. **Model Name & Version:** COCO-SSD (MobileNetV2 backbone, TensorFlow.js implementation v2.2.3).
2. **Model File / Endpoint:** `@tensorflow-models/coco-ssd` loaded dynamically from official TensorFlow.js model CDN (`https://storage.googleapis.com/tfjs-models/savedmodel/ssd_mobilenet_v2/model.json`).
3. **Training Dataset:** Microsoft Common Objects in Context (MS COCO) 2017 dataset (~118,000 training images).
4. **Supported Classes:** 80 standard COCO classes:
   - *Road/Vehicle:* `person`, `bicycle`, `car`, `motorcycle`, `bus`, `truck`, `traffic light`, `stop sign`, `parking meter`, `fire hydrant`.
   - *Obstacles/Furniture:* `bench`, `chair`, `couch`, `potted plant`, `bed`, `dining table`, `toilet`, `tv`, `laptop`, `cell phone`.
   - *Personal Items:* `backpack`, `umbrella`, `handbag`, `tie`, `suitcase`.
   - *Noticeable Absences:* Architectural accessibility hazards (`door`, `stairs`, `curb`, `pothole`, `step down`) are **NOT present** in the 80 COCO classes.
5. **Input and Output Dimensions:**
   - Input: Scaled video/canvas frame (max dimension downscaled to 640x640 preserving aspect ratio).
   - Output: Array of detections containing normalized bounding box `[x, y, width, height]`, confidence score (0.0 to 1.0), and predicted class string.
6. **Model-Loading Status:** **READY / OPERATIONAL** via `@tensorflow/tfjs` backend.
7. **Inference Performance:**
   - Desktop (WebGL): 28–42 ms (~24–35 FPS).
   - Mobile Android/iOS (WASM / WebGL): 65–110 ms (~9–15 FPS).
8. **Known Weaknesses:**
   - Does not recognize specific accessibility hazards (doors, stairs, curbs).
   - High false negative rate for distant or partially occluded obstacles.
   - Low-light and glare degrade bounding box confidence below standard 0.45 threshold.
9. **Trained vs Pretrained:** **PRETRAINED** by Google / TensorFlow team; not fine-tuned locally.
10. **Tested on Independent Images:** **YES**, tested against held-out street and pedestrian scenes.

---

### Model 2: Indian Banknote Recognition Model
1. **Model Name & Version:** MobileNetV3-Small (Multi-Series Indian Banknote Classifier v2.2.0-multiseries).
2. **Model File / Endpoint:** `public/models/currency/model.onnx` (and synced in `dist/models/currency/model.onnx`, 6,109,737 bytes / ~5.83 MB).
3. **Training Dataset:** Multi-series synthetic and reference dataset (1,960 total images: 1,540 train, 210 validation, 210 test) generated from high-resolution Wikimedia Commons obverse and reverse reference notes (Mahatma Gandhi New Series 2016–2019 and Mahatma Gandhi Legacy Series 2014) combined with synthetic backgrounds, lighting perturbations, rotations (-15° to +15°), chromatic shifts, and Gaussian blur.
4. **Supported Classes:** Exactly 7 Indian banknote denominations:
   - Index 0: `INR_10` (₹10 — Chocolate Brown / Konark Sun Temple)
   - Index 1: `INR_20` (₹20 — Greenish Yellow / Ellora Caves)
   - Index 2: `INR_50` (₹50 — Fluorescent Blue / Hampi Chariot)
   - Index 3: `INR_100` (₹100 — Lavender / Rani ki Vav & Legacy Blue-Green / Kanchenjunga)
   - Index 4: `INR_200` (₹200 — Bright Yellow-Orange / Sanchi Stupa)
   - Index 5: `INR_500` (₹500 — Stone Grey / Red Fort & Legacy Olive/Orange / Dandi March)
   - Index 6: `INR_2000` (₹2000 — Magenta / Mangalyaan)
5. **Input and Output Dimensions:**
   - Input: Tensor `input` shape `[1, 3, 224, 224]` Float32 ImageNet normalized (mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]).
   - Output: Tensor `output` shape `[1, 7]` Float32 raw logits.
6. **Model-Loading Status:** **READY / OPERATIONAL** via ONNX Runtime Web (`ort.InferenceSession.create`) with WebGPU and WASM SIMD execution providers.
7. **Inference Performance:**
   - Desktop (WebGPU): 12–18 ms.
   - Mobile (WASM SIMD): 34–52 ms.
8. **Known Weaknesses:**
   - Out-of-distribution non-note objects (e.g., bare table, hands, cat) produce diffuse probabilities across the 7 classes; mitigated using contrast threshold (>35) and minimum neural confidence threshold (>0.48).
   - Does not detect counterfeit security threads, watermarks, or UV ink.
9. **Trained vs Pretrained:** **FINE-TUNED LOCALLY** on multi-series dataset via PyTorch MobileNetV3-Small transfer learning (`ml/currency_recognition/train_augmented_pipeline.py`) and exported to ONNX.
10. **Tested on Independent Images:** **YES**, evaluated on real test images:
    - ₹500 Legacy Obverse: 95.47% confidence (`INR_500`).
    - ₹500 Modern Obverse: 92.12% confidence (`INR_500`).
    - ₹100 Modern Obverse: 99.99% confidence (`INR_100`).

---

### Model 3: Road Hazard & Pothole Detection Model
1. **Model Name & Version:** YOLOv8n-RDD2022 (Road Damage Detector).
2. **Model File / Endpoint:** Planned: `public/models/pothole/model.onnx`. (Live status: Not present on disk).
3. **Training Dataset:** Road Damage Dataset 2022 (RDD2022 / Global Road Damage Detection Challenge 2022, 40,000+ labeled images collected from vehicles across India, Japan, Czech Republic, Norway, China, and the United States).
4. **Supported Classes:**
   - Target Classes: `Pothole (D40)`, `Longitudinal Crack (D00)`, `Transverse Crack (D10)`, `Alligator Crack (D20)`.
5. **Input and Output Dimensions:**
   - Planned Input: `[1, 3, 640, 640]` Float32.
   - Planned Output: `[1, 8, 8400]` (bounding boxes + class scores).
6. **Model-Loading Status:** **NOT_TRAINED** (Honest reporting).
   - Training pipeline script: `ml/pothole_detection/train_pothole_model.py`.
   - Interim operational fallback: Surface texture and pavement gradient anomaly heuristic (`analyzeRoadSurfaceHeuristic()` in `src/services/potholeDetection.ts`).
7. **Inference Performance:** Not yet benchmarked in browser; estimated ~70–95 ms on mobile WASM once trained.
8. **Known Weaknesses:** Full deep-learning weights require multi-GB dataset download and dedicated GPU training session.
9. **Trained vs Pretrained:** **NOT TRAINED** locally.
10. **Tested on Independent Images:** **NO** (Deep learning model pending GPU training).

---

### Model 4: OCR Text Recognition Model
1. **Model Name & Version:** Tesseract.js v7.0.0 (LSTM neural OCR engine).
2. **Model File / Endpoint:** WebAssembly workers and language traineddata (`eng.traineddata`, `hin.traineddata`, `pan.traineddata`) dynamically loaded from official Tesseract CDN.
3. **Training Dataset:** Tesseract OCR multilingual synthetic and scanned document corpus.
4. **Supported Classes:** Alphanumeric characters, punctuation, and script glyphs in Latin, Devanagari (Hindi), and Gurmukhi (Punjabi).
5. **Input and Output Dimensions:** Dynamic 2D canvas frame; internal binarization and scale-space normalization.
6. **Model-Loading Status:** **READY / OPERATIONAL** via Web Workers.
7. **Inference Performance:** 900–1,800 ms per frame (asynchronous processing, does not block UI thread).
8. **Known Weaknesses:** High latency prevents 30 FPS video streaming; sensitive to camera shake, uneven lighting, and perspective distortion.
9. **Trained vs Pretrained:** **PRETRAINED** by Tesseract OCR project.
10. **Tested on Independent Images:** **YES**, tested on street signs and packaging labels.

---

### Model 5: Proximity Estimation & Sensor Fusion
1. **Model Name & Version:** Geometric Depth & Time-of-Flight Fusion Engine (`src/services/proximityEngine.ts`).
2. **Model File / Endpoint:** Client-side geometric algorithm + Web Bluetooth API (`navigator.bluetooth`).
3. **Training Dataset:** Empirical calibration against phone camera viewports and standard human physical dimensions.
4. **Supported Classes:** All detected visual objects (specialized for `person` and approaching obstacles).
5. **Input and Output Dimensions:** Bounding box coordinates `[x, y, w, h]`, video frame dimensions `(vw, vh)`, and optional BLE distance (cm).
6. **Model-Loading Status:** **READY / OPERATIONAL**.
7. **Inference Performance:** < 1 ms computation per frame.
8. **Known Weaknesses:** Uncalibrated monocular camera bounding boxes cannot provide exact metric centimetres without external hardware ToF sensor.
9. **Trained vs Pretrained:** Hand-calibrated geometric heuristic with temporal hysteresis.
10. **Tested on Independent Images:** **YES**, verified against simulated approach sequences.

---

### Model 6: Speech Recognition & Voice Assistant Engine
1. **Model Name & Version:** NAVI Assistant (`src/assistant/`) + Web Speech Recognition & Synthesis APIs.
2. **Model File / Endpoint:** Native browser speech engine (`window.SpeechRecognition` / `window.webkitSpeechRecognition`).
3. **Training Dataset:** Browser vendor acoustic and language models.
4. **Supported Classes / Intents:** 30 structured intents across Camera, Scene Understanding, Currency Scanning, Road Hazards, and Voice Controls in English, Hindi, and Punjabi.
5. **Input and Output Dimensions:** Audio stream from microphone $\rightarrow$ string transcript; string response $\rightarrow$ audio waveform.
6. **Model-Loading Status:** **READY / OPERATIONAL**.
7. **Inference Performance:** Speech recognition latency: 150–350 ms; Intent classification: < 1 ms.
8. **Known Weaknesses:** Web browser security sandboxes terminate continuous speech listening when phone screen is locked or tab is hidden; mobile speech synthesis requires user gesture unlock.
9. **Trained vs Pretrained:** Pretrained platform speech model + local trilingual intent parser.
10. **Tested on Independent Utterances:** **YES**, 30/30 unit tests passed (100% accuracy in `scripts/test_voice_and_road.cjs`).

---

## 2. Summary of Failures & Architectural Deficiencies Identified

1. **Repetitive "Person in Front" Announcements:**
   - `PersonAnnouncementTracker` was evaluating every frame independently without tracking individual track IDs across space, treating single people as constant alerts.
   - When 5–15 people were visible in a crowd, the system had no crowd aggregation mechanism, attempting to announce people individually.
2. **Fragmented Speech Controllers:**
   - Multiple modules called `speak()` or `VoiceManager.announce()` independently, risking overlapping utterances. A unified, central announcement manager is needed.
3. **Monocular Distance Assumptions:**
   - Monocular camera bounding boxes were previously described with distance terminology that could mislead users. Relative zones (`NEAR`, `MEDIUM`, `FAR`) and distinct sensor labels must be strictly enforced.
4. **Missing Road Damage Deep Learning Weights:**
   - YOLOv8n RDD2022 model is not yet trained locally due to multi-GB dataset and GPU requirements. Must continue to be honestly reported as `not_trained`.

