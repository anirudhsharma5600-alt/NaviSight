import type { Detection } from './objectDetection'

// ─── Types ───

export interface SceneDescription {
  text: string
  objectCount: number
  uniqueClasses: string[]
  timestamp: number
}

// ─── Announcement Cooldown ───

const lastAnnouncedTime: Map<string, number> = new Map()
const ANNOUNCEMENT_COOLDOWN_MS = 3000 // Don't re-announce same class within 3s

function shouldAnnounce(className: string): boolean {
  const now = Date.now()
  const last = lastAnnouncedTime.get(className) || 0
  if (now - last < ANNOUNCEMENT_COOLDOWN_MS) return false
  lastAnnouncedTime.set(className, now)
  return true
}

// ─── Object Grouping ───

interface GroupedObject {
  class: string
  count: number
  positions: Set<string>
  avgScore: number
  maxArea: number
}

function groupDetections(detections: Detection[]): GroupedObject[] {
  const groups: Map<string, GroupedObject> = new Map()

  for (const d of detections) {
    const area = d.bbox[2] * d.bbox[3]
    const existing = groups.get(d.class)

    if (existing) {
      existing.count++
      existing.positions.add(d.position)
      existing.avgScore = (existing.avgScore * (existing.count - 1) + d.score) / existing.count
      existing.maxArea = Math.max(existing.maxArea, area)
    } else {
      groups.set(d.class, {
        class: d.class,
        count: 1,
        positions: new Set([d.position]),
        avgScore: d.score,
        maxArea: area,
      })
    }
  }

  // Sort by area (larger = closer/more important) then by count
  return Array.from(groups.values()).sort((a, b) => b.maxArea - a.maxArea || b.count - a.count)
}

// ─── Position Description ───

function describePosition(positions: Set<string>): string {
  const arr = Array.from(positions)
  if (arr.length === 3) return 'across the view'
  if (arr.length === 2) {
    if (arr.includes('LEFT') && arr.includes('RIGHT')) return 'on both sides'
    if (arr.includes('LEFT') && arr.includes('CENTRE')) return 'to the left and centre'
    return 'to the centre and right'
  }
  if (arr[0] === 'LEFT') return 'on the left'
  if (arr[0] === 'RIGHT') return 'on the right'
  return 'in the centre'
}

// ─── Plural Helper ───

function plural(word: string, count: number): string {
  if (count === 1) return `a ${word}`
  return `${count} ${word}s`
}

// ─── Scene Description Generator ───

export function generateSceneDescription(
  detections: Detection[],
  minConfidence = 0.45
): SceneDescription {
  const filtered = detections.filter(d => d.score >= minConfidence)

  if (filtered.length === 0) {
    return {
      text: 'No objects detected in your surroundings.',
      objectCount: 0,
      uniqueClasses: [],
      timestamp: Date.now(),
    }
  }

  const groups = groupDetections(filtered)
  const uniqueClasses = groups.map(g => g.class)

  // Build natural language description
  const parts: string[] = []

  for (const group of groups) {
    const posDesc = describePosition(group.positions)
    parts.push(`${plural(group.class, group.count)} ${posDesc}`)
  }

  let text: string
  if (parts.length === 1) {
    text = `Navi can see ${parts[0]}.`
  } else if (parts.length === 2) {
    text = `Navi can see ${parts[0]} and ${parts[1]}.`
  } else {
    const last = parts.pop()
    text = `Navi can see ${parts.join(', ')}, and ${last}.`
  }

  return {
    text,
    objectCount: filtered.length,
    uniqueClasses,
    timestamp: Date.now(),
  }
}

// ─── Quick Announcement (for new detections) ───

export function generateNewDetectionAnnouncements(detections: Detection[]): string[] {
  const announcements: string[] = []

  for (const d of detections) {
    if (d.score < 0.5) continue
    if (!shouldAnnounce(d.class)) continue

    const pos = d.position === 'CENTRE' ? 'ahead' : `on the ${d.position.toLowerCase()}`
    announcements.push(`${d.class} ${pos}`)
  }

  return announcements
}

// ─── Reset ───

export function resetAnnouncementCooldowns(): void {
  lastAnnouncedTime.clear()
}

