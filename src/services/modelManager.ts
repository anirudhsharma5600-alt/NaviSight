import { getModelStatus, loadModel, type ModelStatus } from './objectDetection'
import { isSpeechSynthesisSupported, isSpeechRecognitionSupported } from './speechService'

// ─── Types ───

export interface AIServiceStatus {
  objectDetection: ModelStatus
  ocrEngine: 'idle' | 'ready' | 'loading' | 'error'
  camera: 'active' | 'inactive'
  microphone: 'active' | 'inactive'
  voiceRecognition: 'available' | 'unsupported'
  textToSpeech: 'available' | 'unsupported'
  wakeWord: 'disabled'
  roadIntelligence: 'not_installed'
  soundIntelligence: 'not_installed'
}

// ─── State ───

let cameraStatus: 'active' | 'inactive' = 'inactive'
let microphoneStatus: 'active' | 'inactive' = 'inactive'
let ocrStatus: 'idle' | 'ready' | 'loading' | 'error' = 'idle'

type StatusChangeListener = (status: AIServiceStatus) => void
const listeners: Set<StatusChangeListener> = new Set()

function notifyListeners() {
  const status = getFullStatus()
  listeners.forEach(fn => fn(status))
}

export function onStatusChange(fn: StatusChangeListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// ─── Status Getters/Setters ───

export function setCameraStatus(s: 'active' | 'inactive') {
  cameraStatus = s
  notifyListeners()
}

export function setMicrophoneStatus(s: 'active' | 'inactive') {
  microphoneStatus = s
  notifyListeners()
}

export function setOCRStatus(s: 'idle' | 'ready' | 'loading' | 'error') {
  ocrStatus = s
  notifyListeners()
}

export function getFullStatus(): AIServiceStatus {
  return {
    objectDetection: getModelStatus(),
    ocrEngine: ocrStatus,
    camera: cameraStatus,
    microphone: microphoneStatus,
    voiceRecognition: isSpeechRecognitionSupported() ? 'available' : 'unsupported',
    textToSpeech: isSpeechSynthesisSupported() ? 'available' : 'unsupported',
    wakeWord: 'disabled',
    roadIntelligence: 'not_installed',
    soundIntelligence: 'not_installed',
  }
}

// ─── Initialization ───

export async function initializeAI(): Promise<void> {
  try {
    await loadModel()
  } catch (err) {
    console.error('[ModelManager] Failed to load detection model:', err)
  }
  notifyListeners()
}

