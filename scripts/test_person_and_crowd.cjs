/**
 * Automated Test Suite for Person Tracking & Crowd Intelligence
 */

class TestPersonTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.currentState = 'CLEAR';
    this.lastAnnouncedState = 'CLEAR';
    this.lastAnnouncedPersonId = null;
    this.lastAnnouncementTime = 0;
    this.lastCrowdAnnouncedTime = 0;
    this.trackedPeople = new Map();
    this.spokenAnnouncements = [];
    this.framesWithoutPeople = 0;
  }

  processFrame(personDets, frameWidth = 1000, frameHeight = 1000, now = 10000) {
    const frameArea = frameWidth * frameHeight;
    if (personDets.length === 0) {
      this.framesWithoutPeople++;
      if (this.framesWithoutPeople >= 6) {
        this.currentState = 'CLEAR';
        this.lastAnnouncedState = 'CLEAR';
        this.trackedPeople.clear();
      }
      return { state: this.currentState, spoken: [] };
    }

    this.framesWithoutPeople = 0;
    const activeIds = new Set();
    const frameSpoken = [];

    for (const det of personDets) {
      const area = det.bbox[2] * det.bbox[3];
      const relArea = area / frameArea;
      const heightRatio = det.bbox[3] / frameHeight;
      const trackId = det.id;
      activeIds.add(trackId);

      let p = this.trackedPeople.get(trackId);
      if (!p) {
        p = {
          id: trackId,
          position: det.position,
          relativeArea: relArea,
          heightRatio,
          consecutiveFrames: 1,
          sizeHistory: [relArea],
          isApproaching: false,
          isVeryClose: relArea >= 0.22 || heightRatio >= 0.52,
        };
        this.trackedPeople.set(trackId, p);
      } else {
        p.position = det.position;
        p.relativeArea = relArea;
        p.heightRatio = heightRatio;
        p.consecutiveFrames++;
        p.sizeHistory.push(relArea);
        if (p.sizeHistory.length > 7) p.sizeHistory.shift();

        if (p.sizeHistory.length >= 4) {
          const firstAvg = (p.sizeHistory[0] + p.sizeHistory[1]) / 2;
          const recentAvg = (p.sizeHistory[p.sizeHistory.length - 2] + p.sizeHistory[p.sizeHistory.length - 1]) / 2;
          p.isApproaching = recentAvg > firstAvg * 1.20 && recentAvg >= 0.05;
        }
        p.isVeryClose = relArea >= 0.22 || heightRatio >= 0.52;
      }
    }

    let closestPerson = null;
    let maxArea = 0;
    for (const p of this.trackedPeople.values()) {
      if (p.relativeArea > maxArea) {
        maxArea = p.relativeArea;
        closestPerson = p;
      }
    }

    const personCount = personDets.length;
    const isCrowd = personCount >= 3;

    if (isCrowd) {
      this.currentState = 'CROWD_DETECTED';
    } else if (closestPerson) {
      if (closestPerson.isVeryClose) {
        this.currentState = 'PERSON_VERY_CLOSE';
      } else if (closestPerson.isApproaching) {
        this.currentState = 'PERSON_APPROACHING';
      } else if (closestPerson.relativeArea >= 0.05) {
        this.currentState = 'PERSON_NEARBY';
      } else {
        this.currentState = 'PERSON_DETECTED';
      }
    }

    if (this.currentState === 'CROWD_DETECTED') {
      if (closestPerson && closestPerson.isVeryClose) {
        if (this.lastAnnouncedPersonId !== closestPerson.id || now - this.lastAnnouncementTime >= 9000) {
          this.lastAnnouncedPersonId = closestPerson.id;
          this.lastAnnouncementTime = now;
          const phrase = `A person appears close on the ${closestPerson.position.toLowerCase()} side of the camera view.`;
          frameSpoken.push(phrase);
          this.spokenAnnouncements.push(phrase);
          return { state: this.currentState, spoken: frameSpoken };
        }
      }

      if (this.lastAnnouncedState !== 'CROWD_DETECTED' || now - this.lastCrowdAnnouncedTime >= 14000) {
        this.lastAnnouncedState = 'CROWD_DETECTED';
        this.lastCrowdAnnouncedTime = now;
        this.lastAnnouncementTime = now;
        const phrase = 'A group of people is nearby.';
        frameSpoken.push(phrase);
        this.spokenAnnouncements.push(phrase);
      }
      return { state: this.currentState, spoken: frameSpoken };
    }

    // Single person
    if (this.currentState === 'PERSON_DETECTED') {
      // Quiet
    } else if (this.currentState === 'PERSON_NEARBY') {
      if (this.lastAnnouncedState !== 'PERSON_NEARBY' || (now - this.lastAnnouncementTime >= 9000 && this.lastAnnouncedState !== 'PERSON_NEARBY')) {
        this.lastAnnouncedState = 'PERSON_NEARBY';
        this.lastAnnouncementTime = now;
        const phrase = 'A person is nearby.';
        frameSpoken.push(phrase);
        this.spokenAnnouncements.push(phrase);
      }
    } else if (this.currentState === 'PERSON_APPROACHING') {
      if (this.lastAnnouncedState !== 'PERSON_APPROACHING') {
        this.lastAnnouncedState = 'PERSON_APPROACHING';
        this.lastAnnouncementTime = now;
        const phrase = 'A person appears to be approaching.';
        frameSpoken.push(phrase);
        this.spokenAnnouncements.push(phrase);
      }
    } else if (this.currentState === 'PERSON_VERY_CLOSE') {
      if (this.lastAnnouncedState !== 'PERSON_VERY_CLOSE' || now - this.lastAnnouncementTime >= 9000) {
        this.lastAnnouncedState = 'PERSON_VERY_CLOSE';
        this.lastAnnouncementTime = now;
        const phrase = 'Warning! A person appears very close.';
        frameSpoken.push(phrase);
        this.spokenAnnouncements.push(phrase);
      }
    }

    return { state: this.currentState, spoken: frameSpoken };
  }
}

console.log('================================================================');
console.log('   NAVIABLE AI — PERSON TRACKING & CROWD INTELLIGENCE TESTS     ');
console.log('================================================================\n');

const tracker = new TestPersonTracker();
let passed = 0;
let total = 0;

function assert(description, condition) {
  total++;
  if (condition) {
    passed++;
    console.log(`[PASS] ${description}`);
  } else {
    console.log(`[FAIL] ${description}`);
  }
}

let simulatedTime = 1000;

// ── Test 1: Single person far away ──
let res1 = tracker.processFrame([{ id: 101, class: 'person', position: 'CENTRE', bbox: [400, 400, 100, 150] }], 1000, 1000, simulatedTime);
assert('1. Far person is tracked but remains QUIET (0 spoken announcements)', res1.spoken.length === 0 && res1.state === 'PERSON_DETECTED');

// ── Test 3: Person stays stationary in nearby zone for 10 frames ──
tracker.reset();
simulatedTime = 5000;
// Frame 1 initializes nearby state
let initialNearby = tracker.processFrame([{ id: 101, class: 'person', position: 'CENTRE', bbox: [350, 300, 250, 300] }], 1000, 1000, simulatedTime);
assert('2. Nearby person triggers "A person is nearby." once', initialNearby.spoken.includes('A person is nearby.') && initialNearby.state === 'PERSON_NEARBY');

let stationarySpoken = [];
for (let f = 0; f < 10; f++) {
  simulatedTime += 150;
  let r = tracker.processFrame([{ id: 101, class: 'person', position: 'CENTRE', bbox: [350, 300, 250, 300] }], 1000, 1000, simulatedTime);
  stationarySpoken.push(...r.spoken);
}
assert('3. Stationary nearby person produces ZERO repeated announcements over 10 frames', stationarySpoken.length === 0);

// ── Test 4: Person approaches over multiple frames ──
tracker.reset();
simulatedTime = 20000;
let approachSpoken = [];
const approachSizes = [
  [300, 300, 200, 260],
  [280, 280, 220, 290],
  [260, 250, 260, 330],
  [230, 220, 310, 390],
  [200, 180, 360, 440],
];
for (const bbox of approachSizes) {
  simulatedTime += 200;
  let r = tracker.processFrame([{ id: 102, class: 'person', position: 'CENTRE', bbox }], 1000, 1000, simulatedTime);
  approachSpoken.push(...r.spoken);
}
assert('4. Approaching person triggers "A person appears to be approaching."', approachSpoken.includes('A person appears to be approaching.'));

// ── Test 5: Person becomes very close ──
simulatedTime += 200;
let res5 = tracker.processFrame([{ id: 102, class: 'person', position: 'CENTRE', bbox: [100, 50, 550, 600] }], 1000, 1000, simulatedTime);
assert('5. Very close person triggers "Warning! A person appears very close."', res5.spoken.includes('Warning! A person appears very close.') && res5.state === 'PERSON_VERY_CLOSE');

// ── Test 6: Crowd of 6 people appears ──
tracker.reset();
simulatedTime = 40000;
const crowdDets = [
  { id: 201, class: 'person', position: 'LEFT', bbox: [50, 200, 100, 250] },
  { id: 202, class: 'person', position: 'LEFT', bbox: [160, 220, 90, 240] },
  { id: 203, class: 'person', position: 'CENTRE', bbox: [350, 180, 110, 260] },
  { id: 204, class: 'person', position: 'CENTRE', bbox: [480, 200, 100, 250] },
  { id: 205, class: 'person', position: 'RIGHT', bbox: [650, 210, 95, 245] },
  { id: 206, class: 'person', position: 'RIGHT', bbox: [780, 200, 105, 260] },
];
let res6 = tracker.processFrame(crowdDets, 1000, 1000, simulatedTime);
assert('6. Crowd of 6 people aggregates into "A group of people is nearby."', res6.spoken.includes('A group of people is nearby.') && res6.state === 'CROWD_DETECTED');
assert('6b. NO individual "Person in front" shouts were generated for the 6 people', !res6.spoken.some(s => s.toLowerCase().includes('person in front')));

// ── Test 7: Crowd stays visible for 15 frames ──
let crowdSteadySpoken = [];
for (let f = 0; f < 15; f++) {
  simulatedTime += 150;
  let r = tracker.processFrame(crowdDets, 1000, 1000, simulatedTime);
  crowdSteadySpoken.push(...r.spoken);
}
assert('7. Stable crowd remains SILENT over 15 frames (ZERO repeated shouts)', crowdSteadySpoken.length === 0);

// ── Test 8: One person in crowd approaches close on the right ──
simulatedTime += 200;
const crowdWithClosePerson = [
  ...crowdDets.slice(0, 5),
  { id: 206, class: 'person', position: 'RIGHT', bbox: [600, 100, 480, 600] }
];
let res8 = tracker.processFrame(crowdWithClosePerson, 1000, 1000, simulatedTime);
assert('8. Close person within crowd is singled out with position ("on the right side")', res8.spoken.some(s => s.includes('A person appears close on the right side of the camera view.')));

console.log(`\nResults: ${passed}/${total} Passed (${Math.round((passed/total)*100)}%)`);
