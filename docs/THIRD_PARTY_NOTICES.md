# Third-Party Notices — NaviAble AI

This file lists all third-party libraries, models, and assets used in NaviAble AI,
along with their licenses and sources.

---

## Frontend Framework & Build

| Package | Version | License | Source |
|---------|---------|---------|--------|
| React | 19.x | MIT | https://github.com/facebook/react |
| React DOM | 19.x | MIT | https://github.com/facebook/react |
| React Router DOM | 7.x | MIT | https://github.com/remix-run/react-router |
| TypeScript | 7.x | Apache 2.0 | https://github.com/microsoft/TypeScript |
| Vite | 8.x | MIT | https://github.com/vitejs/vite |
| Tailwind CSS | 4.x | MIT | https://github.com/tailwindlabs/tailwindcss |

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
| TensorFlow.js (@tensorflow/tfjs) | Apache 2.0 | https://github.com/tensorflow/tfjs | Core ML runtime |
| COCO-SSD (@tensorflow-models/coco-ssd) | Apache 2.0 | https://github.com/tensorflow/tfjs-models | Object detection model |
| Tesseract.js | Apache 2.0 | https://github.com/naptha/tesseract.js | OCR text recognition |

### Model Weights

| Model | Training Data | License | Notes |
|-------|--------------|---------|-------|
| COCO-SSD MobileNet v2 | MS COCO Dataset | Apache 2.0 | Downloaded from TensorFlow CDN at runtime |
| Tesseract Language Data (eng/hin/pan) | Various public domain texts | Apache 2.0 | Downloaded from Tesseract CDN at runtime |

## Maps & Navigation

| Package | License | Source |
|---------|---------|--------|
| Leaflet | BSD-2-Clause | https://github.com/Leaflet/Leaflet |
| React Leaflet | MIT | https://github.com/PaulLeCam/react-leaflet |

### Map Tiles

| Service | License | Source |
|---------|---------|--------|
| OpenStreetMap Tiles | ODbL (data), CC-BY-SA 2.0 (tiles) | https://www.openstreetmap.org/ |

## UI Components

| Package | License | Source |
|---------|---------|--------|
| Lucide React | ISC | https://github.com/lucide-icons/lucide |

## Browser APIs Used

These APIs are built into modern browsers and require no additional licenses:

- **Web Speech API** (SpeechRecognition, SpeechSynthesis) — voice input/output
- **MediaDevices API** (getUserMedia) — camera and microphone access
- **Geolocation API** — GPS location for navigation
- **Canvas API** — image preprocessing and bounding box rendering
- **Clipboard API** — copy text to clipboard

---

## Privacy Statement

NaviAble AI processes all data locally in the user's browser:

- **Camera feed** is processed locally by TensorFlow.js. No frames are uploaded.
- **Voice commands** use the browser's built-in speech recognition. In Chrome, audio may be briefly processed by Google's servers for recognition (this is a browser behavior, not our application).
- **OCR processing** runs entirely in the browser via WebAssembly.
- **Location data** is used only for the local map display. No location tracking.
- **No user accounts, cookies, or analytics** are used in the MVP.

---

## Disclaimer

NaviAble AI is a hackathon prototype intended for demonstration purposes.
It should **NOT** be relied upon for safety-critical decisions.

- AI detections may be inaccurate or miss objects entirely.
- The system does **NOT** confirm whether a path is safe to walk.
- Always rely on human judgment, guide dogs, or certified assistive devices for real-world navigation.

