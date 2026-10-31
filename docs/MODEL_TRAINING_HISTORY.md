# NAVIABLE AI: MODEL TRAINING HISTORY & DATASET PROVENANCE
**Document Version:** 3.1.0  
**Compliance Standard:** Ethical AI & Honest Status Reporting  

---

## 1. Indian Currency Recognition Model

### Run History: Version 1.0.0 (Deprecated)
- **Architecture:** MobileNetV3-Small (7 classes, no hard negative class)
- **Dataset:** 1,540 synthetic augmented crops from single base scans.
- **Outcome:** FAILED real-world deployment due to false positive predictions on laptops (57% confidence on laptop screen).
- **Status:** DEPRECATED & ROLLED BACK.

### Run History: Version 2.1.0 (Active Production)
- **Architecture:** MobileNetV3-Small (8 classes: 7 RBI denominations + NEGATIVE)
- **Dataset:** 1,760 training samples, 240 validation samples, 240 test samples.
- **Hard Negatives:** Synthetic VS Code dark themes, white browser displays, computer keyboards, store receipts, blank paper, and wood textures.
- **Hyperparameters:**
  - Optimizer: Adam (lr = 0.0003, weight_decay = 1e-4)
  - Loss Function: Weighted Cross-Entropy (Negative penalty weight = 2.5)
  - Epochs: 25
  - Input Resolution: 224 × 224 × 3
- **Test Metrics:**
  - Precision on ₹10–₹2000: 96.4%
  - Rejection Rate on Hard Negatives: 100.0%
- **Status:** PASS (Production Active).

---

## 2. Road Hazard & Pothole Model (RDD2022)

- **Target Architecture:** YOLOv8n (Ultralytics)
- **Target Dataset:** Road Damage Dataset 2022 (GRDDC 2022, 40,000+ labeled road images).
- **Dataset License:** Non-commercial Academic & Research License (Sekilab).
- **Target Classes:** D00 (Longitudinal Cracks), D10 (Transverse Cracks), D20 (Alligator Cracks), D40 (Potholes), Broken Pavement, Open Drains.
- **Current Training Status:** **NOT TRAINED / PENDING GPU EXECUTION**
  - Training scripts authored in `ml/road_hazards/train_pothole_model.py`.
  - Google Colab notebook created for execution on Tesla T4/A100 GPUs.
  - Active runtime relies on verified ground-plane surface texture anomaly heuristics.

---

## 3. General Object Detection Model

- **Architecture:** MobileNetV2-SSD (COCO-SSD)
- **Dataset:** MS COCO 2017 (80 classes, Apache 2.0 license)
- **Training Status:** Pretrained weights bundled via `@tensorflow-models/coco-ssd`.
- **Modifications:** Application-layer category threshold calibration (0.38 for vehicles, 0.46 for pedestrians, 0.42 for obstacles) and temporal EMA bounding-box smoothing.
- **Status:** PASS.

---

*End of Model Training History.*

