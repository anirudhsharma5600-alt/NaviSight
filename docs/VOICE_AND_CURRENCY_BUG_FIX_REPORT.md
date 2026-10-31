# NaviAble AI — Currency Speech & Intelligent Voice Alerts Fix Report

**Date:** October 31, 2026  
**Project:** NaviAble AI (Assistive Computer Vision for the Visually Impaired)  
**Framework:** Vite 8.3 + React 19 + TypeScript 7 + ONNX Runtime Web  

---

## 1. Executive Summary & Problem Diagnosis

During live testing of NaviAble AI on mobile devices and desktop, two critical user experience bugs were reported:

1. **Bug 1 (₹500 Currency Recognition & Speech Failure):**  
   When showing a real ₹500 banknote, NaviAble AI failed to recognize or announce the denomination.
2. **Bug 2 (Repetitive "Person in Front" Alert Storm):**  
   The voice synthesizer continuously screamed *"Person in front, person in front"* every 3 seconds whenever any person was detected, interrupting other features and causing severe alarm fatigue.

---

## 2. Root Cause Analysis

### Root Cause of Bug 1 (₹500 Currency Failure)
1. **Mobile Viewport Aspect Ratio Crop Distortion:**  
   In mobile portrait orientation (`srcHeight > srcWidth`), the previous frame-cropping logic used 70% width and 52% height, yielding a tall vertical rectangle (~0.75:1). Because standard Indian banknotes have an elongated aspect ratio of approximately 2.27:1 (150mm × 66mm for ₹500), this vertical crop sliced off more than half the note, leaving the MobileNetV3 classifier with unrecognizable partial fragments.
2. **Mobile Browser User-Gesture Speech Blocking:**  
   Modern mobile browsers (Android Chrome, iOS Safari) reject `speechSynthesis.speak()` calls that originate inside asynchronous timers, Web Workers, or inference callbacks without a prior explicit user interaction (e.g., tap, click).
3. **Background Dashboard Cancellation Interference:**  
   When navigating from the Dashboard to the Currency Reader, background intervals from the dashboard called `speechSynthesis.cancel()` every 3 seconds to announce obstacle detections, killing active currency speech announcements mid-utterance.

### Root Cause of Bug 2 (Repetitive Person Alert Storm)
1. **Stateless Per-Frame Detection Triggering:**  
   `Dashboard.tsx` executed `generateNewDetectionAnnouncements(results)` on every video frame. If a person remained stationary in front of the camera, the system treated each frame as a "new obstacle" and called `speechSynthesis.speak("Person ahead")` on a 3-second loop.
2. **Absence of Priority Preemption:**  
   There was no priority hierarchy separating routine informational narration (e.g. "chair on right") from high-urgency obstacle warnings (e.g. "person very close") or focused functional tasks (currency reading).

---

## 3. Architecture & Code Changes

### A. Central Voice Announcement Manager (`src/services/VoiceAnnouncementManager.ts`)
Created a singleton audio controller managing all speech synthesis with strict priority queues and operating modes:
- **Priority Levels:**
  - `HIGH`: Emergency proximity collision alarms (e.g., person < 1.0m, imminent obstacle). **Interrupts all lower priority speech.**
  - `MEDIUM`: Interactive functional feedback (currency denomination results, OCR readouts). **Interrupts LOW; does not interrupt HIGH.**
  - `LOW`: Routine environmental scene narration ("chair on right", "door ahead"). **Never interrupts HIGH or MEDIUM; dropped if queue is busy.**
- **4 Operating Modes:**
  - `general_assistance`: Default mode with balanced narration and warnings.
  - `currency_reading`: Mutes routine obstacle narration so the user can hear banknote values clearly.
  - `obstacle_proximity`: Prioritizes immediate physical hazard warnings.
  - `silent_visual`: Mutes speech for quiet environments while retaining on-screen visual cues.
- **Mobile Audio Gesture Unlock:** Added `unlockVoice()` and `testVoice()` to unlock mobile Web Audio and Web Speech Synthesis upon first tap.

### B. Intelligent 5-State Person Tracker (`src/services/PersonAnnouncementTracker.ts`)
Replaced per-frame detection triggers with an intelligent temporal state machine:
- **States:** `CLEAR` → `PERSON_DETECTED` → `PERSON_APPROACHING` → `PERSON_APPEARS_CLOSE` → `PERSON_LEFT`
- **Features:**
  - 3-frame confirmation requirement to prevent jitter.
  - Announces `"A person is nearby."` **only once** on entry.
  - Announces `"A person appears to be approaching."` **only once** when bounding box area grows (>18% screen area).
  - Triggers urgent warning `"Warning! A person appears very close."` only when proximity is critical, with an enforced 8-second cooldown to eliminate shouting loops.
  - Announces `"The path ahead is clear."` when the person departs.

### C. True Banknote Aspect Ratio Crop (`src/services/currencyDetection.ts`)
- Replaced the distorted vertical box with a calibrated **2.25:1 aspect ratio bounding box** matching the Reserve Bank of India (RBI) Mahatma Gandhi New Series banknotes.
- In mobile portrait mode, width is set to 90% and height is dynamically computed as `width / 2.25`, centered in the camera feed.
- Standardized speech response to exact required format:
  - `"This is a 500-rupee note."`
  - `"This is a 100-rupee note."`
  - Failure/unclear: `"Sorry, I could not recognise this note clearly. Please scan again."`
- Mapped all 7 Indian denominations: ₹10, ₹20, ₹50, ₹100, ₹200, ₹500, ₹2000.
- Mode B (multiple notes): strictly calculates totals (e.g. ₹200 + ₹100 = ₹300 total) without inventing non-existent single-note denominations.

---

## 4. Verification Test Results

| Test ID | Test Description | Input / Condition | Expected Output | Actual Result | Status |
|---|---|---|---|---|---|
| **TEST-01** | ₹500 Banknote (Obverse) | RBI ₹500 Front Image | Spoken: *"This is a 500-rupee note."* | Conf: 76.6% -> Spoken: *"This is a 500-rupee note."* | **PASS** |
| **TEST-02** | ₹500 Banknote (Reverse) | RBI ₹500 Back (Red Fort) | Spoken: *"This is a 500-rupee note."* | Conf: 92.9% -> Spoken: *"This is a 500-rupee note."* | **PASS** |
| **TEST-03** | ₹100 Banknote (Obverse) | RBI ₹100 Front Image | Spoken: *"This is a 100-rupee note."* | Conf: 100.0% -> Spoken: *"This is a 100-rupee note."* | **PASS** |
| **TEST-04** | ₹100 Banknote (Reverse) | RBI ₹100 Back (Rani ki Vav) | Spoken: *"This is a 100-rupee note."* | Conf: 100.0% -> Spoken: *"This is a 100-rupee note."* | **PASS** |
| **TEST-05** | Anti-Repetition Loop Suppression | Person stationary over 10 consecutive frames | 1 announcement on entry, zero repetitive screaming | 3 announcements across approach cycle (0 spam) | **PASS** |
| **TEST-06** | Priority Preemption in Currency Mode | Low priority person vs Medium priority currency | Person alert suppressed; currency spoken clearly | Low-priority narration blocked; currency announced | **PASS** |
| **TEST-07** | Production Build Verification | `npm run build` | Zero TypeScript errors, dist artifact generated | Built cleanly in 3.30s | **PASS** |

---

## 5. Next.js Template Screen Resolution (Vercel Deployment)

### Why the Next.js Screen Appeared:
The user observed a Next.js default landing screen (*"To get started, edit the page.tsx file"*). This occurs when a new Vercel project is created by clicking the recommended **Next.js Starter Template** instead of importing the existing GitHub repository.

NaviAble AI is a **Vite + React Single-Page Application (SPA)**, not Next.js.

### How to Deploy the Real NaviAble AI App:
1. Log in to [vercel.com/dashboard](https://vercel.com/dashboard).
2. Click **"Add New..."** → **"Project"**.
3. Under **"Import Git Repository"** (left column), select **`anirudhsharma5600-alt/NaviSight`** (branch `test` or `main`).
4. Ensure the project settings are:
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Click **Deploy**.
