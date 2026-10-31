# NaviAble AI — Model Training & Pipeline Report

**Date:** October 31, 2026  
**Status:** Comprehensive Model Inventory & Training Specifications  
**Project:** NaviAble AI — Beyond Vision. Beyond Limits.

---

## Executive Summary

NaviAble AI utilizes a hybrid Edge AI architecture:
1. **In-Browser Production Models:** Pretrained lightweight models (COCO-SSD MobileNet v2, Tesseract OCR WASM, Web Audio/Sensory heuristics) executing directly on user hardware with zero external server reliance.
2. **Offline Supervised Deep Learning Pipelines:** Custom computer vision models designed for specialized accessibility tasks (Indian currency denomination recognition, RDD2022 road damage detection).

This report outlines the technical requirements, dataset criteria, model configurations, training regimes, and target performance metrics for all models in the ecosystem.

---

## 1. Deployed In-Browser Models (Active)

### 1.1 Real-Time Object Recognition
- **Model:** COCO-SSD (lite_mobilenet_v2)
- **Framework:** TensorFlow.js (`@tensorflow/tfjs` + `@tensorflow-models/coco-ssd`)
- **Input Resolution:** Dynamic video element stream (optimal: 640×480)
- **Output:** Class name (80 COCO categories), confidence score `[0.0, 1.0]`, bounding box coordinates `[x, y, w, h]`
- **Post-Processing:**
  - Non-Maximum Suppression (NMS) with configurable IoU threshold (default: 0.5)
  - Horizontal sector projection (`LEFT` < 0.33, `CENTRE` 0.33-0.66, `RIGHT` > 0.66)
  - Temporal multi-frame tracking with persistent detection IDs
  - Natural speech generator with rate-limiting cooldowns
- **Inference Latency:** 28ms - 45ms per frame on desktop GPU / 60ms - 95ms on mobile CPU.

### 1.2 Optical Character Recognition (OCR)
- **Model:** Tesseract Engine v7 (LSTM-based recognition)
- **Framework:** Tesseract.js WebAssembly worker
- **Languages:** English (`eng`), Hindi (`hin`), Punjabi (`pan`)
- **Preprocessing Pipeline:**
  - Dynamic image capture from video canvas
  - Grayscale conversion via luminosity weighting (`0.299R + 0.587G + 0.114B`)
  - Adaptive contrast normalization and binarization
- **Output:** Extracted plain text, confidence metrics, and audio playback queue.

### 1.3 Visual Proximity & Collision Alert Engine
- **Methodology:** Monocular Bounding-Box Area Heuristic + Temporal Kalman Smoothing
- **Proximity Zones:**
  - `NEAR` (Critical Alert): Bounding box occupies > 25% of camera frame area
  - `MEDIUM` (Danger Alert): Bounding box occupies 8% - 25% of camera frame area
  - `FAR` (Warning Alert): Bounding box occupies < 8% of camera frame area
- **Feedback Multimodal Channels:**
  - Dynamic Web Audio frequency generator (600Hz warning, 800Hz danger, 1000Hz critical)
  - Web Haptic Vibration API pulse trains (`[100ms]`, `[100ms, 50ms, 200ms]`, `[100, 50, 200, 50, 300]`)
  - Web Bluetooth GATT client for optional ESP32 Time-of-Flight (ToF) laser rangefinders.

---

## 2. Models in Training Pipeline (Pending GPU Run)

### 2.1 Indian Banknote Currency Recognition
- **Architecture:** `MobileNetV3-Small` fine-tuned with custom classifier head
- **Target Classes:** 7 denominations
  - ₹10 (Chocolate Brown)
  - ₹20 (Greenish Yellow)
  - ₹50 (Fluorescent Blue)
  - ₹100 (Lavender)
  - ₹200 (Bright Yellow)
  - ₹500 (Stone Grey)
  - ₹2000 (Magenta)
- **Dataset:** Indian Currency Dataset (~1,786 real-world captured images across varied angles, folds, and lighting conditions).
- **Data Augmentation:**
  - Random resized crops (`224×224`)
  - Horizontal flipping
  - Rotation `[-15°, +15°]`
  - Color jitter (brightness, contrast, saturation)
- **Loss Function:** Label-smoothed Cross-Entropy Loss
- **Optimizer:** AdamW (`lr=1e-3`, `weight_decay=1e-4`, Cosine Annealing schedule)
- **Target Metrics:**
  - Top-1 Validation Accuracy: > 96.5%
  - Exported ONNX Footprint: ~9.5 MB
- **Training Script:** `ml/currency_recognition/train_currency_model.py`
- **Current Status:** Training pipeline fully implemented; awaiting GPU execution on Google Colab / local NVIDIA hardware.

### 2.2 Road Hazard and Pothole Detection
- **Architecture:** `YOLOv8n` (Ultralytics)
- **Target Classes:**
  - `D00`: Longitudinal Crack
  - `D10`: Transverse Crack
  - `D20`: Alligator Crack
  - `D40`: Pothole / Surface Depression
- **Dataset:** Road Damage Dataset 2022 (RDD2022) featuring 40,000+ annotated road hazard captures from India, Japan, Czech Republic, Norway, USA, and China.
- **Image Size:** 640×640
- **Training Configuration:** 50 epochs, batch size 16, SGD with momentum (`0.937`), cosine learning rate scheduler.
- **Target Metrics:**
  - mAP@0.5: > 0.62
  - mAP@0.5:0.95: > 0.38
  - Exported ONNX Footprint: ~12.2 MB
- **Training Script:** `ml/pothole_detection/train_pothole_model.py`
- **Current Status:** Training pipeline fully implemented; awaiting GPU execution.

---

## 3. Hardware Requirements for Offline Training

| Specification | Minimum Required | Recommended |
| :--- | :--- | :--- |
| **GPU** | NVIDIA T4 (Google Colab Free Tier) | NVIDIA RTX 3060 / 4070 (8GB+ VRAM) |
| **CUDA / cuDNN** | CUDA 11.8+ | CUDA 12.2+ |
| **Python** | 3.10 | 3.11 |
| **Disk Space** | 15 GB | 30 GB |

---

## 4. Verification and Deployment Protocol

1. Execute Python training scripts using the provided Google Colab instructions.
2. Confirm exported `.onnx` files are generated without truncation.
3. Move files to `public/models/currency/model.onnx` and `public/models/pothole/model.onnx`.
4. The NaviAble AI application automatically checks for model availability using zero-cost HTTP HEAD requests and activates live camera inference upon model detection.

