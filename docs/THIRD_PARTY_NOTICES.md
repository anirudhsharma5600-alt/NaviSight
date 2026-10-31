# Third-Party Notices — NaviAble AI

This file lists all third-party libraries, models, and assets used in NaviAble AI, along with their licenses and sources.

---

## Frontend Framework & Build

| Package | Version | License | Source |
|---------|---------|---------|--------|
| React | 19.x | MIT | https://github.com/facebook/react |
| React DOM | 19.x | MIT | https://github.com/facebook/react |
| React Router DOM | 6.x | MIT | https://github.com/remix-run/react-router |
| TypeScript | 7.x | Apache 2.0 | https://github.com/microsoft/TypeScript |
| Vite | 8.x | MIT | https://github.com/vitejs/vite |
| Tailwind CSS | 3.x | MIT | https://github.com/tailwindlabs/tailwindcss |
| Sharp | 0.35.x | Apache 2.0 | https://github.com/lovell/sharp |

## 3D & Animations

| Package | License | Source |
|---------|---------|--------|
| Three.js | MIT | https://github.com/mrdoob/three.js |
| React Three Fiber (@react-three/fiber) | MIT | https://github.com/pmndrs/react-three-fiber |
| Drei (@react-three/drei) | MIT | https://github.com/pmndrs/drei |
| Framer Motion | MIT | https://github.com/framer/motion |
| GSAP | Standard License (free for non-commercial) | https://greensock.com/gsap/ |

## AI / Machine Learning

| Package | License | Source | Notes |
|---------|---------|--------|-------|
| TensorFlow.js (@tensorflow/tfjs) | Apache 2.0 | https://github.com/tensorflow/tfjs | Core in-browser ML runtime |
| COCO-SSD (@tensorflow-models/coco-ssd) | Apache 2.0 | https://github.com/tensorflow/tfjs-models | Object detection model |
| Tesseract.js | Apache 2.0 | https://github.com/naptha/tesseract.js | In-browser OCR WASM runtime |

### Model Weights

| Model | Training Data | License | Notes |
|-------|--------------|---------|-------|
| COCO-SSD MobileNet v2 | MS COCO Dataset | Apache 2.0 | Downloaded from TensorFlow CDN at runtime |
| Tesseract Language Data (eng/hin/pan) | Public Domain texts | Apache 2.0 | Downloaded from Tesseract CDN at runtime |
| MobileNetV3-Small (Currency) | Indian Currency Dataset | MIT / Apache 2.0 | Architecture & pipeline in `ml/currency_recognition/` |
| YOLOv8n (Road Hazard) | RDD2022 Dataset | AGPL 3.0 / MIT | Architecture & pipeline in `ml/pothole_detection/` |

## Maps & Navigation

| Package | License | Source |
|---------|---------|--------|
| Leaflet | BSD-2-Clause | https://github.com/Leaflet/Leaflet |
| React Leaflet | MIT | https://github.com/PaulLeCam/react-leaflet |
| @types/leaflet | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |

### Map Tiles

| Service | License | Source |
|---------|---------|--------|
| OpenStreetMap Tiles | ODbL (data), CC-BY-SA 2.0 (tiles) | https://www.openstreetmap.org/ |

## UI Components

| Package | License | Source |
|---------|---------|--------|
| Lucide React | ISC | https://github.com/lucide-icons/lucide |

## Browser APIs Used

These native W3C APIs are built into modern browsers and require no external proprietary services:

- **Web Audio API** (AudioContext, OscillatorNode) — dynamic proximity frequency beeps
- **Vibration API** (navigator.vibrate) — directional haptic warning pulses
- **Web Bluetooth API** (navigator.bluetooth) — optional connection to ESP32 ToF sensors
- **Web Speech API** (SpeechRecognition, SpeechSynthesis) — voice command parsing and spoken synthesis
- **MediaDevices API** (getUserMedia) — video feed acquisition with rear-camera preference
- **Geolocation API** — GPS coordinates for local navigation
- **Service Worker API & Cache Storage** — PWA offline capability and static asset caching
- **Canvas API** — bounding box overlays and image preprocessing
