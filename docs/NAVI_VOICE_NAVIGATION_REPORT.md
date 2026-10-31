# NAVI Voice Navigation System Report — Pedestrian Assistive Mobility

**System:** NaviAble AI Assistive Platform  
**Feature:** NAVI Voice Navigation Engine (Pedestrian GPS Turn-by-Turn Guidance)  
**Date:** November 2026  
**Status:** Implemented, Tested, Built, and Verified (Production Ready)  

---

## Executive Summary

The **NAVI Voice Navigation System** is a real-time, GPS-based pedestrian walking navigation engine integrated seamlessly into the NaviAble AI application. Designed specifically for visually impaired, blind, and low-vision users, the system prioritizes **physical safety, conservative mobility decisions, continuous hands-free voice guidance, and high-contrast accessible visual presentation**.

Unlike general automotive navigation apps (e.g., Google Maps Driving, Apple Maps), this system **strictly enforces pedestrian routing** via dedicated walking network profiles, continuously filters and monitors GPS signal uncertainty, cross-correlates front camera computer vision obstacle detections with walking progress, and provides a built-in interactive laptop simulator for offline and bench testing.

---

## 1. System Architecture

```
                                  [ User Voice Input ]
                                           │
                                  [ IntentClassifier ]
                             (Semantic regex & token matching)
                                           │
                                  [ CommandExecutor ]
                                           │
                      ┌────────────────────┴────────────────────┐
                      ▼                                         ▼
            [ geocodingService ]                       [ navigationEngine ]
      (Nominatim OSM Geocoding / Search)               (Central Navigation SM)
                      │                                         ▲
                      ▼                                         │
        [ PedestrianRoutingService ]                            │
   (GraphHopper foot / OSRM routed-foot) ───────────────────────┘
                                           │
                   ┌───────────────────────┼───────────────────────┐
                   ▼                       ▼                       ▼
           [ MapLibreView ]      [ Obstacle Pipeline ]    [ SmartAnnouncementManager ]
      (MapLibre GL JS + OSM)     (COCO Detections / CV)   (Spoken Turn Instructions)
```

The system operates across three decoupled, asynchronous layers:

1. **Routing & Spatial Layer:** Resolves places via OpenStreetMap Nominatim, computes strictly non-motorized pedestrian paths via GraphHopper/OSRM, and performs vector geometry projections using Turf.js (`@turf/turf`).
2. **State & Progress Machine (`navigationEngine`):** Coordinates device Geolocation (`watchPosition`), heading tracking, turn threshold detection (60m approach, 25m immediate turn, 8m step advance), 3-sample off-route hysteresis recalculation, and GPS accuracy filtering.
3. **Audio-Haptic & Visual Output:** Emits clear, prioritized speech announcements via the authoritative `SmartAnnouncementManager` (priority preemption, queue debouncing, trilingual voice selection), paired with haptic vibration sequences (`navigator.vibrate`) and an accessible, high-contrast MapLibre GL map.

---

## 2. Core Libraries & Dependencies

| Library / Tool | Version | Purpose in Navi Voice Navigation |
|---|---|---|
| `maplibre-gl` | `^6.16.0` | Open-source vector/raster WebGL map rendering. Configured with OpenStreetMap raster tiles, high-contrast walking paths, pulsing location dot, and destination pins. |
| `@turf/turf` | `^7.4.0` | Geospatial analysis suite: `pointToLineDistance`, `nearestPointOnLine`, `distance`, `bearing`, and line-slice calculations for distance-to-turn computations. |
| `OpenStreetMap Nominatim` | REST API | Geocoding and reverse geocoding with 1-second rate-limiting throttle, query debouncing, and local in-memory coordinate caching. |
| `GraphHopper Routing API` | REST API | Primary pedestrian routing engine using `profile=foot` and walking-specific elevation/sidewalk network graphs. |
| `OSRM Foot Routing` | REST API | Secondary zero-key open fallback routing engine using `/routed-foot/route/v1/walking/`. |
| `SmartAnnouncementManager` | Internal | Authoritative audio broker managing priority preemption (HIGH for obstacles and GPS loss, MEDIUM for turn directions, NORMAL for summaries). |

---

## 3. Pedestrian Routing Profile Verification

### Strict Non-Motorized Path Guarantee
Automotive driving profiles route pedestrians onto limited-access highways, motorways, elevated flyovers, and arterial roads that lack pedestrian sidewalks or crosswalks. This is hazardous for visually impaired travelers.

1. **GraphHopper Pedestrian Verification:**
   - Parameter: `profile=foot`
   - Target URL format: `https://graphhopper.com/api/1/route?point={lat},{lng}&point={dlat},{dlng}&profile=foot&points_encoded=false&locale=en`
   - Explicitly rejects `car`, `motorcycle`, and `truck` profiles.
2. **OSRM Pedestrian Fallback Verification:**
   - Endpoint: `https://routing.openstreetmap.de/routed-foot/route/v1/walking/{lng},{lat};{dlng},{dlat}?overview=full&geometries=geojson&steps=true`
   - The `/routed-foot/` backend and `/walking/` service guarantee calculation over pedestrian paths, sidewalks, footways, and living streets.
3. **Automated Unit Verification:**
   - Verified in `scripts/test_voice_navigation.cjs` (PASS).

---

## 4. GPS Tracking, Accuracy Guard & Update Loop

### Tracking Loop Details
- Method: `navigator.geolocation.watchPosition(success, error, options)`
- Options configured:
  - `enableHighAccuracy: true` (engages onboard satellite GNSS rather than cell-tower triangulation).
  - `maximumAge: 1000` ms (ensures fresh spatial fixes).
  - `timeout: 10000` ms.
- Fallback: Gracefully switches to simulated GPS positioning when running on laptops or when GPS hardware is unavailable.

### GPS Accuracy Filtering & Uncertainty Guard
```
GPS Fix Received (coords.accuracy in meters)
   │
   ├─── accuracy <= 15m ──> EXCELLENT: Full guidance active
   ├─── accuracy <= 35m ──> ACCEPTABLE: Full guidance active
   └─── accuracy > 35m  ──> DEGRADED / UNCERTAIN:
                              • Triggers HIGH priority speech warning:
                                "Your location signal is uncertain. Please pause and verify your position."
                              • Suppresses premature turn step advancement to prevent wrong turns.
                              • Displays amber warning badge on navigation UI.
```

---

## 5. Turn-by-Turn Guidance & Haptic Cues

### Spatial Projection & Thresholds
Turf.js calculates the user's distance along the route segment to the upcoming turn vertex:
- **60 Metres (Advance Preparation):** NAVI announces: *"In 60 metres, turn left onto Park Avenue."*
- **25 Metres (Immediate Turn Alert):** NAVI announces: *"In 25 metres, turn left onto Park Avenue."*
  - Haptic pattern triggered: `[150, 100, 150]` ms double-vibration.
- **8 Metres (Step Completion & Advancement):** NAVI advances to the next route step and states the new direction.
  - Arrival threshold: Within 8 metres of the final destination coordinate, NAVI transitions to `ARRIVED`:
    *"You have arrived at your destination."* (Single long 400ms haptic buzz).

---

## 6. Hysteresis & Off-Route Recalculation Strategy

Transient GPS jitter (such as reflections from tall buildings or passing buses) can temporarily jump a GPS fix 30 to 50 metres off the actual sidewalk. Triggering immediate rerouting on a single bad sample creates confusion and audio spam.

### 3-Sample Hysteresis State Machine
1. Deviation threshold: User's perpendicular distance to the active route line > **40 metres**.
2. **Sample 1:** Counter = 1. State remains `NAVIGATING`. No speech interruption.
3. **Sample 2:** Counter = 2. State remains `NAVIGATING`. No speech interruption.
4. If a valid fix is received (<40m), Counter resets to 0.
5. **Sample 3 (Confirmed Off-Route):** Counter = 3.
   - State transitions to `RECALCULATING`.
   - Spoken announcement: *"You appear to be off route. Recalculating walking directions."*
   - Asynchronously queries pedestrian routing engine from the current coordinates to the active destination.
   - Reloads new route geometry and resumes guidance.

---

## 7. Multilingual Voice Assistant Commands

All 11 voice navigation intents are registered in `CommandRegistry.ts`, classified in `IntentClassifier.ts`, and executed in `CommandExecutor.ts`:

| Intent Name | Example English Commands | Example Hindi / Hinglish Commands | Spoken Action Taken |
|---|---|---|---|
| `navigation.start` | *"Start navigation"*, *"Begin walking route"* | *"Navigation shuru karo"*, *"Chalo shuru karo"* | Starts active GPS tracking & guidance. |
| `navigation.stop` | *"Stop navigation"*, *"Cancel route"* | *"Navigation band karo"*, *"Rasta roko"* | Halts navigation and resets to IDLE. |
| `navigation.pause` | *"Pause navigation"*, *"Hold on"* | *"Ruk jao"*, *"Navigation pause karo"* | Suspends turn alerts and position updates. |
| `navigation.resume` | *"Resume navigation"*, *"Continue route"* | *"Phir se shuru karo"*, *"Aage badho"* | Resumes active turn tracking. |
| `navigation.setDestination` | *"Navigate to Central Park"*, *"Take me to library"* | *"India Gate le chalo"*, *"Metro station chalo"* | Geocodes target, calculates route, reports distance and duration. |
| `navigation.repeatInstruction` | *"Repeat direction"*, *"What did you say?"* | *"Kya bola"*, *"Dobara bolo"* | Repeats the immediate turn instruction with remaining metres. |
| `navigation.currentLocation` | *"Where am I according to GPS?"*, *"Current location"* | *"Main kahan hoon"*, *"Mera location kya hai"* | Reverse geocodes nearest landmark and reports GPS accuracy. |
| `navigation.remainingDistance` | *"How far is the destination?"*, *"Remaining distance"* | *"Kitni door hai"*, *"Kitna time bacha hai"* | Reports distance (km/m) and estimated walk time in minutes. |
| `navigation.nextTurn` | *"What is the next turn?"*, *"Upcoming turn"* | *"Agla turn kaun sa hai"*, *"Agla mod"* | States direction and metres to next turn. |
| `navigation.recalculateRoute` | *"Recalculate route"*, *"Wrong way"* | *"Naya rasta banao"*, *"Reroute"* | Manually forces recalculation from current position. |
| `navigation.help` | *"Navigation help"*, *"Walking commands"* | *"Navigation help"*, *"Raste ke commands"* | Lists available walking voice commands. |

---

## 8. Obstacle Awareness Integration & Audio Safety Priority

The navigation engine connects with the live object detection pipeline (`getLatestDetections()`) to warn users of immediate hazards in their path:

1. **Monitored Obstacles:** `person`, `car`, `motorcycle`, `bicycle`, `bus`, `truck`, `traffic cone`, `pole`, `stairs`.
2. **Multi-Frame Confirmation:** Requires at least 2 consecutive detections with confidence >= 0.65 to eliminate transient false positives.
3. **Temporal Debounce:** Minimum **8-second cooldown** between obstacle alerts.
4. **Authoritative Audio Hierarchy:**
   - Obstacle alerts are dispatched as **HIGH priority** to `SmartAnnouncementManager`.
   - HIGH priority speech immediately suspends routine turn instructions so the user is warned of an obstacle before taking another step.

---

## 9. Laptop Testing Simulation Mode

For developers or testers evaluating the application on a desktop or laptop without GPS hardware, the dashboard features an interactive **Route Simulator**:

1. **Destination Auto-Mapping:** Select any preset destination (e.g., *"Central Library"*, *"Metro Station"*, or type any custom landmark).
2. **Simulation Controls:**
   - **Start Simulation:** Generates synthetic GPS coordinate fixes at 1 Hz advancing step-by-step along the route geometry.
   - **Speed Multiplier:** Toggle between **1x (1.2 m/s normal walk)**, **2x (brisk walk)**, and **4x (fast forward)**.
   - **Simulate Off-Route Deviation:** Shifts simulated coordinates 60 metres away from the line to observe the 3-sample hysteresis and recalculation sequence.
3. **Dual Map & Card Visualization:** Watch the pulsing marker traverse the MapLibre map with turn countdowns, haptic indicators, and real speech synthesis.

---

## 10. Mobility Safety Disclaimers & Conservative Behavior

> [!IMPORTANT]
> **Strict Mobility Safety Policy:**
> NaviAble AI is an assistive experimental prototype. It does **not** certify that a roadway, crosswalk, or path is clear of obstacles or traffic.

1. **Forbidden Speech Phrases:**
   - The engine is hardcoded **never** to say *"the road is safe"*, *"it is safe to cross"*, *"cross now"*, or *"the path is clear"*.
2. **Prominent UI & Screen-Reader Disclaimer:**
   - Displayed prominently in bold amber on the navigation dashboard:
     *"Safety Notice: Navigation is an assistive aid. Always use your white cane, guide dog, and personal judgment when walking or crossing roads. NAVI cannot guarantee clear walkways or absence of traffic."*
3. **Aria Announcements:**
   - Step directions and alerts use `role="status"` and `aria-live="assertive"` for screen-reader compatibility with TalkBack and VoiceOver.

---

## 11. Verification & Test Results

| Test Suite | File | Tests Run | Result | Notes |
|---|---|---|---|---|
| **Voice Navigation Test** | `scripts/test_voice_navigation.cjs` | 14 / 14 | **PASSED (100%)** | OSRM/GH foot profiles, Turf math, state machine, hysteresis, GPS guard, obstacle cooldown, 11 intents. |
| **Comprehensive AI Regression** | `scripts/run_regression_tests.cjs` | 25 / 25 | **PASSED (100%)** | Object detection, currency two-stage, crowd intelligence, pothole heuristics, model registry. |
| **Currency Fix Verification** | `scripts/test_currency_fix.cjs` | 40 / 40 | **PASSED (100%)** | ₹100 & ₹500 modern/legacy recognition + 30 hard-negative rejections. |
| **Voice Assistant 3.0** | `scripts/test_voice_assistant_3.cjs` | 22 / 22 | **PASSED (100%)** | 20 voice scenarios, silence fast-path, deduplication, offline fallback. |
| **Production Build** | `npm run build` | 4,707 modules | **SUCCESS (0 errors)** | `tsc -b && vite build` compiled cleanly in 3.62s. |

---

## 12. Files Created and Modified

### Created Files
- `src/services/navigation/types.ts` — Data models for pedestrian routes, steps, coordinates, state, and GPS quality.
- `src/services/navigation/routingProvider.ts` — GraphHopper (`foot`) and OSRM (`routed-foot`) routing engines with automatic fallback.
- `src/services/navigation/geocodingService.ts` — OpenStreetMap Nominatim search, reverse geocoding, caching, and rate limiting.
- `src/services/navigation/navigationEngine.ts` — Central navigation state machine, Turf.js spatial projections, GPS tracking, and simulation engine.
- `src/components/navigation/MapLibreView.tsx` — MapLibre GL JS map with OSM raster tiles, custom markers, and high-contrast walking paths.
- `scripts/test_voice_navigation.cjs` — Automated test suite for the pedestrian voice navigation system.
- `docs/NAVI_VOICE_NAVIGATION_REPORT.md` — This comprehensive documentation report.

### Modified Files
- `src/features/navigation/Navigation.tsx` — Accessible walking dashboard with destination search, turn cards, GPS badges, and simulator controls.
- `src/assistant/commands/CommandRegistry.ts` — Registered the 11 `navigation.*` intents with descriptions and parameters.
- `src/assistant/commands/IntentClassifier.ts` — Added multilingual semantic regexes and parameter extraction for English, Hindi, and Hinglish navigation commands.
- `src/assistant/commands/CommandExecutor.ts` — Implemented dispatch handlers connecting the 11 navigation voice intents to `navigationEngine` and `geocodingService`.
- `src/services/SmartAnnouncementManager.ts` — Added `silence()` alias for speech silencing.
- `package.json` & `package-lock.json` — Added `maplibre-gl` and `@turf/turf`.
