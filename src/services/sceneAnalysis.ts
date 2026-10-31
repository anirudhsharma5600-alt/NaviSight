import type { Detection } from './objectDetection'

export type ScanAreaMode = 'focused' | 'wide'
export type EstimatedRange = 'close' | 'nearby' | 'far'
export type TargetMovement = 'approaching' | 'receding' | 'steady' | 'unknown'
export type SpeechLanguage = 'en' | 'hi'

export interface ScanRegion {
  left: number
  top: number
  width: number
  height: number
  label: string
}

export interface SceneObject {
  detection: Detection
  range: EstimatedRange
  movement: TargetMovement
}

interface ObservationSample {
  area: number
  at: number
}

const REGIONS: Record<ScanAreaMode, ScanRegion> = {
  focused: { left: 0.2, top: 0.08, width: 0.6, height: 0.84, label: 'focused area' },
  wide: { left: 0.04, top: 0.04, width: 0.92, height: 0.92, label: 'wide area' },
}

const targetHistory = new Map<number, { className: string; samples: ObservationSample[]; lastSeen: number }>()

export function getScanRegion(mode: ScanAreaMode): ScanRegion {
  return { ...REGIONS[mode] }
}

export function keepDetectionsInScanArea(
  detections: Detection[],
  frameWidth: number,
  frameHeight: number,
  mode: ScanAreaMode,
): Detection[] {
  if (frameWidth <= 0 || frameHeight <= 0) return []
  const region = REGIONS[mode]
  const right = region.left + region.width
  const bottom = region.top + region.height

  return detections.filter((detection) => {
    const centerX = (detection.bbox[0] + detection.bbox[2] / 2) / frameWidth
    const centerY = (detection.bbox[1] + detection.bbox[3] / 2) / frameHeight
    return centerX >= region.left && centerX <= right && centerY >= region.top && centerY <= bottom
  })
}

function estimateRange(areaRatio: number, heightRatio: number): EstimatedRange {
  if (areaRatio >= 0.24 || heightRatio >= 0.52) return 'close'
  if (areaRatio >= 0.065 || heightRatio >= 0.25) return 'nearby'
  return 'far'
}

export function analyzeSceneObjects(
  detections: Detection[],
  frameWidth: number,
  frameHeight: number,
  now = Date.now(),
): SceneObject[] {
  const frameArea = frameWidth * frameHeight
  if (frameArea <= 0 || frameHeight <= 0) return []

  const activeIds = new Set<number>()
  const objects = detections.map((detection) => {
    const [, , width, height] = detection.bbox
    const area = (width * height) / frameArea
    const samplesForTarget = targetHistory.get(detection.id)
    const history = samplesForTarget?.className === detection.class
      ? samplesForTarget.samples
      : []
    history.push({ area, at: now })
    while (history.length > 6) history.shift()
    targetHistory.set(detection.id, { className: detection.class, samples: history, lastSeen: now })
    activeIds.add(detection.id)

    let movement: TargetMovement = 'unknown'
    if (history.length >= 4 && now - history[0].at >= 900) {
      const firstArea = history[0].area
      const areaChange = (area - firstArea) / Math.max(firstArea, 0.015)
      if (areaChange > 0.2) movement = 'approaching'
      else if (areaChange < -0.2) movement = 'receding'
      else movement = 'steady'
    }

    return {
      detection,
      range: estimateRange(area, height / frameHeight),
      movement,
    }
  })

  for (const [id, history] of targetHistory) {
    if (!activeIds.has(id) && now - history.lastSeen > 1500) targetHistory.delete(id)
  }

  const rangeOrder: Record<EstimatedRange, number> = { close: 0, nearby: 1, far: 2 }
  const movementOrder: Record<TargetMovement, number> = { approaching: 0, steady: 1, unknown: 2, receding: 3 }
  return objects.sort((a, b) =>
    rangeOrder[a.range] - rangeOrder[b.range] ||
    movementOrder[a.movement] - movementOrder[b.movement] ||
    b.detection.score - a.detection.score,
  )
}

export function resetSceneAnalysis(): void {
  targetHistory.clear()
}

function directionWord(detection: Detection, language: SpeechLanguage): string {
  if (language === 'hi') {
    if (detection.position === 'LEFT') return 'आपके बाईं ओर'
    if (detection.position === 'RIGHT') return 'आपके दाईं ओर'
    return 'सामने'
  }
  if (detection.position === 'LEFT') return 'on your left'
  if (detection.position === 'RIGHT') return 'on your right'
  return 'ahead'
}

function rangeWord(range: EstimatedRange, language: SpeechLanguage): string {
  if (language === 'hi') {
    if (range === 'close') return 'पास'
    if (range === 'nearby') return 'कुछ दूरी पर'
    return 'दूर'
  }
  if (range === 'close') return 'close'
  if (range === 'nearby') return 'a short distance away'
  return 'farther away'
}

function movementWord(movement: TargetMovement, language: SpeechLanguage): string {
  if (language === 'hi') {
    if (movement === 'approaching') return 'करीब आता हुआ दिखाई दे रहा है'
    if (movement === 'receding') return 'दूर जाता हुआ दिखाई दे रहा है'
    if (movement === 'steady') return 'स्थिर दिखाई दे रहा है'
    return ''
  }
  if (movement === 'approaching') return 'appears to be getting closer'
  if (movement === 'receding') return 'appears to be moving away'
  if (movement === 'steady') return 'appears steady'
  return ''
}

function objectName(className: string, language: SpeechLanguage): string {
  if (language === 'hi') {
    const names: Record<string, string> = {
      person: 'व्यक्ति', chair: 'कुर्सी', couch: 'सोफ़ा', car: 'कार', bus: 'बस',
      bicycle: 'साइकिल', motorcycle: 'मोटरसाइकिल', dog: 'कुत्ता', cat: 'बिल्ली',
      bottle: 'बोतल', cup: 'कप', book: 'किताब', backpack: 'बैग', suitcase: 'सूटकेस',
      'cell phone': 'मोबाइल फ़ोन', laptop: 'लैपटॉप', 'dining table': 'मेज़',
    }
    return names[className] || className
  }
  return className.replace(/_/g, ' ')
}

export function describeScene(
  objects: SceneObject[],
  mode: ScanAreaMode,
  language: SpeechLanguage,
  sensorDistanceCm: number | null,
): string {
  const sensorNote = sensorDistanceCm !== null
    ? language === 'hi'
      ? ` दूरी सेंसर अपनी दिशा में ${Math.round(sensorDistanceCm)} सेंटीमीटर माप रहा है; उस वस्तु का नाम पहचाना नहीं गया है।`
      : ` The distance sensor measures ${Math.round(sensorDistanceCm)} centimetres in its facing direction; it has not identified the object.`
    : ''

  if (objects.length === 0) {
    return language === 'hi'
      ? `इस ${mode === 'focused' ? 'केंद्र वाले' : 'चौड़े'} क्षेत्र में कोई वस्तु साफ़ पहचान में नहीं आई। वस्तु धुंधली, बहुत दूर या मॉडल की पहचान सूची से बाहर हो सकती है। कैमरे को धीरे घुमाएँ। कैमरे से दूरी का सही माप नहीं मिलता।${sensorNote}`
      : `I could not clearly identify an object in the ${mode} area. It may be blurred, too far away, or outside the model's supported classes. Move the camera slowly. The camera cannot give an exact distance.${sensorNote}`
  }

  const groups = new Map<string, { count: number; positions: Set<Detection['position']> }>()
  for (const item of objects) {
    const group = groups.get(item.detection.class) || { count: 0, positions: new Set<Detection['position']>() }
    group.count += 1
    group.positions.add(item.detection.position)
    groups.set(item.detection.class, group)
  }

  const groupSummary = [...groups.entries()].slice(0, 4).map(([className, group]) => {
    const positions = [...group.positions].map((position) => directionWord({ position } as Detection, language))
    const where = positions.length > 1 ? (language === 'hi' ? 'कई जगह' : 'in several places') : positions[0]
    if (language === 'hi') return `${group.count} ${objectName(className, language)} ${where}`
    const name = objectName(className, language)
    const plural = className === 'person' ? 'people' : `${name}s`
    return `${group.count === 1 ? `a ${name}` : `${group.count} ${plural}`} ${where}`
  })

  const detail = objects.slice(0, 3).map((item) => {
    const name = objectName(item.detection.class, language)
    const where = directionWord(item.detection, language)
    const range = rangeWord(item.range, language)
    const movement = movementWord(item.movement, language)
    return language === 'hi'
      ? `${where} ${name} ${range} है${movement ? ` और ${movement}` : ''}`
      : `${name} ${where} appears ${range}${movement ? ` and ${movement}` : ''}`
  })

  if (language === 'hi') {
    return `आपके ${mode === 'focused' ? 'केंद्र वाले' : 'चौड़े'} क्षेत्र में ${groupSummary.join(' और ')} दिख रहे हैं। ${detail.join('। ')}। ये कैमरे के आकार पर आधारित अनुमान हैं, मीटर का माप नहीं।${sensorNote}`
  }
  return `In your ${mode} area, I see ${groupSummary.join(', ')}. ${detail.join('. ')}. Visual range and movement are estimates, not a measured distance.${sensorNote}`
}
