# NaviAble AI — Mobile Testing Setup

## Quick Start (LAN Testing)

### Step 1: Start the dev server with LAN access
```bash
npm run dev:lan
```

### Step 2: Find your computer's IP address
- Windows: Open Command Prompt, type `ipconfig`, look for "IPv4 Address"
- Example: `192.168.1.5`

### Step 3: Open on your phone
- Connect your phone to the SAME Wi-Fi network
- Open Chrome/Safari on your phone
- Go to: `http://192.168.1.5:5173`

### Important: HTTPS for Camera Access
Mobile browsers require HTTPS for camera/microphone access.
For local testing, you have two options:

**Option A: Use Vite's built-in HTTPS (Recommended for testing)**
```bash
npx vite --host 0.0.0.0 --https
```
Accept the self-signed certificate warning on your phone.

**Option B: Use a tunnel service**
```bash
npx localtunnel --port 5173
```

## Installing as PWA

### Android (Chrome)
1. Open the site in Chrome
2. Tap the three-dot menu
3. Select "Add to Home screen" or "Install app"
4. The app will appear on your home screen

### iOS (Safari)
1. Open the site in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
4. Tap "Add"

## Troubleshooting
- **Camera not working**: Ensure HTTPS or localhost
- **Black screen**: Allow camera permissions when prompted
- **No sound**: Tap the screen first (browsers require user interaction for audio)
- **Slow detection**: Reduce detection interval in Settings
