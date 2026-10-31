// Self-contained test script mirroring IntentClassifier regex catalog
const INTENT_CATALOG = [
  {
    intent: 'CAMERA_START',
    patterns: [
      /\b(open|start|turn on|activate|enable)\s*(the\s*)?(camera|video|feed)\b/i,
      /\b(camera|कैमरा|ਕੈਮਰਾ)\s*(chalu|on|start|khol|kholo|shuru)\b/i,
    ],
  },
  {
    intent: 'CAMERA_STOP',
    patterns: [
      /\b(stop|close|turn off|disable|shut)\s*(the\s*)?(camera|video|feed)\b/i,
      /\b(camera|कैमरा|ਕੈਮਰਾ)\s*(band|off|stop|roko)\b/i,
    ],
  },
  {
    intent: 'CAMERA_SWITCH_REAR',
    patterns: [
      /\b(switch|flip|change|use)\s*(to\s*)?(the\s*)?(rear|back|environment)\s*(camera)?\b/i,
      /\b(rear|back)\s*camera\b/i,
    ],
  },
  {
    intent: 'SCENE_DESCRIBE',
    patterns: [
      /\b(describe|what('s| is)|tell me what is)\s*(my\s*)?(surroundings?|environment|around me|in front of me|scene)\b/i,
      /\b(what do you see|what can you see|what's ahead|what is ahead)\b/i,
      /\b(kya dikh raha hai|samne kya hai|aas paas kya hai|kya hai)\b/i,
    ],
  },
  {
    intent: 'SCENE_ROAD_CHECK',
    patterns: [
      /\b(tell me what('s| is) on the road|what is on the road|check road|road condition)\b/i,
      /\b(sadak par kya hai|rasta kaisa hai|road par kya hai)\b/i,
    ],
  },
  {
    intent: 'SCENE_VEHICLE_CHECK',
    patterns: [
      /\b(is there a vehicle|any car|any bike|any vehicle nearby|traffic nearby)\b/i,
      /\b(koi gaadi hai|kya koi car hai|kya koi vehicle hai)\b/i,
    ],
  },
  {
    intent: 'CURRENCY_SCAN',
    patterns: [
      /\b(check\s*(how\s*much\s*)?(money|cash)|read\s*(this\s*)?note|how\s*many\s*rupees|scan\s*currency)\b/i,
      /\b(identify\s*(the\s*)?note|what\s*note\s*is\s*this|kitne\s*rupaye|paise\s*padho|note\s*padho)\b/i,
      /\b(note check karo|paise kitne hain|rupaye kitne hain|kitna note hai)\b/i,
    ],
  },
  {
    intent: 'CURRENCY_REPEAT',
    patterns: [
      /\b(repeat\s*(the\s*)?amount|say\s*(the\s*)?amount\s*again|kitna\s*tha\s*dobara\s*bolo)\b/i,
    ],
  },
  {
    intent: 'CURRENCY_SCAN_ANOTHER',
    patterns: [
      /\b(scan\s*another\s*note|rescan\s*note|next\s*note|dusra\s*note)\b/i,
    ],
  },
  {
    intent: 'ROAD_HAZARDS_ENABLE',
    patterns: [
      /\b(enable|start|turn on)\s*(road\s*detection|road\s*hazard|hazard\s*alerts)\b/i,
    ],
  },
  {
    intent: 'ROAD_HAZARDS_DETECT_POTHOLES',
    patterns: [
      /\b(detect|find|look for|scan for)\s*(potholes?|cracks?|road\s*damage)\b/i,
    ],
  },
  {
    intent: 'ROAD_HAZARDS_DESCRIBE',
    patterns: [
      /\b(describe\s*road\s*conditions?|how\s*is\s*the\s*road|check\s*road\s*surface)\b/i,
    ],
  },
  {
    intent: 'PROXIMITY_ENABLE_ALERTS',
    patterns: [
      /\b(enable\s*proximity\s*alerts?|proximity\s*on|turn\s*on\s*proximity)\b/i,
    ],
  },
  {
    intent: 'OCR_READ_TEXT',
    patterns: [
      /\b(read\s*(this\s*)?(text|writing|words)|read\s*page)\b/i,
    ],
  },
  {
    intent: 'OCR_READ_BOARD',
    patterns: [
      /\b(read\s*(the\s*)?(board|sign|banner))\b/i,
    ],
  },
  {
    intent: 'ASSISTANT_SPEAK_SLOWER',
    patterns: [
      /\b(speak\s*slower|slow\s*down|dhire\s*bolo|dhime\s*bolo)\b/i,
    ],
  },
  {
    intent: 'ASSISTANT_SPEAK_LOUDER',
    patterns: [
      /\b(speak\s*louder|increase\s*volume|awaz\s*badhao)\b/i,
    ],
  },
  {
    intent: 'ASSISTANT_LANG_HINDI',
    patterns: [
      /\b(change\s*language\s*to\s*hindi|speak\s*in\s*hindi|hindi\s*language)\b/i,
    ],
  },
  {
    intent: 'ASSISTANT_LANG_PUNJABI',
    patterns: [
      /\b(change\s*language\s*to\s*punjabi|speak\s*in\s*punjabi|punjabi\s*language)\b/i,
    ],
  },
  {
    intent: 'ASSISTANT_STOP_SPEAKING',
    patterns: [
      /\b(stop\s*speaking|be\s*quiet|shut\s*up|silence|stop\s*talking|shant\s*raho|chup\s*raho)\b/i,
    ],
  },
  {
    intent: 'ASSISTANT_HELP',
    patterns: [
      /\b(help|what\s*can\s*you\s*do|madad)\b/i,
    ],
  },
];

function classify(query) {
  for (const item of INTENT_CATALOG) {
    for (const p of item.patterns) {
      if (p.test(query)) return item.intent;
    }
  }
  return 'UNKNOWN';
}

const testCases = [
  { query: 'Hey Navi, open camera', expected: 'CAMERA_START' },
  { query: 'start camera', expected: 'CAMERA_START' },
  { query: 'camera chalu karo', expected: 'CAMERA_START' },
  { query: 'switch to rear camera', expected: 'CAMERA_SWITCH_REAR' },
  { query: 'stop camera', expected: 'CAMERA_STOP' },
  { query: 'camera band karo', expected: 'CAMERA_STOP' },
  { query: 'Hey Navi, describe my surroundings', expected: 'SCENE_DESCRIBE' },
  { query: 'what is in front of me', expected: 'SCENE_DESCRIBE' },
  { query: 'tell me what is on the road', expected: 'SCENE_ROAD_CHECK' },
  { query: 'is there a vehicle nearby', expected: 'SCENE_VEHICLE_CHECK' },
  { query: 'Hey Navi, check how much money this is', expected: 'CURRENCY_SCAN' },
  { query: 'read this note', expected: 'CURRENCY_SCAN' },
  { query: 'how many rupees', expected: 'CURRENCY_SCAN' },
  { query: 'scan currency', expected: 'CURRENCY_SCAN' },
  { query: 'paise kitne hain', expected: 'CURRENCY_SCAN' },
  { query: 'repeat the amount', expected: 'CURRENCY_REPEAT' },
  { query: 'scan another note', expected: 'CURRENCY_SCAN_ANOTHER' },
  { query: 'Hey Navi, enable road detection', expected: 'ROAD_HAZARDS_ENABLE' },
  { query: 'detect potholes', expected: 'ROAD_HAZARDS_DETECT_POTHOLES' },
  { query: 'describe road conditions', expected: 'ROAD_HAZARDS_DESCRIBE' },
  { query: 'enable proximity alerts', expected: 'PROXIMITY_ENABLE_ALERTS' },
  { query: 'read this text', expected: 'OCR_READ_TEXT' },
  { query: 'read the board', expected: 'OCR_READ_BOARD' },
  { query: 'speak slower', expected: 'ASSISTANT_SPEAK_SLOWER' },
  { query: 'speak louder', expected: 'ASSISTANT_SPEAK_LOUDER' },
  { query: 'change language to hindi', expected: 'ASSISTANT_LANG_HINDI' },
  { query: 'change language to punjabi', expected: 'ASSISTANT_LANG_PUNJABI' },
  { query: 'stop speaking', expected: 'ASSISTANT_STOP_SPEAKING' },
  { query: 'be quiet', expected: 'ASSISTANT_STOP_SPEAKING' },
  { query: 'help', expected: 'ASSISTANT_HELP' },
];

console.log('--- TEST RESULTS ---');
let pass = 0;
for (const tc of testCases) {
  const got = classify(tc.query);
  const ok = got === tc.expected;
  if (ok) pass++;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] "${tc.query}" -> ${got} (Expected: ${tc.expected})`);
}

console.log(`\nTOTAL: ${pass}/${testCases.length} Passed (${Math.round((pass/testCases.length)*100)}%)`);
