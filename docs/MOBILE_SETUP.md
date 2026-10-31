# NaviAble AI — Mobile Setup & Deployment Guide

**Project:** NaviAble AI — Beyond Vision. Beyond Limits.  
**Platform:** Progressive Web App (PWA) on Mobile (Android & iOS)

---

## 1. Quick Start: Testing Over Local Wi-Fi (LAN)

### Step 1: Start the Development Server
Run the dedicated LAN script:
```bash
npm run dev:lan
```
Vite will bind to `0.0.0.0:5173` and output your local IPv4 address (e.g., `http://192.168.1.15:5173/`).

### Step 2: Connect Mobile Device
1. Connect your smartphone to the **same Wi-Fi network** as your development machine.
2. Open Chrome (Android) or Safari (iOS).
3. Navigate to: `http://<YOUR_LOCAL_IP>:5173` (e.g. `http://192.168.1.15:5173`).

---

## 2. Camera Access Requirements: HTTPS

Modern mobile browsers (Chrome on Android, Safari on iOS) enforce strict security policies:
> **getUserMedia and Camera access require a Secure Context (HTTPS or localhost).**

To test camera features on mobile devices without deploying to a public host:

### Option A: Local Tunnel (Recommended & Free)
Use `localtunnel` to create an instant public HTTPS forwarder:
```bash
npx localtunnel --port 5173
```
Copy the generated `https://xxxx.loca.lt` URL into your mobile browser.

### Option B: Cloudflare Tunnel (Zero-configuration)
```bash
npx cloudflared tunnel --url http://localhost:5173
```
Use the provided `https://xxxx.trycloudflare.com` URL.

### Option C: Vite HTTPS with @vitejs/plugin-basic-ssl
```bash
npx vite --host 0.0.0.0 --https
```
Accept the self-signed certificate warning on your mobile browser.

---

## 3. Installing as a Progressive Web App (PWA)

NaviAble AI includes a full PWA manifest and service worker configuration:

### On Android (Google Chrome)
1. Navigate to the website in Chrome.
2. A banner prompt will appear: **"Add NaviAble AI to Home screen"**.
3. If the prompt does not automatically display, tap the three-dot menu `(⋮)` in the top right.
4. Select **"Install app"** or **"Add to Home screen"**.
5. The application will launch in standalone full-screen mode with native app performance.

### On iOS (Apple Safari)
1. Open the website in Safari.
2. Tap the **Share** button (box with an upward arrow at the bottom).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **Add** in the top right corner.
5. Launch NaviAble AI from your iOS home screen as an independent app.

---

## 4. Mobile Hardware & Accessibility Optimizations

- **Preferred Camera:** The camera system requests `facingMode: "environment"` by default to utilize the rear camera, enabling users to scan their forward-facing path while walking.
- **Touch Targets:** All primary interactive controls are sized at a minimum of `48×48px` to ensure effortless interaction for visually impaired users.
- **Haptic Feedback:** On Android devices with vibration motor support, proximity alarms activate distinct tactile vibration sequences matching warning severity.
- **Audio Autoplay:** To comply with browser audio policies, tap the screen once or toggle the audio button to initialize the Web Audio API context for proximity beeps.
