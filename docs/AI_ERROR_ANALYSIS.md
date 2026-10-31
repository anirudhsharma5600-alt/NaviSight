# NAVIABLE AI: DEEP AI ERROR ANALYSIS & ROOT CAUSE INVESTIGATION
**Document Version:** 3.1.0  
**Audit Scope:** Categories A through M  

---

## 1. Category A: Model Accuracy Errors

### The ₹100 False Positive Currency Anomaly
- **Investigation:** When inspecting the MobileNetV3-Small ONNX logits under neutral zero inputs, raw logits were:
  - `INR_10`: -0.209
  - `INR_20`: -0.339
  - `INR_50`: -0.061
  - `INR_100`: **+0.4725** (highest among all 7 banknote classes)
  - `INR_200`: -0.106
  - `INR_500`: -0.336
  - `INR_2000`: -0.192
  - `NEGATIVE`: +1.809
- **Root Cause:** In the baseline model, index 3 (`INR_100`) had a positive bias. In earlier iterations where the `NEGATIVE` class had insufficient weight or when Stage 1 allowed neutral objects to pass, `INR_100` was predicted with diffuse confidence around 57%.
- **Mathematical Correction:** Raised softmax threshold from $0.40 \to 0.75$, enforced class margin $\Delta p \ge 0.20$, and implemented Stage 1 spectral rejection.

---

## 2. Category D: Model Preprocessing Errors

### Camera Aspect Ratio Distortion
- **Issue:** Video streams from mobile rear cameras (typically 9:16 portrait) were being resized onto an offscreen canvas without aspect-ratio preservation.
- **Impact:** Vertical elongation caused people to appear artificially tall and thin in the tensor, leading to distorted height-ratio approximations and erratic proximity calculations.
- **Correction:** Implemented proportional downsampling preserving natural aspect ratio with letterboxing safeguards.

---

## 3. Category F: Inference Output Interpretation

### Softmax vs Open-Set Rejection
- **Issue:** Applying standard softmax across a closed set of banknote denominations forces probabilities to sum to 1.0, even when the visual input is completely unrelated.
- **Correction:** Formulated two-stage verification: Stage 1 serves as an open-set physical rejector; Stage 2 includes an explicit `NEGATIVE` class with an open-set threshold cutoff ($p < 0.75 \to \text{REJECT}$).

---

## 4. Category J & K: Voice Recognition & Repeated Announcements

### Acoustic Feedback Loop
- **Issue:** Web Speech `SpeechRecognition` remained active while the browser's `SpeechSynthesis` spoke, causing the microphone to capture assistant output as user commands.
- **Correction:** Integrated event-driven microphone suspension: `SpeechOutput.onSpeechStart` calls `SpeechInput.suspendListening()`, and `SpeechOutput.onSpeechEnd` resumes listening after a 250ms dissipation delay.

### Proximity Alert Flooding
- **Issue:** Proximity alerts lacked state-transition hysteresis and object-level debouncing, triggering spoken announcements for stationary individuals every 2.5 seconds.
- **Correction:** Implemented spatial crowd aggregation ($\ge 4$ persons) and an 8-second object-specific cooldown.

---

*End of Deep Error Analysis.*

