# NaviAble AI — Safety & Accessibility Guide

**Project:** NaviAble AI — Beyond Vision. Beyond Limits.  
**Last Updated:** October 31, 2026

---

## ⚠️ Important Safety Disclaimers

### General
NaviAble AI is an **assistive technology prototype**. It is designed to provide supplementary information about surroundings and should **never** be relied upon as the sole means of navigation, obstacle avoidance, or safety.

### Object Detection
- AI object detection is **not 100% accurate**. Objects may be missed, misidentified, or detected with incorrect positions.
- Detection accuracy depends on lighting conditions, camera quality, object size, and angle.
- **Never assume an area is clear** because the AI did not detect obstacles.
- The system detects objects visible in the camera frame only — it cannot see behind, above, or below the camera's field of view.

### Proximity Alerts
- Camera-based proximity estimation uses **bounding box area heuristics** and does not provide exact distances.
- Proximity zones (NEAR, MEDIUM, FAR) are **approximate** and should not be treated as precise measurements.
- The system cannot detect transparent obstacles (glass doors, windows), very thin objects (wires, cables), or objects outside the camera frame.
- When an optional hardware distance sensor is connected, readings are more accurate but still limited by the sensor's range and field of view.
- **Do not rely on proximity alerts for safety-critical navigation.** Always use a cane, guide dog, or sighted guide as your primary mobility aid.

### Currency Recognition
- Currency identification is **approximate**. The system identifies the apparent denomination based on visual features.
- It **cannot verify authenticity** or detect counterfeit notes.
- **Do not use this system for financial verification** or transactions requiring certainty.
- Accuracy depends on note condition, lighting, camera quality, and model training.
- The model currently recognizes Indian Rupee denominations only.

### Road Hazard / Pothole Detection
- Road hazard detection is **experimental**.
- **Never assume a road section is safe** because the AI did not detect hazards.
- Detection depends on camera angle, lighting, road surface contrast, and model training.
- The system cannot detect all types of road hazards, especially those that are wet, partially covered, or very shallow.
- Always exercise caution while walking or driving, regardless of AI analysis.

### OCR / Text Reading
- Text recognition accuracy varies based on font, size, contrast, lighting, and image quality.
- The system may misread characters, especially in handwritten text, unusual fonts, or low-contrast conditions.
- **Do not rely on OCR for critical information** such as medication labels, legal documents, or emergency instructions without human verification.

### Voice Assistant
- Speech recognition accuracy depends on ambient noise, accent, speaking speed, and browser support.
- The system may misinterpret commands. Always verify actions.
- Voice output uses the browser's text-to-speech engine, which varies in quality across devices.

### Navigation
- Map data is provided by OpenStreetMap contributors and may be incomplete or outdated.
- Route planning is a supplementary feature. **Do not rely on it as your sole navigation method.**
- GPS accuracy varies by device and environment (indoor, urban canyons, etc.).

---

## Accessibility Features

### Screen Reader Compatibility
- All interactive elements have `aria-label` attributes.
- Buttons clearly describe their function.
- Status changes are announced via `aria-live` regions where applicable.
- Semantic HTML is used throughout (headings, nav, main, sections).

### Keyboard Navigation
- All controls are keyboard-accessible.
- Focus indicators are visible.
- Tab order follows logical reading order.

### Voice Interaction
- Voice commands allow hands-free operation.
- All visual detections are described verbally.
- Speech can be paused, resumed, or repeated.

### Visual Design
- High contrast text (white on dark navy background).
- Color is never the sole indicator of status — text labels accompany all colored indicators.
- Large touch targets (minimum 44×44px) for mobile accessibility.
- Reduced motion support: System `prefers-reduced-motion` is respected in animations.

### Audio Alerts
- Alerts can be toggled on/off independently.
- Volume is adjustable.
- Vibration is available as an alternative (where supported).
- Cooldowns prevent overwhelming audio output.

---

## Emergency Procedures

### Emergency Stop
- Press the "Stop Camera" button to immediately halt all detection.
- Say "stop" or "stop camera" to the voice assistant.
- Close the browser tab to stop all processing immediately.

### If You Feel Unsafe
1. Stop using the app immediately.
2. Use your primary mobility aid (cane, guide dog).
3. Ask for human assistance.
4. Call emergency services if needed.

---

## Data Privacy

- **No data is uploaded to any server.** All AI processing happens locally in your browser.
- Camera frames are processed in real-time and never stored or transmitted.
- No user accounts, tracking, or analytics are implemented.
- Voice commands are processed by your browser's built-in speech recognition.
- The only network requests are for loading AI model weights (one-time) and map tiles (OpenStreetMap).

---

## Hardware Requirements

### Minimum
- Any modern smartphone or laptop with a camera
- Chrome, Edge, or Safari browser (latest version)
- 2 GB free RAM

### Recommended
- Device with GPU (for faster AI inference)
- WebGPU-capable browser
- Rear-facing camera (for mobile use)
- HTTPS connection (required for camera access on mobile)

### Optional Hardware
- ESP32 microcontroller with ToF distance sensor (for hardware proximity detection)
- Bluetooth-capable device (for sensor connection)

---

## Compliance Notes

- This application is designed to **assist** visually impaired users, not replace professional assistive devices or trained professionals.
- The AI models used are open-source and freely available.
- No personal data is collected, stored, or transmitted.
- The application follows WCAG 2.1 guidelines where applicable.

