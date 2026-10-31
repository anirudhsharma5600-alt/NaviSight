# NaviAble AI 🌐👁️

### *Beyond Vision. Beyond Limits.*

An AI-powered accessibility platform that helps visually impaired individuals understand, navigate, and interact with the world around them — **entirely from their browser**.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)
![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-FF6F00?style=flat&logo=tensorflow&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-000000?style=flat&logo=three.js&logoColor=white)

---

## ✨ Features

| Feature | Description | Status |
|---------|------------|--------|
| 🎯 **AI Vision Dashboard** | Real-time object detection with COCO-SSD (80 classes), bounding boxes, position labels (LEFT / CENTRE / RIGHT), confidence scores | ✅ Live |
| 🎤 **Navi Voice Assistant** | Click-to-talk voice assistant with speech recognition, command parsing, and text-to-speech responses | ✅ Live |
| 📖 **Smart OCR Reader** | Capture text from camera or uploaded images using Tesseract.js, with read-aloud and copy functionality | ✅ Live |
| 🗺️ **Smart Navigation** | GPS location awareness with interactive OpenStreetMap, current coordinates, and center-on-me | ✅ Live |
| 🔮 **3D AI Orb** | Cinematic holographic orb with glowing rings, particles, and mouse-reactive animations (React Three Fiber) | ✅ Live |
| ♿ **Accessibility** | High contrast, keyboard navigation, screen reader labels, reduced motion support, large text | ✅ Live |
| 🛣️ **Road Intelligence** | Detect potholes, road barriers, construction obstacles | 🚧 Coming Soon |
| 🔊 **Sound Intelligence** | Environmental sound recognition (horns, doorbells, alarms) | 🚧 Coming Soon |

---

## 🔒 Privacy & Safety

- **100% client-side AI** — all processing happens in your browser
- **No data uploaded** — camera and microphone data never leaves your device
- **No API keys required** — completely free to use
- **No recordings stored** — frames are processed and immediately discarded
- **Safety disclaimer** — navigation data does not confirm a physically safe walking path

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and **npm** 9+
- **Chrome** or **Edge** browser (for Web Speech API support)

### Installation

```bash
git clone https://github.com/anirudhsharma5600-alt/NaviSight.git
cd NaviSight
npm install
```

### Development

```bash
npm run dev
```

Open **http://localhost:5173/** in your browser.

To test on your phone (same Wi-Fi network):

```bash
npm run dev -- --host
```

### Production Build

```bash
npm run build
npm run preview
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS 3 |
| **3D Graphics** | Three.js + React Three Fiber + Drei |
| **Animations** | Framer Motion |
| **Object Detection** | TensorFlow.js + COCO-SSD (MobileNet v2) |
| **OCR** | Tesseract.js v5 |
| **Voice** | Web Speech API (SpeechRecognition + SpeechSynthesis) |
| **Maps** | Leaflet + React-Leaflet + OpenStreetMap |
| **Icons** | Lucide React |

---

## 📁 Project Structure

```
src/
├── main.tsx                    # App entry point
├── App.tsx                     # Routes & layout
├── index.css                   # Global styles (glassmorphism, gradients)
│
├── components/                 # Reusable UI components
│   ├── Navbar.tsx              # Navigation bar with mobile menu
│   ├── Hero.tsx                # Hero section with 3D orb
│   ├── AIOrb.tsx               # Three.js holographic orb
│   ├── FeatureCard.tsx         # Glass-effect feature card
│   ├── Footer.tsx              # Footer
│   └── LoadingScreen.tsx       # Loading spinner
│
├── pages/                      # Route pages
│   ├── Home.tsx                # Landing page
│   ├── Dashboard.tsx           # AI Vision Dashboard
│   ├── VoiceAssistantPage.tsx  # Voice assistant
│   ├── OCRPage.tsx             # OCR reader
│   ├── NavigationPage.tsx      # GPS navigation
│   └── About.tsx               # About page
│
├── features/                   # Feature implementations
│   ├── vision/
│   │   ├── Camera.tsx          # Camera access component
│   │   └── DetectionOverlay.tsx # Bounding box renderer
│   ├── voice/
│   │   └── VoiceAssistant.tsx  # Navi assistant
│   ├── ocr/
│   │   └── OCRReader.tsx       # Tesseract.js OCR
│   └── navigation/
│       └── Navigation.tsx      # Leaflet map
│
└── services/                   # Core services
    ├── objectDetection.ts      # COCO-SSD model & inference
    └── speechService.ts        # TTS & scene description
```

---

## 🧪 Testing Guide

### AI Vision Dashboard (`/dashboard`)
1. Click **"Start Camera"** → allow camera
2. Point at objects (people, chairs, bottles, phones, laptops)
3. Watch bounding boxes appear with class names and positions
4. Click **"Describe Surroundings"** to hear spoken descriptions

### Voice Assistant (`/voice`)
1. Click the microphone button → allow microphone
2. Say **"Hello"** → Navi greets you
3. Say **"Help"** → lists available commands
4. Say **"Stop"** → stops speech output

### OCR Reader (`/ocr`)
1. Click **"Start Camera"** then **"Capture & Read"**
2. Or **"Upload Image"** with a photo of text
3. Click **"Read Aloud"** to hear the text

### Navigation (`/navigation`)
1. Allow location permission
2. Map shows your current position
3. Click **"Center on Me"** to re-center

---

## 📋 Common Issues

| Issue | Fix |
|-------|-----|
| Camera permission denied | Click lock icon in address bar → Allow Camera → Reload |
| Speech recognition not working | Use Chrome or Edge (Firefox/Safari have limited support) |
| 3D orb not showing | WebGL not supported — CSS fallback orb displays instead |
| AI model loading slowly | First load downloads ~4MB — cached after that |
| OCR inaccurate | Ensure good lighting and clear printed text |

---

## 📄 License

This project is built for educational and accessibility purposes.

---

*Built with ❤️ for accessibility*
