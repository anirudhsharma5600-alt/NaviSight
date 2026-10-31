# NaviAble AI: Safety Disclaimers, Ethical Bounds & Operating Limitations

**Document Version:** 2.0.0  
**Effective Date:** October 31, 2026  
**Target Audience:** Visually Impaired Users, Caregivers, Orientation & Mobility Specialists, Software Engineers  
**Regulatory Category:** Non-Medical Assistive Software Prototype (Class I / Assistive Tech Exploratory Aid)

---

## 1. Absolute Mandatory Safety Disclaimers

> [!CAUTION]
> **NAVIABLE AI IS AN EXPERIMENTAL ASSISTIVE PROTOTYPE. IT IS NOT A LIFE-SAFETY SYSTEM, CERTIFIED MEDICAL DEVICE, OR REPLACEMENT FOR PRIMARY MOBILITY TOOLS.**

### 1.1 Never Replace Primary Mobility Aids
NaviAble AI must **NEVER** be used as a replacement for:
1. **The Long White Cane (White Cane Mobility)**: A white cane provides immediate physical tactile feedback of ground elevation changes, drop-offs, steps, curbs, water puddles, and tactile ground indicators. NaviAble cannot provide mechanical physical support or guarantee step-down detection.
2. **Trained Guide Dogs**: Guide dogs possess biological spatial awareness, obstacle avoidance, dynamic path planning, and disobey commands if danger is imminent (intelligent disobedience). NaviAble has no physical agency.
3. **Formal Orientation & Mobility (O&M) Training**: Independent travel skills, sensory alignment, mental mapping, and street-crossing techniques taught by certified O&M specialists remain paramount.
4. **Human Guide Assistance**: When navigating high-speed traffic, complex construction zones, or unfamiliar hazardous terrain, human sighted guide assistance must be sought.

---

## 2. Hard System Boundaries: What NaviAble AI Will NEVER Do

To protect user safety and eliminate false confidence, NaviAble AI enforces strict algorithmic boundaries:

1. **NEVER Make Street-Crossing Decisions**:
   - The application will **NEVER** instruct a user to *"cross now"* or certify that an intersection is safe. Street crossing requires multi-sensory environmental listening and vehicle velocity perception beyond the capabilities of a single smartphone camera.
2. **NEVER Guarantee an Obstacle-Free Path**:
   - Low camera frame rates (10–15 FPS on mobile), motion blur, camera tilt, blind spots outside the camera lens angle (typically $< 80^\circ$ FOV), and low-hanging tree branches mean obstacles can be missed.
3. **NEVER Announce Uncalibrated Metric Distance**:
   - Monocular camera vision cannot determine physical metric distances (e.g., *"1.2 metres"*). Optical detections are strictly announced as **qualitative relative zones** (*"far"*, *"nearby"*, *"very close"*). Metric measurements are displayed only when an external calibrated Time-of-Flight (ToF) hardware sensor is physically connected.
4. **NEVER Authenticate Banknote Counterfeit Status**:
   - NaviAble's banknote classifier identifies printed optical denominations (e.g., ₹10, ₹50, ₹500). It does **NOT** inspect watermark UV fibers, intaglio micro-printing, or magnetic thread security features. Denominations are spoken with probabilistic wording (*"This appears to be a 500-rupee note."*).
5. **NEVER Equate Silence with Safety**:
   - The absence of an announcement does **NOT** mean an area is safe or clear. Users must continue using active white cane scanning at all times.

---

## 3. Communication of Uncertainty & Probabilistic Phrasing

Assistive AI that presents statistical guesses as absolute facts creates dangerous overconfidence. NaviAble implements explicit uncertainty phrasing:

| Subsystem | Confidence Range | System Verbal Output | Safety Behavior |
|---|---|---|---|
| **Banknote Recognition** | $\ge 80\%$ | *"This appears to be a [N]-rupee note."* | Confirmed probabilistic identification |
| **Banknote Recognition** | $60\% - 79\%$ | *"This may be a [N]-rupee note, but lighting is low. Please verify."* | Warns user of ambient degradation |
| **Banknote Recognition** | $< 60\%$ | *"Could not clearly recognise the currency note. Please adjust lighting or bring note closer."* | Completely refuses to guess |
| **Road Hazard** | Heuristic Detection | *"Caution! Possible road irregularity or surface hazard ahead."* | Alerts to slow down and use cane |
| **General Vision** | Below Threshold | Remains completely silent | Suppresses low-confidence visual noise |

---

## 4. Environmental & Hardware Limitations

| Operational Condition | Environmental Impact | System Status | User Action Required |
|---|---|---|---|
| **Low-Light / Night (< 15 lux)** | Severe sensor noise, dropped frame rate, loss of edge contrast | `FAIL` | Turn on camera flashlight or avoid relying on camera vision |
| **Direct Sunlight Glare** | Specular lens flare, blown-out highlights | `PARTIALLY WORKING` | Shield camera lens with hand |
| **Heavy Rain / Water Drops** | Droplets on camera lens distort optical refraction | `FAIL` | Wipe camera lens; rely entirely on white cane |
| **High Camera Motion Blur** | Rapid walking or swinging phone corrupts bounding boxes | `PARTIALLY WORKING` | Mount smartphone in chest harness or hold steadily forward |
| **Mobile Screen Lock (Sleep)** | iOS and Android browsers suspend Web Speech and Camera feeds | `FAIL` | Keep screen awake; use provided persistent awake lock |
| **Thermal Throttling** | Sustained neural inference on phone heats up CPU/GPU | `PASS` | Frame throttled to 8 FPS to prevent device shutdown |

---

## 5. User Privacy & On-Device Data Safeguards

NaviAble is engineered to protect user privacy in private and public spaces:
1. **100% On-Device Neural Processing**:
   - MobileNetV2 COCO-SSD object detection runs locally in the browser via WebGL / WebAssembly.
   - MobileNetV3 banknote classification runs locally via `onnxruntime-web` WebAssembly SIMD.
   - Tesseract OCR runs locally in a dedicated client-side Web Worker.
   - **Zero video frames, camera captures, or photos are uploaded to any external server.**
2. **Instant Emergency Controls**:
   - **Stop Camera**: Dedicated red control shuts down the camera hardware track immediately (`stream.getTracks().forEach(t => t.stop())`).
   - **Stop Microphone**: Disables Web Speech recognition and audio stream capture.
   - **Stop All Audio**: Halts all spoken announcements within 5 ms.
3. **No Biometric Identification**:
   - Pedestrian tracking extracts only spatial bounding boxes. No facial recognition, facial landmark analysis, age, gender, or biometric identification is performed.
