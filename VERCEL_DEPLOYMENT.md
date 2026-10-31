# NaviAble AI — Vercel HTTPS Deployment & Mobile Setup Guide

**Project Tagline:** Beyond Vision. Beyond Limits.  
**Framework:** Vite 8.3 + React 19 + TypeScript 7  
**Build Target:** Production Static Single Page Application (`dist`)  
**Deployment Platform:** [Vercel](https://vercel.com) (Automated HTTPS / SSL)

---

## 1. Why HTTPS is Mandatory for Mobile Camera Access

Modern mobile browsers enforce strict operating system and browser security policies:
- **Android Chrome:** Disables `navigator.mediaDevices.getUserMedia` when loaded over unencrypted HTTP (such as a local LAN IP `http://192.168.x.x:5173` or `http://10.x.x.x:5173`).
- **Apple iOS Safari:** Treats non-localhost HTTP as an insecure origin (`window.isSecureContext === false`) and immediately rejects camera requests.
- **Vercel's Role:** Deploying to Vercel provides a free, globally distributed edge CDN with **automatic SSL/TLS (HTTPS)** certificates. Once deployed to `https://<your-project>.vercel.app`, both Android Chrome and iOS Safari recognize the site as a trusted secure context and allow full camera hardware access.

---

## 2. Vercel Project Configuration

The project includes a root [`vercel.json`](file:///c:/Users/Sumit/OneDrive/Desktop/aii/vercel.json) file configured specifically for Vite, client-side routing, WebAssembly, and hardware APIs:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(self), microphone=(self), geolocation=(self)" }
      ]
    },
    {
      "source": "/assets/(.*)\\.wasm",
      "headers": [
        { "key": "Content-Type", "value": "application/wasm" },
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/models/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" },
        { "key": "Service-Worker-Allowed", "value": "/" }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Key Settings Explained:
1. **`buildCommand: "npm run build"`:** Runs `tsc -b && vite build` which validates TypeScript and bundles assets.
2. **`outputDirectory: "dist"`:** Points Vercel to Vite's compiled output directory.
3. **`rewrites: [{ source: "/(.*)", destination: "/index.html" }]`:** Prevents 404 errors when refreshing direct routes like `/dashboard`, `/proximity`, `/currency`, or `/ocr`.
4. **`Permissions-Policy: camera=(self), microphone=(self), geolocation=(self)`:** Explicitly permits camera, microphone, and GPS sensors on the deployed domain.
5. **`application/wasm` Header:** Ensures ONNX Runtime WebAssembly modules (`ort-wasm-simd-threaded.jsep-*.wasm`) are served with the correct MIME type for browser execution.

---

## 3. Step-by-Step Deployment Instructions

### Method A: Deploy via GitHub (Recommended)

1. **Push your latest changes to GitHub:**
   ```bash
   git add -A
   git commit -m "feat: configure Vercel HTTPS deployment and mobile camera support"
   git push origin test
   ```
   *(Or merge `test` into `main` if your Vercel project is connected to `main`).*

2. **Open Vercel Dashboard:**
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard) and sign in.
   - Click **"Add New..."** → **"Project"**.
   - Select your repository: `anirudhsharma5600-alt/NaviSight`.

3. **Configure Project Settings in Vercel:**
   - **Framework Preset:** `Vite` (automatically detected).
   - **Root Directory:** `./` (default).
   - **Build Command:** `npm run build` (override not needed, picked from `vercel.json`).
   - **Output Directory:** `dist` (override not needed, picked from `vercel.json`).
   - **Production Branch:** `test` (or `main`).

4. **Click Deploy:**
   - Vercel will clone the repository, run `npm install`, compile via `npm run build`, and deploy in ~45 seconds.
   - You will receive your production URL: `https://<your-project>.vercel.app`.

---

### Method B: Deploy via Vercel CLI

If you have Vercel CLI installed locally:

```bash
# 1. Install Vercel CLI globally (if not already installed)
npm install -g vercel

# 2. Login to your Vercel account
vercel login

# 3. Deploy directly from your workspace
cd c:\Users\Sumit\OneDrive\Desktop\aii
vercel --prod
```

---

## 4. Testing Mobile Camera & Assistive Features on a Real Phone

Once deployed to your HTTPS address (`https://<project>.vercel.app`):

### A. Android Testing (Google Chrome)
1. Open Chrome on your Android phone and navigate to `https://<project>.vercel.app`.
2. Tap **Vision** (`/dashboard`), **Proximity** (`/proximity`), or **Currency** (`/currency`).
3. Tap **"Start Camera"**.
4. Chrome will prompt: *"Allow <project>.vercel.app to use your camera?"*
5. Tap **Allow**.
6. **Rear Camera Check:** The system requests `{ facingMode: { ideal: "environment" } }`. The rear camera should activate immediately.
7. Tap **"Camera Telemetry"** / **"Diagnostics"** to view real-time resolution, active tracks, and live FPS.

### B. iPhone Testing (Apple Safari)
1. Open Safari on iOS and navigate to `https://<project>.vercel.app`.
2. Navigate to **Currency Reader** (`/currency`) or **Proximity Alerts** (`/proximity`).
3. Tap **"Start Camera"**.
4. iOS will show: *"<project>.vercel.app Would Like to Access the Camera"*.
5. Tap **Allow**.
6. **Inline Playback Check:** The video element renders smoothly inline without launching iOS full-screen native media player (powered by `playsinline` and `webkit-playsinline`).

### C. Person Proximity Warning Beep Test
1. Go to `/proximity` on your phone.
2. Tap **"Test Beep"** to confirm your phone's speaker plays the synthesized Web Audio tone.
3. Tap **"Start Camera"** and stand in front of the camera:
   - At a distance: Status shows `PERSON_DETECTED` (yellow badge).
   - As you walk closer: Status transitions to `PERSON_APPROACHING` (orange badge, double 800Hz beep).
   - Within close range: Status triggers `CRITICAL: PERSON VERY CLOSE` (red pulsing flasher, triple 1000-1250Hz alarm beep, haptic vibration, and voice alert: *"Warning! A person appears very close."*).

### D. Indian Currency Reader Test
1. Go to `/currency` on your phone.
2. Select your preferred speech language (**English**, **हिन्दी**, or **ਪੰਜਾਬੀ**).
3. Tap **"Start Camera"**.
4. Hold an Indian banknote (₹10, ₹20, ₹50, ₹100, ₹200, ₹500, or ₹2000) flat inside the on-screen alignment guide.
5. Tap **"Scan Note"**.
6. The ONNX MobileNetV3 deep learning engine extracts visual features, identifies the denomination, displays the confidence score, and speaks the recognized amount aloud.
7. Tap **"Repeat Scan"** to scan another note.

---

## 5. Deployment Verification Checklist

- [x] `vercel.json` created with SPA rewrite rule (`/(.*) -> /index.html`).
- [x] Security headers set (`Permissions-Policy` with camera/microphone/geolocation).
- [x] WebAssembly MIME type configured (`application/wasm`).
- [x] No hardcoded `http://` URLs for assets or APIs in source code.
- [x] No hardcoded `localhost` calls in production code.
- [x] Camera controller verified with `window.isSecureContext` check and fallback constraints.
- [x] ONNX Currency model (`model.onnx` + `model.onnx.data`) verified in `public/models/currency/`.
- [x] Production build passes locally: `npm run build` succeeds in ~4.0 seconds with 0 errors.
- [x] All 10 routes return HTTP 200 OK.

