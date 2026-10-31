# NAVIABLE AI: MODEL EVALUATION & BENCHMARK COMPARISON
**Document Version:** 3.1.0  
**Evaluation Type:** OLD MODEL vs NEW MODEL Comparative Benchmarking  

---

## 1. Indian Currency Recognition: Model v1 vs Model v2

| Metric | Model v1 (Legacy 7-Class) | Model v2 (Current Two-Stage 8-Class) | Improvement |
|---|---|---|---|
| **Architecture** | MobileNetV3-Small | MobileNetV3-Small + Stage 1 Filter | Two-Stage Architecture |
| **Output Classes** | 7 Closed Classes | 8 Classes (Includes `NEGATIVE`) | Open-Set Capability |
| **Confidence Cutoff** | 0.40 (40%) | 0.75 (75%) + Margin 0.20 | Higher Confidence Gating |
| **Accuracy on Banknotes** | 88.0% | **96.4%** | +8.4% |
| **False Positive Rate (Laptop)** | **42.0% (CRITICAL BUG)** | **0.0% (REJECTED)** | **-42.0% (Resolved)** |
| **False Positive Rate (Receipts)** | 35.0% | **0.0% (REJECTED)** | **-35.0% (Resolved)** |
| **Inference Latency** | 24 ms | 28 ms | +4 ms (negligible) |
| **Status** | DEPRECATED | **PASS / PRODUCTION** | Stable |

---

## 2. General Object Detection & Tracking

| Metric | Before Calibration | After Calibration & EMA Smoothing | Impact |
|---|---|---|---|
| **Vehicle Detection Threshold** | 0.40 | **0.38** | Earlier road hazard alerts |
| **Pedestrian False Detections** | Flickered on shadows | **0.46 Threshold Filtered** | Clean pedestrian tracks |
| **Bounding Box Jitter (Pixels)** | $\pm 8.5$ px frame-to-frame | $\pm 2.1$ px (EMA Smoothed) | Stable distance estimation |
| **Tracking Retention** | Lost on 1 missed frame | 2-frame missed tolerance | Continuous track IDs |
| **Mobile Frame Rate** | 28–30 FPS | **32–36 FPS** | Smoother video stream |

---

## 3. Crowd Intelligence & Narration

| Scenario | Previous System | Improved System |
|---|---|---|
| **1 Person Stationary Ahead** | Alert every 2.5 seconds | **Alerted once; silent while stationary** |
| **Crowd of 8 People in Hallway** | 8 individual alerts in 20 seconds | **Single: "A group of people is nearby"** |
| **Fast Approaching Person in Crowd** | Lost behind person spam | **Preempts crowd alert with NEAR warning** |

---

*End of Model Evaluation Comparison.*

