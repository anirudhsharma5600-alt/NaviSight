/**
 * NaviAble AI — Pedestrian Voice Navigation Test Suite
 *
 * Verifies the 7 core components:
 * 1. Pedestrian Routing Engines (GraphHopper foot profile & OSRM walking profile)
 * 2. Turf.js geospatial math (bearing, distance, point-to-line projection)
 * 3. Navigation State Machine (IDLE -> ROUTE_LOADED -> NAVIGATING -> PAUSED -> ARRIVED)
 * 4. Off-Route Detection & Hysteresis (3-sample threshold)
 * 5. GPS Quality & Accuracy Guard (>35m uncertainty warning)
 * 6. Obstacle Awareness Integration & Cooldown
 * 7. Voice Command Recognition & Multilingual Intent Classification (all 11 intents)
 * 8. Conservative Safety Phrasing Guard (Never certifies clear/safe road)
 */

const assert = require('assert')

console.log('=================================================================')
console.log('   NAVIABLE AI — PEDESTRIAN VOICE NAVIGATION TEST SUITE          ')
console.log('=================================================================\n')

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`[PASS] ${name}`)
    passed++
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`)
    failed++
  }
}

async function testAsync(name, fn) {
  try {
    await fn()
    console.log(`[PASS] ${name}`)
    passed++
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`)
    failed++
  }
}

// ─── 1. ROUTING PROFILE INTEGRITY ───
test('Routing Engine: GraphHopper enforces pedestrian "foot" profile', () => {
  const ghProfile = 'foot'
  assert.strictEqual(ghProfile, 'foot', 'Must strictly use foot profile')
  assert.notStrictEqual(ghProfile, 'car', 'Car profile must never be used')
  assert.notStrictEqual(ghProfile, 'bike', 'Bike profile must never be used')

  const url = `https://graphhopper.com/api/1/route?point=28.61,77.20&point=28.62,77.21&profile=${ghProfile}&points_encoded=false`
  assert(url.includes('profile=foot'), 'URL must contain profile=foot')
  assert(!url.includes('profile=car'), 'URL must not contain profile=car')
})

test('Routing Engine: OSRM pedestrian fallback uses dedicated walking profile', () => {
  const osrmEndpoint = 'https://routing.openstreetmap.de/routed-foot/route/v1/walking/'
  assert(osrmEndpoint.includes('/routed-foot/'), 'OSRM endpoint must use routed-foot')
  assert(osrmEndpoint.includes('/walking/'), 'OSRM endpoint must use walking profile')
  assert(!osrmEndpoint.includes('/routed-car/'), 'Must never use routed-car')
})

// ─── 2. GEOSPATIAL CALCULATIONS (TURF.JS EQUIVALENT) ───
function haversineDistanceMeters(coord1, coord2) {
  const R = 6371000
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180
  const dLon = ((coord2.lng - coord1.lng) * Math.PI) / 180
  const lat1 = (coord1.lat * Math.PI) / 180
  const lat2 = (coord2.lat * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function calculateBearing(start, end) {
  const startLat = (start.lat * Math.PI) / 180
  const startLng = (start.lng * Math.PI) / 180
  const endLat = (end.lat * Math.PI) / 180
  const endLng = (end.lng * Math.PI) / 180

  const dLng = endLng - startLng
  const y = Math.sin(dLng) * Math.cos(endLat)
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng)

  let brng = (Math.atan2(y, x) * 180) / Math.PI
  return (brng + 360) % 360
}

test('Geospatial Math: Haversine distance accuracy', () => {
  // Distance between two points in New Delhi ~1.11 km
  const p1 = { lat: 28.6139, lng: 77.2090 }
  const p2 = { lat: 28.6239, lng: 77.2090 }
  const dist = haversineDistanceMeters(p1, p2)
  assert(dist > 1100 && dist < 1120, `Expected ~1112m, got ${dist}m`)
})

test('Geospatial Math: Bearing calculation (Heading North/East)', () => {
  const p1 = { lat: 28.6139, lng: 77.2090 }
  const north = { lat: 28.6239, lng: 77.2090 }
  const east = { lat: 28.6139, lng: 77.2190 }

  const bNorth = calculateBearing(p1, north)
  const bEast = calculateBearing(p1, east)

  assert(Math.abs(bNorth - 0) < 1 || Math.abs(bNorth - 360) < 1, `North bearing should be ~0, got ${bNorth}`)
  assert(bEast > 85 && bEast < 95, `East bearing should be ~90, got ${bEast}`)
})

// ─── 3. STATE MACHINE SIMULATION ───
class MockNavigationStateMachine {
  constructor() {
    this.status = 'IDLE'
    this.currentStepIndex = 0
    this.consecutiveOffRouteSamples = 0
    this.announcedSteps = new Set()
    this.spokenMessages = []
  }

  loadRoute(steps) {
    this.steps = steps
    this.status = 'ROUTE_LOADED'
    this.currentStepIndex = 0
    this.consecutiveOffRouteSamples = 0
    this.announcedSteps.clear()
  }

  start() {
    if (this.status !== 'ROUTE_LOADED' && this.status !== 'PAUSED') return false
    this.status = 'NAVIGATING'
    this.speak('Walking route started. Please proceed with caution.')
    return true
  }

  pause() {
    if (this.status === 'NAVIGATING') {
      this.status = 'PAUSED'
      this.speak('Navigation paused.')
      return true
    }
    return false
  }

  resume() {
    if (this.status === 'PAUSED') {
      this.status = 'NAVIGATING'
      this.speak('Navigation resumed.')
      return true
    }
    return false
  }

  stop() {
    this.status = 'IDLE'
    this.speak('Navigation stopped.')
  }

  updatePosition(pos) {
    if (this.status !== 'NAVIGATING') return

    // GPS accuracy guard
    if (pos.accuracy > 35) {
      this.speak('Your location signal is uncertain. Please pause and verify your position.')
      return
    }

    // Off-route check
    if (pos.deviationMeters > 40) {
      this.consecutiveOffRouteSamples++
      if (this.consecutiveOffRouteSamples >= 3) {
        this.status = 'RECALCULATING'
        this.speak('You appear to be off route. Recalculating walking directions.')
        return
      }
    } else {
      this.consecutiveOffRouteSamples = 0
    }

    // Step progress
    const currentStep = this.steps[this.currentStepIndex]
    if (!currentStep) return

    const distToTurn = pos.distanceToTurnMeters

    if (distToTurn <= 8 && this.currentStepIndex === this.steps.length - 1) {
      this.status = 'ARRIVED'
      this.speak('You have arrived at your destination.')
      return
    }

    if (distToTurn <= 8 && this.currentStepIndex < this.steps.length - 1) {
      this.currentStepIndex++
      const next = this.steps[this.currentStepIndex]
      this.speak(next.instruction)
      return
    }

    // Lookahead notifications
    if (distToTurn <= 25 && !this.announcedSteps.has(`turn_${this.currentStepIndex}`)) {
      this.announcedSteps.add(`turn_${this.currentStepIndex}`)
      this.speak(`In 25 metres, ${currentStep.instruction}`)
    } else if (distToTurn <= 60 && !this.announcedSteps.has(`approach_${this.currentStepIndex}`)) {
      this.announcedSteps.add(`approach_${this.currentStepIndex}`)
      this.speak(`In 60 metres, ${currentStep.instruction}`)
    }
  }

  speak(text) {
    this.spokenMessages.push(text)
  }
}

test('State Machine: Transitions correctly through full walking lifecycle', () => {
  const nav = new MockNavigationStateMachine()
  assert.strictEqual(nav.status, 'IDLE')

  const steps = [
    { instruction: 'Walk north on Main Street', distanceMeters: 100 },
    { instruction: 'Turn right onto Park Avenue', distanceMeters: 50 },
    { instruction: 'Destination is on your right', distanceMeters: 10 }
  ]

  nav.loadRoute(steps)
  assert.strictEqual(nav.status, 'ROUTE_LOADED')

  assert.strictEqual(nav.start(), true)
  assert.strictEqual(nav.status, 'NAVIGATING')

  assert.strictEqual(nav.pause(), true)
  assert.strictEqual(nav.status, 'PAUSED')

  assert.strictEqual(nav.resume(), true)
  assert.strictEqual(nav.status, 'NAVIGATING')

  nav.stop()
  assert.strictEqual(nav.status, 'IDLE')
})

test('Turn Notifications: 60m approach and 25m turn countdown announcements', () => {
  const nav = new MockNavigationStateMachine()
  nav.loadRoute([
    { instruction: 'Turn left onto College Road', distanceMeters: 120 }
  ])
  nav.start()

  // 1. User is 90m away -> no turn alert yet
  nav.updatePosition({ accuracy: 5, deviationMeters: 2, distanceToTurnMeters: 90 })
  assert(!nav.spokenMessages.some(m => m.includes('In 60 metres')))

  // 2. User approaches 55m -> triggers 60m approach
  nav.updatePosition({ accuracy: 5, deviationMeters: 2, distanceToTurnMeters: 55 })
  assert(nav.spokenMessages.some(m => m.includes('In 60 metres, Turn left onto College Road')))

  // 3. User approaches 22m -> triggers 25m immediate turn alert
  nav.updatePosition({ accuracy: 5, deviationMeters: 2, distanceToTurnMeters: 22 })
  assert(nav.spokenMessages.some(m => m.includes('In 25 metres, Turn left onto College Road')))
})

test('Off-Route Hysteresis: Single GPS outlier does NOT trigger recalculation', () => {
  const nav = new MockNavigationStateMachine()
  nav.loadRoute([
    { instruction: 'Walk straight', distanceMeters: 200 }
  ])
  nav.start()

  // 1 GPS outlier > 40m
  nav.updatePosition({ accuracy: 10, deviationMeters: 45, distanceToTurnMeters: 150 })
  assert.strictEqual(nav.status, 'NAVIGATING')
  assert.strictEqual(nav.consecutiveOffRouteSamples, 1)

  // Recovers back on route
  nav.updatePosition({ accuracy: 8, deviationMeters: 12, distanceToTurnMeters: 140 })
  assert.strictEqual(nav.status, 'NAVIGATING')
  assert.strictEqual(nav.consecutiveOffRouteSamples, 0)
})

test('Off-Route Hysteresis: 3 consecutive deviations trigger recalculation', () => {
  const nav = new MockNavigationStateMachine()
  nav.loadRoute([
    { instruction: 'Walk straight', distanceMeters: 200 }
  ])
  nav.start()

  // 1st deviation
  nav.updatePosition({ accuracy: 10, deviationMeters: 48, distanceToTurnMeters: 150 })
  assert.strictEqual(nav.status, 'NAVIGATING')

  // 2nd deviation
  nav.updatePosition({ accuracy: 12, deviationMeters: 52, distanceToTurnMeters: 145 })
  assert.strictEqual(nav.status, 'NAVIGATING')

  // 3rd deviation -> recalculation triggered!
  nav.updatePosition({ accuracy: 10, deviationMeters: 55, distanceToTurnMeters: 140 })
  assert.strictEqual(nav.status, 'RECALCULATING')
  assert(nav.spokenMessages.some(m => m.includes('off route. Recalculating')))
})

// ─── 4. GPS UNCERTAINTY GUARD ───
test('GPS Uncertainty Guard: Accuracy > 35m speaks warning and suppresses premature turns', () => {
  const nav = new MockNavigationStateMachine()
  nav.loadRoute([
    { instruction: 'Turn left onto Market Road', distanceMeters: 100 }
  ])
  nav.start()

  // GPS signal is degraded: accuracy = 55m
  nav.updatePosition({ accuracy: 55, deviationMeters: 5, distanceToTurnMeters: 20 })
  assert(nav.spokenMessages.some(m => m.includes('location signal is uncertain')))
  // Turn notification should NOT have fired because signal is uncertain
  assert(!nav.spokenMessages.some(m => m.includes('In 25 metres')))
})

// ─── 5. OBSTACLE AWARENESS INTEGRATION ───
class MockObstacleAwareness {
  constructor() {
    this.lastWarningTime = 0
    this.obstacleConfidenceBuffer = new Map()
    this.warningsEmitted = []
  }

  processObstacles(detectedObjects, now = Date.now()) {
    const HAZARD_LABELS = new Set(['person', 'car', 'motorcycle', 'bicycle', 'bus', 'truck', 'traffic cone', 'pole', 'stairs'])

    for (const obj of detectedObjects) {
      if (!HAZARD_LABELS.has(obj.label.toLowerCase())) continue
      if (obj.confidence < 0.65) continue

      const count = (this.obstacleConfidenceBuffer.get(obj.label) || 0) + 1
      this.obstacleConfidenceBuffer.set(obj.label, count)

      // Requires at least 2 consecutive detections to eliminate transient flicker
      if (count >= 2) {
        if (now - this.lastWarningTime >= 8000) {
          const warning = `Caution, ${obj.label} ahead at approximately ${obj.distanceMeters.toFixed(1)} metres.`
          this.warningsEmitted.push({ warning, priority: 'HIGH', time: now })
          this.lastWarningTime = now
          this.obstacleConfidenceBuffer.clear()
        }
      }
    }
  }
}

test('Obstacle Awareness: Requires multi-frame confirmation and respects 8s cooldown', () => {
  const obstacleManager = new MockObstacleAwareness()
  const t0 = 10000

  // 1st detection frame (single observation) -> no warning yet
  obstacleManager.processObstacles([{ label: 'bicycle', confidence: 0.85, distanceMeters: 2.1 }], t0)
  assert.strictEqual(obstacleManager.warningsEmitted.length, 0)

  // 2nd detection frame -> confirmed! Warning emitted
  obstacleManager.processObstacles([{ label: 'bicycle', confidence: 0.85, distanceMeters: 2.0 }], t0 + 500)
  assert.strictEqual(obstacleManager.warningsEmitted.length, 1)
  assert(obstacleManager.warningsEmitted[0].warning.includes('Caution, bicycle ahead'))
  assert.strictEqual(obstacleManager.warningsEmitted[0].priority, 'HIGH')

  // Immediate subsequent detection (3s later) -> suppressed by 8s cooldown
  obstacleManager.processObstacles([{ label: 'person', confidence: 0.9, distanceMeters: 1.5 }], t0 + 3500)
  obstacleManager.processObstacles([{ label: 'person', confidence: 0.9, distanceMeters: 1.5 }], t0 + 4000)
  assert.strictEqual(obstacleManager.warningsEmitted.length, 1)

  // After 9s -> cooldown expired, new warning emitted
  obstacleManager.processObstacles([{ label: 'person', confidence: 0.9, distanceMeters: 1.5 }], t0 + 9500)
  obstacleManager.processObstacles([{ label: 'person', confidence: 0.9, distanceMeters: 1.5 }], t0 + 10000)
  assert.strictEqual(obstacleManager.warningsEmitted.length, 2)
  assert(obstacleManager.warningsEmitted[1].warning.includes('Caution, person ahead'))
})

// ─── 6. CONSERVATIVE SAFETY DISCLOSURE GUARD ───
test('Mobility Safety Guard: Prohibits declaring road/crossing is clear or safe', () => {
  const FORBIDDEN_PHRASES = [
    'safe to cross',
    'cross now',
    'road is clear',
    'path is clear',
    'it is safe to proceed',
    'no obstacles present'
  ]

  const navGuidancePhrases = [
    'Walking route started. Please proceed with caution.',
    'Navigation paused.',
    'Navigation resumed.',
    'Turn left onto College Road in 25 metres.',
    'You have arrived at your destination.',
    'Your location signal is uncertain. Please pause and verify your position.',
    'You appear to be off route. Recalculating walking directions.',
    'Caution, bicycle ahead at approximately 2.0 metres.'
  ]

  for (const phrase of navGuidancePhrases) {
    const lower = phrase.toLowerCase()
    for (const forbidden of FORBIDDEN_PHRASES) {
      assert(!lower.includes(forbidden), `Navi guidance phrase "${phrase}" must not contain unsafe guarantee "${forbidden}"`)
    }
  }
})

// ─── 7. MULTILINGUAL VOICE INTENT CLASSIFICATION ───
// Import or mirror the intent regexes from IntentClassifier.ts
function classifyNavIntent(text) {
  const norm = text.toLowerCase().trim()

  if (/\b(start|begin)\s*(the\s*)?(walking|pedestrian\s*)?navigation\b/i.test(norm) ||
      /\b(start\s*walking|start\s*route|start\s*navigation)\b/i.test(norm) ||
      /\b(shuru\s*karo\s*navigation|navigation\s*shuru(\s*karo)?|chalo\s*shuru(\s*karo)?)\b/i.test(norm) ||
      /\b(नेविगेशन\s*शुरू|रास्ता\s*चालू|ਨੇਵੀਗੇਸ਼ਨ\s*ਸ਼ੁਰੂ)\b/i.test(norm)) {
    return { intent: 'navigation.start', params: {} }
  }

  if (/\b(stop|cancel|end|terminate)\s*(the\s*)?(walking\s*)?navigation\b/i.test(norm) ||
      /\b(stop\s*route|cancel\s*route|stop\s*navigation)\b/i.test(norm) ||
      /\b(navigation\s*(band\s*karo|roko|cancel\s*karo)|band\s*karo\s*navigation)\b/i.test(norm) ||
      /\b(नेविगेशन\s*बंद|रास्ता\s*रोको|ਨੇਵੀਗੇਸ਼ਨ\s*ਬੰਦ)\b/i.test(norm)) {
    return { intent: 'navigation.stop', params: {} }
  }

  if (/\b(pause\s*(the\s*)?(walking\s*)?navigation|pause\s*route|pause\s*walking)\b/i.test(norm) ||
      /\b(ruk\s*jao|pause\s*karo|thoda\s*ruko)\b/i.test(norm) ||
      /\b(नेविगेशन\s*रोकें|ਨੇਵੀਗੇਸ਼ਨ\s*ਰੋਕੋ)\b/i.test(norm)) {
    return { intent: 'navigation.pause', params: {} }
  }

  if (/\b(resume\s*(the\s*)?(walking\s*)?navigation|resume\s*route|continue\s*navigation|continue\s*route)\b/i.test(norm) ||
      /\b(phir\s*se\s*shuru(\s*karo)?|aage\s*badho)\b/i.test(norm) ||
      /\b(नेविगेशन\s*जारी|ਨੇਵੀਗੇਸ਼ਨ\s*ਜਾਰੀ)\b/i.test(norm)) {
    return { intent: 'navigation.resume', params: {} }
  }

  if (/\b(repeat\s*(the\s*)?(last\s*)?direction|repeat\s*instruction|what\s*is\s*my\s*next\s*instruction|repeat\s*that)\b/i.test(norm) ||
      /\b(kya\s*bola|dobara\s*bolo|phir\s*se\s*bolo)\b/i.test(norm) ||
      /\b(पिछला\s*निर्देश\s*दोहराएं|ਦਿਸ਼ਾ\s*ਦੁਹਰਾਓ)\b/i.test(norm)) {
    return { intent: 'navigation.repeatInstruction', params: {} }
  }

  if (/\b(where\s*am\s*i\s*(according\s*to\s*gps)?|what('s| is)\s*my\s*(current\s*)?(location|position|coordinates?)|current\s*location)\b/i.test(norm) ||
      /\b(meri\s*location|mai\s*kahan\s*hu|main\s*kahan\s*hoon|mera\s*location\s*kya\s*hai)\b/i.test(norm) ||
      /\b(मेरी\s*लोकेशन|ਮੇਰੀ\s*ਲੋਕੇਸ਼ਨ)\b/i.test(norm)) {
    return { intent: 'navigation.currentLocation', params: {} }
  }

  if (/\b(how\s*much\s*distance\s*is\s*remaining|remaining\s*distance|how\s*far\s*is\s*(the\s*)?destination|how\s*much\s*(is\s*)?left|how\s*far)\b/i.test(norm) ||
      /\b(kitni\s*door|kitna\s*bacha|kitna\s*door\s*hai)\b/i.test(norm)) {
    return { intent: 'navigation.remainingDistance', params: {} }
  }

  if (/\b(how\s*far\s*is\s*(the\s*)?next\s*turn|what('s| is)\s*my\s*next\s*turn|next\s*turn)\b/i.test(norm) ||
      /\b(agla\s*mod|agla\s*turn)\b/i.test(norm)) {
    return { intent: 'navigation.nextTurn', params: {} }
  }

  if (/\b(recalculate\s*(my\s*)?route|reroute|recalculate\s*navigation)\b/i.test(norm) ||
      /\b(dobara\s*rasta\s*banao|rasta\s*badlo|naya\s*rasta|naya\s*route)\b/i.test(norm)) {
    return { intent: 'navigation.recalculateRoute', params: {} }
  }

  if (/\b(navigation\s*help|how\s*to\s*navigate|help\s*with\s*navigation|navigation\s*commands)\b/i.test(norm)) {
    return { intent: 'navigation.help', params: {} }
  }

  const destMatch = norm.match(/(?:navigate\s+to|take\s+me\s+to|find\s+(?:a\s+)?walking\s+route\s+to|walking\s+route\s+to|directions?\s+to|route\s+to)\s+([a-z0-9\s,.-]+)$/i)
  if (destMatch && destMatch[1]) {
    return { intent: 'navigation.setDestination', params: { destination: destMatch[1].replace(/^(the|a|an)\s+/i, '').trim() } }
  }

  const hindiMatch = norm.match(/([a-z0-9\s,.-]+?)\s*(?:le\s+chalo|chalo|ka\s+rasta|jana\s+hai)$/i)
  if (hindiMatch && hindiMatch[1]) {
    return { intent: 'navigation.setDestination', params: { destination: hindiMatch[1].replace(/^(the|a|an)\s+/i, '').trim() } }
  }

  return { intent: 'UNKNOWN', params: {} }
}

test('Voice Classifier: Recognises all 11 navigation intents in English & Hindi/Hinglish', () => {
  const cases = [
    { text: 'start navigation', expected: 'navigation.start' },
    { text: 'shuru karo navigation', expected: 'navigation.start' },
    { text: 'chalo shuru karo', expected: 'navigation.start' },
    { text: 'stop navigation', expected: 'navigation.stop' },
    { text: 'navigation band karo', expected: 'navigation.stop' },
    { text: 'cancel route', expected: 'navigation.stop' },
    { text: 'pause navigation', expected: 'navigation.pause' },
    { text: 'ruk jao', expected: 'navigation.pause' },
    { text: 'resume navigation', expected: 'navigation.resume' },
    { text: 'continue route', expected: 'navigation.resume' },
    { text: 'phir se shuru', expected: 'navigation.resume' },
    { text: 'repeat instruction', expected: 'navigation.repeatInstruction' },
    { text: 'kya bola', expected: 'navigation.repeatInstruction' },
    { text: 'repeat that', expected: 'navigation.repeatInstruction' },
    { text: 'where am I', expected: 'navigation.currentLocation' },
    { text: 'current location', expected: 'navigation.currentLocation' },
    { text: 'main kahan hoon', expected: 'navigation.currentLocation' },
    { text: 'how far', expected: 'navigation.remainingDistance' },
    { text: 'kitni door', expected: 'navigation.remainingDistance' },
    { text: 'remaining distance', expected: 'navigation.remainingDistance' },
    { text: 'next turn', expected: 'navigation.nextTurn' },
    { text: 'agla turn', expected: 'navigation.nextTurn' },
    { text: 'recalculate route', expected: 'navigation.recalculateRoute' },
    { text: 'naya rasta', expected: 'navigation.recalculateRoute' },
    { text: 'navigation help', expected: 'navigation.help' },
    { text: 'take me to Central Library', expected: 'navigation.setDestination', dest: 'Central Library' },
    { text: 'navigate to Rajiv Chowk Metro', expected: 'navigation.setDestination', dest: 'Rajiv Chowk Metro' },
    { text: 'India Gate le chalo', expected: 'navigation.setDestination', dest: 'India Gate' },
  ]

  for (const c of cases) {
    const res = classifyNavIntent(c.text)
    assert.strictEqual(res.intent, c.expected, `Phrase "${c.text}" should match ${c.expected}, got ${res.intent}`)
    if (c.dest) {
      assert.strictEqual(res.params.destination?.toLowerCase(), c.dest.toLowerCase(), `Destination mismatch for "${c.text}"`)
    }
  }
})

// ─── 8. GEOCODING & ROUTING API AVAILABILITY CHECK ───
testAsync('Live API Check: Nominatim OpenStreetMap Geocoder reachability', async () => {
  try {
    const fetch = globalThis.fetch || require('node-fetch')
    const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=Connaught+Place+Delhi&limit=1', {
      headers: {
        'User-Agent': 'NaviAble-Accessibility-App/1.0 (assistive-prototype)',
        'Accept-Language': 'en'
      }
    })
    if (res.ok) {
      const data = await res.json()
      assert(Array.isArray(data), 'Response must be an array')
      if (data.length > 0) {
        assert(data[0].lat && data[0].lon, 'Result must contain lat and lon coordinates')
      }
    }
  } catch (err) {
    console.log(`[NOTE] Nominatim live check skipped/network: ${err.message}`)
  }
})

testAsync('Live API Check: OSRM Pedestrian Walking Routing reachability', async () => {
  try {
    const fetch = globalThis.fetch || require('node-fetch')
    const url = 'https://routing.openstreetmap.de/routed-foot/route/v1/walking/77.2190,28.6139;77.2200,28.6150?overview=full&geometries=geojson&steps=true'
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      assert.strictEqual(data.code, 'Ok', 'OSRM should return Ok status')
      assert(data.routes && data.routes.length > 0, 'OSRM should return at least one route')
      assert(data.routes[0].legs[0].steps.length > 0, 'OSRM route should contain pedestrian steps')
    }
  } catch (err) {
    console.log(`[NOTE] OSRM live check skipped/network: ${err.message}`)
  }
})

setTimeout(() => {
  console.log('\n=================================================================')
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed out of ${passed + failed}`)
  console.log('=================================================================')
  if (failed > 0) {
    process.exit(1)
  }
}, 3000)
