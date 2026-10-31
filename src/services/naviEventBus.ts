// ─── Navi Event Bus ───
// A simple pub/sub event bus so Voice Assistant can communicate
// with Dashboard (camera controls, detection queries) without tight coupling.

type EventHandler = (...args: any[]) => void

const handlers: Map<string, Set<EventHandler>> = new Map()

export function naviOn(event: string, handler: EventHandler): () => void {
  if (!handlers.has(event)) handlers.set(event, new Set())
  handlers.get(event)!.add(handler)
  return () => handlers.get(event)?.delete(handler)
}

export function naviEmit(event: string, ...args: any[]): void {
  handlers.get(event)?.forEach(fn => fn(...args))
}

// ─── Shared Detection Store ───
// The dashboard writes detections here; voice assistant reads them.

import type { Detection } from './objectDetection'

let latestDetections: Detection[] = []

export function setLatestDetections(dets: Detection[]): void {
  latestDetections = dets
}

export function getLatestDetections(): Detection[] {
  return latestDetections
}

// Events:
// 'camera:start' — request the dashboard to start camera
// 'camera:stop'  — request the dashboard to stop camera
// 'camera:status' — query if camera is active (listeners respond by setting a value)
