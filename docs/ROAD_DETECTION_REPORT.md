# NaviAble AI 2.0 — Road Intelligence & Hazard Detection Report

**Date:** 2026-10-31  
**Module:** Road Intelligence & Obstacle Narration Engine (`src/services/roadIntelligence.ts`)  
**Status:** FULLY OPERATIONAL (COCO road object intelligence + surface hazard heuristics)

---

## 1. Investigation: Why NaviAble Previously Only Announced "Person in front"

### Root Cause Analysis
During forensic code inspection of `Dashboard.tsx` lines 238–244:
```ts
// Previous Code in Dashboard.tsx
if (results.length > 0) {
  PersonTracker.processFrame(results, video.videoWidth, video.videoHeight, {
    generalNarrationEnabled: audioEnabled,
  })
}
```
1. **Missing Narration Connection:** The underlying MobileNetV2 COCO-SSD detector was successfully detecting 80 object classes (cars, buses, motorcycles, bicycles, traffic lights, benches, etc.) and drawing bounding boxes on canvas. However, in the detection loop, **only `PersonTracker` was wired to the speech controller**.
2. **Absence of Road Intelligence Engine:** No module tracked non-pedestrian objects over consecutive frames or generated voice alerts for vehicles or street obstacles.
3. **Repetition Dominance:** `PersonTracker` continually evaluated person proximity scores, repeating "A person is nearby", "A person appears to be approaching", and "Warning! A person appears very close", completely monopolizing speech output.

### Fix Implemented
1. Created `RoadIntelligenceEngine` (`src/services/roadIntelligence.ts`) tracking vehicles (`car`, `motorcycle`, `bicycle`, `bus`, `truck`), traffic elements (`traffic light`, `stop sign`), and walkway obstacles (`bench`, `chair`, `suitcase`, `backpack`, `fire hydrant`).
2. Integrated `RoadIntelligence.processFrame(...)` directly into `Dashboard.tsx`'s live detection loop.
3. Implemented spatial positioning (`LEFT`, `CENTRE/AHEAD`, `RIGHT`) and temporal smoothing with strict 12s object-level and 6s class-level cooldowns to prevent spamming.

---

## 2. Road Object Classification & Narration Verification

| Object Class | Category | Urgency | Example Spoken Phrasing | Test Status |
|---|---|---|---|---|
| **Car** | Vehicle | Normal | *"A car is visible ahead."* | **PASS** |
| **Motorcycle** | Vehicle | Medium | *"A motorcycle is approaching."* | **PASS** |
| **Bicycle** | Vehicle | Normal | *"A bicycle is on your left."* | **PASS** |
| **Bus** | Vehicle | Medium | *"A bus is visible ahead."* | **PASS** |
| **Truck** | Vehicle | Medium | *"A truck is visible ahead."* | **PASS** |
| **Traffic Light** | Traffic Control | Normal | *"A traffic signal is detected on your right."* | **PASS** |
| **Stop Sign** | Traffic Control | Normal | *"A stop sign is detected ahead."* | **PASS** |
| **Bench** | Street Furniture | Low | *"A bench is on your left."* | **PASS** |
| **Chair** | Street Furniture | Low | *"A chair is on your right."* | **PASS** |
| **Suitcase** | Ground Obstacle | Normal | *"A suitcase is on your left."* | **PASS** |
| **Backpack** | Ground Obstacle | Low | *"A backpack is ahead."* | **PASS** |
| **Person** | Pedestrian | Normal | *"A person is nearby."* / *"A person is approaching."* | **PASS** |

---

## 3. Road Hazard Intelligence & Pothole Detection Audit

### Required Road Hazard Target Classes
- Potholes (RDD2022 D40)
- Longitudinal Cracks (RDD2022 D00)
- Transverse Cracks (RDD2022 D10)
- Alligator Cracks (RDD2022 D20)
- Broken road surfaces & Broken pavements
- Open drains & Manholes
- Construction barriers & Cones
- Roadblocks & Fallen objects
- Uneven walking surfaces
- Waterlogged sections

### Honest Model Status: `NOT_TRAINED` (Deep Learning Weights)
In strict compliance with project guidelines ("*If training resources or data are unavailable, report that model as NOT TRAINED. Do not pretend the existing general object detector recognises these categories*"):
- **Training Pipeline Available:** `ml/pothole_detection/train_pothole_model.py` and `ml/pothole_detection/README.md`.
- **Dataset Required:** Road Damage Dataset (RDD2022 / GRDDC 2022, 40,000+ labeled images across India, Japan, US).
- **Target Weights:** `public/models/pothole/model.onnx` (YOLOv8n-RDD2022 export).
- **Live Status:** Reported honestly as `not_trained` in system health dashboards.

### Pavement Surface Anomaly Heuristic (Operational Fallback)
`analyzeRoadSurfaceHeuristic()` in `src/services/potholeDetection.ts`:
- Analyzes the lower 40% (ground plane) of the live camera feed.
- Evaluates gradient energy distributions and low-luminance depressions across Left, Centre, and Right pavement zones.
- Generates cautionary alerts without claiming certified defect detection:
  - *"Possible pothole or depression detected ahead. Exercise caution."*
  - *"Uneven pavement or road cracks detected on your left."*

### Strict Assistive Disclaimers
- Never claims that an undetected road is safe or clear.
- Explicitly states: Does not make road-crossing decisions; does not replace a white cane or guide dog.

