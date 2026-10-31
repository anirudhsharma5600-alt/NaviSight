import { useEffect } from 'react'
import type { FaceProfileMatch } from '../services/knownFaceRecognition'
import { VoiceManager } from '../services/VoiceAnnouncementManager'

const STORAGE_KEY = 'naviable-known-people-v1'

interface StoredKnownPerson extends FaceProfileMatch {
  photo?: string
  createdAt?: number
}

interface KnownPersonLiveAssistProps {
  enabled: boolean
  cameraActive: boolean
  video: HTMLVideoElement | null
  language: 'hi' | 'en'
  beginAnalysis: () => boolean
  endAnalysis: () => void
  onStatus: (status: string) => void
}

function readLocalProfiles(): FaceProfileMatch[] {
  if (typeof window === 'undefined') return []
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(value)) return []
    return (value as StoredKnownPerson[]).filter((profile) =>
      profile && typeof profile.id === 'string' && typeof profile.name === 'string' &&
      profile.name.trim().length > 0 && Array.isArray(profile.embedding) &&
      profile.embedding.length > 0 && profile.embedding.every((entry) => Number.isFinite(entry)) &&
      (!profile.embeddings || (Array.isArray(profile.embeddings) && profile.embeddings.every((embedding) =>
        Array.isArray(embedding) && embedding.length > 0 && embedding.every((entry) => Number.isFinite(entry)),
      )))
    ).map(({ id, name, embedding, embeddings }) => ({ id, name, embedding, embeddings }))
  } catch {
    return []
  }
}

/** Opt-in saved-family matching on the existing Vision camera stream. */
export default function KnownPersonLiveAssist({
  enabled,
  cameraActive,
  video,
  language,
  beginAnalysis,
  endAnalysis,
  onStatus,
}: KnownPersonLiveAssistProps) {
  useEffect(() => {
    if (!enabled) {
      return
    }
    if (!cameraActive || !video) {
      onStatus('Start the Vision camera to check saved family photos.')
      return
    }
    const profiles = readLocalProfiles()
    if (profiles.length === 0) {
      onStatus('No saved family photos. Add a profile in Known People first.')
      return
    }

    let stopped = false
    let inFlight = false
    let timer = 0
    let candidateId: string | null = null
    let candidateHits: number[] = []
    let missedFrames = 0
    let announcedId: string | null = null
    let lastAttemptAt = 0

    const runOneFrame = async () => {
      if (stopped || inFlight || !video || video.readyState < 2 || !beginAnalysis()) {
        if (!stopped) timer = window.setTimeout(() => { void runOneFrame() }, 250)
        return
      }
      inFlight = true
      try {
        const { findKnownFace } = await import('../services/knownFaceRecognition')
        const match = await findKnownFace(video, profiles)
        if (stopped) return

        if (!match.profile) {
          missedFrames += 1
          if (missedFrames >= 3 || (candidateHits.length > 0 && Date.now() - candidateHits[candidateHits.length - 1] > 6000)) {
            candidateId = null
            candidateHits = []
            announcedId = null
          }
          onStatus(match.faceCount > 1
            ? 'More than one face is visible; family matching is waiting for one face.'
            : match.faceCount === 1
              ? 'A face is visible, but none of the saved family photos matched.'
              : 'No clear face in view; saved-family matching is waiting.')
          return
        }

        const id = match.profile.id
        const now = Date.now()
        if (candidateId === id && candidateHits.length > 0 && now - candidateHits[candidateHits.length - 1] > 6000) {
          candidateHits = []
          announcedId = null
        }
        if (candidateId !== id) {
          candidateId = id
          candidateHits = []
          announcedId = null
        }
        missedFrames = 0
        candidateHits = candidateHits.filter((time) => now - time <= 6000)
        candidateHits.push(now)
        candidateId = id
        const confirmed = candidateHits.length >= 2 || (match.similarity >= 0.78 && match.margin >= 0.12)
        onStatus(confirmed
          ? `Possible saved match: ${match.profile.name} (${Math.round(match.similarity * 100)}%).`
          : 'Checking one face against saved family photos…')

        if (confirmed && announcedId !== id && Date.now() - lastAttemptAt >= 4000) {
          lastAttemptAt = Date.now()
          const phrase = language === 'hi'
            ? `संभवतः आपके परिवार के सदस्य ${match.profile.name} का सहेजी हुई तस्वीर से मिलान है।`
            : `This may be your family member ${match.profile.name}, matched to a saved photo.`
          if (VoiceManager.announce(phrase, 'NORMAL', { lang: language, domain: 'scene', cooldownMs: 12000 })) {
            announcedId = id
          }
        }
      } catch (error) {
        if (!stopped) {
          onStatus(error instanceof Error ? `Family match paused: ${error.message}` : 'Family matching paused because the face model could not process this frame.')
        }
      } finally {
        inFlight = false
        endAnalysis()
        if (!stopped) timer = window.setTimeout(() => { void runOneFrame() }, 500)
      }
    }

    onStatus('Loading the local family-match model…')
    void import('../services/knownFaceRecognition')
      .then(({ loadKnownFaceModel }) => loadKnownFaceModel())
      .then(() => {
        if (stopped) return
        onStatus('Saved-family matching is on. Only saved photos are checked.')
        timer = window.setTimeout(() => { void runOneFrame() }, 200)
      })
      .catch((error) => {
        if (!stopped) onStatus(error instanceof Error ? `Family model unavailable: ${error.message}` : 'Family model unavailable.')
      })

    return () => {
      stopped = true
      if (timer) window.clearTimeout(timer)
    }
  }, [enabled, cameraActive, video, language, beginAnalysis, endAnalysis, onStatus])

  return null
}
