# NaviAble AI — Route Memory & Navigation Tracking Report

**Module:** Route Memory & Navigation Subsystem  
**Date:** November 1, 2026  
**Implementation Files:** `src/services/GPSService.ts`, `src/services/RouteTrackingService.ts`, `src/remember/RouteMemory.ts`  

---

## 1. Overview & Problem Statement

Navigating unfamiliar or complex pedestrian routes poses severe safety risks for visually impaired individuals. Traditional map applications (e.g. Google Maps, Apple Maps) focus on vehicular roads, turn-by-turn vehicle instructions, or commercial routing. They frequently miss subtle pedestrian landmarks (e.g. "small step down near cafeteria door", "tree branch on left sidewalk", "pedestrian ramp").

**Route Memory** enables visually impaired users to record their own known, safe paths or walk with a guide once, marking landmarks and voice notes that Navi stores in memory.

---

## 2. Technical Implementation

### A. Geolocation & Spatial Mathematics (`GPSService.ts`)

GPS tracking utilizes the W3C Geolocation API with `enableHighAccuracy: true`. All geographic computations rely on spherical trigonometry (Haversine formula):

$$\Delta\sigma = 2 \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
$$d = R \cdot \Delta\sigma \quad (R \approx 6,371,000 \text{ meters})$$

Bearing calculation:
$$\theta = \text{atan2}\left(\sin(\Delta\lambda)\cos(\phi_2), \cos(\phi_1)\sin(\phi_2) - \sin(\phi_1)\cos(\phi_2)\cos(\Delta\lambda)\right)$$

### B. Jitter Filtering & Battery Optimization

Mobile GPS signals exhibit random walk jitter when stationary ($\pm 3-8$ meters). To prevent artificial distance inflation and memory bloat:
1. **Distance Filter:** Consecutive points are only added if spatial separation $\ge 2.5$ meters.
2. **Accuracy Filter:** Points with reported GPS accuracy $> 25$ meters are tagged with degraded quality flags.
3. **Throttled State Updates:** Notifications to UI listeners are debounced.

### C. Landmark Tagging with Voice Notes

Users can tag physical landmarks during an active recording session:
- **Speech Command:** *"Hey Navi, tag landmark speed breaker."*
- **Saved Metadata:** Latitude, Longitude, Altitude, GPS accuracy, Timestamp, Distance from route start, Optional custom voice note.

### D. Route Deviation Warning Algorithm

When following a saved route (`TrackingMode = 'NAVIGATING'`), the system computes the orthogonal distance from the user's current GPS fix to the closest point along the recorded breadcrumb polyline:

$$d_{\text{min}} = \min_{i} \text{Haversine}(P_{\text{current}}, P_i)$$

- If $d_{\text{min}} > 35$ meters:
  - An off-route state is flagged (`isOffRoute = true`).
  - Spoken alert: *"Attention: You appear to have deviated 42 meters off your recorded route."*
  - Debounce cooldown: Alert is throttled to once every 15 seconds or upon significant increase ($>15$m additional divergence) to avoid annoying repetitive chimes.

---

## 3. Spatial Safety Disclaimers & Limitations

NaviAble strictly adheres to ethical accessibility engineering principles:

> [!WARNING]
> **Essential Safety Boundary:**
> 1. GPS accuracy is subject to atmospheric distortion, multipath reflection near tall concrete buildings, and indoor signal loss.
> 2. Environmental conditions change dynamically: road construction, potholes, broken pavement, and parked vehicles may appear on a previously recorded route.
> 3. NaviAble **NEVER** guarantees that a recorded route is clear of obstacles today.
> 4. Navi always announces the following spatial reminder upon starting navigation:
>    *"Navigating route: College to Library. Safety reminder: Saved routes reflect past conditions. Road hazards, obstacles, and traffic can change at any time. Always rely on live senses and physical guidance."*

---

## 4. Voice Assistant Integration

The route memory engine connects directly to Navi's conversational interface:

| Voice Query | Intent / Action | Navi Voice Response |
|---|---|---|
| *"Hey Navi, remember this route."* | `REMEMBER_ROUTE_START` | *"Route recording started. Walk your route and tell me when you reach your destination."* |
| *"Hey Navi, save this route as College to Library."* | `REMEMBER_ROUTE_STOP` | *"Route saved as College to Library. Total distance is 420 meters."* |
| *"Hey Navi, tell me about route College to Library."* | `REMEMBER_ROUTE_RECALL` | *"Route College to Library goes from Main Gate to Library. Total distance is 420 meters, recorded in about 6 minutes. It has 2 landmarks: Speed breaker at 50 meters, and Cafeteria at 210 meters."* |
| *"Hey Navi, tag landmark cafeteria door."* | `addRouteLandmark` (Gemini / Local Router) | *"Landmark cafeteria door recorded at 210 meters."* |

---

## 5. GeoJSON Export Specification

Every saved route can be exported as a standard GeoJSON `FeatureCollection` for review in GIS software or Leaflet mapping:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [[77.5946, 12.9716, 0], [77.5948, 12.9719, 0]]
      },
      "properties": {
        "name": "College to Library",
        "distance": 420,
        "duration": 360
      }
    },
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [77.5947, 12.9717]
      },
      "properties": {
        "name": "Cafeteria Door",
        "distanceFromStart": 210
      }
    }
  ]
}
```

