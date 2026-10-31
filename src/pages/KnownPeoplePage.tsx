import { useEffect, useRef, useState } from 'react'
import { ImagePlus, ShieldCheck, Trash2, Users } from 'lucide-react'
import { createFaceEmbedding, findKnownFace, loadKnownFaceModel, type FaceEmbedding } from '../services/knownFaceRecognition'
import { speak, stopSpeaking } from '../services/speechService'

interface KnownPersonProfile {
  id: string
  name: string
  photo: string
  embedding: FaceEmbedding
  embeddings?: FaceEmbedding[]
  createdAt: number
}

const STORAGE_KEY = 'naviable-known-people-v1'

function readProfiles(): KnownPersonProfile[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const value: unknown = JSON.parse(stored)
    if (!Array.isArray(value)) return []
    return value.filter((item): item is KnownPersonProfile => {
      const isEmbedding = (embedding: unknown): embedding is FaceEmbedding =>
        Array.isArray(embedding) && embedding.length > 0 && embedding.every((entry: unknown) => typeof entry === 'number' && Number.isFinite(entry))
      return Boolean(
        item && typeof item.id === 'string' && typeof item.name === 'string' &&
        typeof item.photo === 'string' && isEmbedding(item.embedding) &&
        (!item.embeddings || (Array.isArray(item.embeddings) && item.embeddings.every(isEmbedding))) &&
        typeof item.createdAt === 'number',
      )
    })
  } catch {
    return []
  }
}

async function makeLocalThumbnail(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare the photo on this device.')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result)
      else reject(new Error('Could not save this photo. Try another image.'))
    }, 'image/jpeg', 0.78)
  })

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read this photo on this device.'))
    reader.readAsDataURL(blob)
  })
}

export default function KnownPeoplePage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const lastMatchRef = useRef<{
    id: string | null
    hits: number[]
    misses: number
    announcedId: string | null
    spokenAt: number
  }>({ id: null, hits: [], misses: 0, announcedId: null, spokenAt: 0 })
  const [profiles, setProfiles] = useState<KnownPersonProfile[]>([])
  const [name, setName] = useState('')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [liveStatus, setLiveStatus] = useState('Family matching is off.')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    setProfiles(readProfiles())
  }, [])

  const saveProfile = async () => {
    if (!name.trim() || photoFiles.length === 0 || saving) return
    setSaving(true)
    setError('')
    setMessage('')

    try {
      setModelStatus('loading')
      await loadKnownFaceModel()
      const newEmbeddings: FaceEmbedding[] = []
      let photo = ''
      for (const [index, file] of photoFiles.slice(0, 5).entries()) {
        const thumbnail = await makeLocalThumbnail(file)
        if (index === 0) photo = thumbnail
        const image = new Image()
        image.src = thumbnail
        await image.decode()
        newEmbeddings.push(await createFaceEmbedding(image))
      }

      const normalizedName = name.trim().toLocaleLowerCase()
      const existing = profiles.find((profile) => profile.name.trim().toLocaleLowerCase() === normalizedName)
      const references = [
        ...(existing?.embeddings?.length ? existing.embeddings : existing ? [existing.embedding] : []),
        ...newEmbeddings,
      ].slice(-8)
      const updatedProfile: KnownPersonProfile = existing
        ? { ...existing, embedding: references[0], embeddings: references }
        : { id: crypto.randomUUID(), name: name.trim(), photo, embedding: references[0], embeddings: references, createdAt: Date.now() }
      const next = existing
        ? profiles.map((profile) => profile.id === existing.id ? updatedProfile : profile)
        : [updatedProfile, ...profiles]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setProfiles(next)
      setModelStatus('ready')
      setName('')
      setPhotoFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      setMessage(existing
        ? `Added reference photos for ${existing.name}. This profile now has ${references.length} photos.`
        : `Photo profile saved with ${references.length} reference photo${references.length === 1 ? '' : 's'}.`)
    } catch (saveError) {
      setModelStatus('error')
      setError(saveError instanceof Error ? saveError.message : 'Could not save this profile on this device.')
    } finally {
      setSaving(false)
    }
  }

  const removeProfile = (id: string) => {
    const next = profiles.filter((profile) => profile.id !== id)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setProfiles(next)
      setMessage('Saved photo removed from this device.')
      setError('')
    } catch {
      setError('Could not update local storage. Try again on this device.')
    }
  }

  const startFamilyScan = async () => {
    if (cameraActive || profiles.length === 0 || !videoRef.current) return
    setError('')
    setLiveStatus('Loading the local face model…')
    setModelStatus('loading')
    try {
      await loadKnownFaceModel()
      setModelStatus('ready')
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is not available in this browser.')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      video.srcObject = stream
      video.muted = true
      video.playsInline = true
      await video.play()
      setCameraActive(true)
      setLiveStatus('Family matching is live. Point the camera at one face at a time.')
      speak('परिवार के सहेजे हुए फ़ोटो से मिलान शुरू है।', 'hi-IN')
    } catch (startError) {
      setModelStatus('error')
      setLiveStatus('Family matching could not start.')
      setError(startError instanceof Error ? startError.message : 'Could not start family matching.')
    }
  }

  const stopFamilyScan = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
    setLiveStatus('Family matching is off.')
    lastMatchRef.current = { id: null, hits: [], misses: 0, announcedId: null, spokenAt: 0 }
    stopSpeaking()
  }

  useEffect(() => {
    if (!cameraActive || !videoRef.current || profiles.length === 0) return
    let inFlight = false
    let stopped = false
    let timer = 0
    const scanOneFrame = async () => {
      const video = videoRef.current
      if (stopped) return
      if (inFlight || !video || video.readyState < 2) {
        timer = window.setTimeout(() => { void scanOneFrame() }, 250)
        return
      }
      inFlight = true
      try {
        const match = await findKnownFace(video, profiles)
        if (stopped) return
        if (match.profile) {
          const now = Date.now()
          const previous = lastMatchRef.current
          const samePerson = previous.id === match.profile.id
          const previousHitExpired = samePerson && previous.hits.length > 0 && now - previous.hits[previous.hits.length - 1] > 6000
          const hits = (samePerson ? previous.hits : []).filter((time) => now - time <= 6000)
          hits.push(now)
          lastMatchRef.current = {
            ...previous,
            id: match.profile.id,
            hits,
            misses: 0,
            announcedId: previousHitExpired ? null : previous.announcedId,
          }
          setLiveStatus(`Possible saved match: ${match.profile.name} · ${Math.round(match.similarity * 100)}% similarity`)
          const confirmed = hits.length >= 2 || (match.similarity >= 0.78 && match.margin >= 0.12)
          if (confirmed && lastMatchRef.current.announcedId !== match.profile.id && now - lastMatchRef.current.spokenAt >= 4500) {
            lastMatchRef.current.announcedId = match.profile.id
            lastMatchRef.current.spokenAt = now
            speak(`सहेजी हुई तस्वीर से संभवतः ${match.profile.name} का मिलान है।`, 'hi-IN')
          }
        } else {
          const previous = lastMatchRef.current
          const misses = previous.misses + 1
          lastMatchRef.current = misses >= 3
            ? { ...previous, id: null, hits: [], misses: 0, announcedId: null }
            : { ...previous, misses }
          if (match.faceCount > 1) {
            setLiveStatus('More than one face is visible. Only one face can be matched at a time.')
          } else if (match.faceCount === 1) {
            setLiveStatus('A face is visible, but no saved profile matched.')
          } else {
            setLiveStatus('No clear face in view.')
          }
        }
      } catch (scanError) {
        if (!stopped) {
          setLiveStatus('Face matching paused.')
          setError(scanError instanceof Error ? scanError.message : 'The local face model could not process this frame.')
        }
      } finally {
        inFlight = false
        if (!stopped) timer = window.setTimeout(() => { void scanOneFrame() }, 500)
      }
    }

    timer = window.setTimeout(() => { void scanOneFrame() }, 200)

    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [cameraActive, profiles])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    stopSpeaking()
  }, [])

  return (
    <main className="min-h-screen px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-200">
            <Users className="h-4 w-4" /> Separate from general person detection
          </div>
          <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Known <span className="gradient-text">people</span>
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-400">
            Save a family member's photo profile on this device. Navi keeps these profiles separate from its general object detector.
          </p>
        </header>

        <section className="glass-card mb-6 border border-cyan-500/20 bg-cyan-500/5 p-5" aria-live="polite">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-300" />
            <div>
              <h2 className="font-semibold text-cyan-100">Separate local face-matching mode</h2>
              <p className="mt-1 text-sm leading-relaxed text-cyan-100/70">
                This mode checks faces only against photo profiles saved in this browser. Add several clear photos of the same person from different angles for a more reliable match. Photos and face embeddings stay on this device.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <section className="glass-card p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Add a photo profile</h2>
            <label className="mb-4 block text-sm text-gray-300" htmlFor="known-person-name">
              Person's name
              <input
                id="known-person-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                autoComplete="off"
                className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none focus:border-cyan-400/50"
                placeholder="For example, Asha"
              />
            </label>

            <label className="mb-4 block text-sm text-gray-300" htmlFor="known-person-photo">
              Clear photos of the same person (up to 5 at a time)
              <input
                ref={fileInputRef}
                id="known-person-photo"
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  const selected = Array.from(event.target.files || [])
                  setPhotoFiles(selected.length > 5 ? [] : selected)
                  setError(selected.length > 5 ? 'Choose up to 5 photos at a time.' : '')
                }}
                className="mt-2 block min-h-12 w-full cursor-pointer rounded-xl border border-white/10 bg-black/20 text-xs text-gray-300 file:mr-3 file:min-h-12 file:border-0 file:bg-cyan-500/15 file:px-4 file:text-cyan-200"
              />
            </label>

            {photoFiles.length > 0 && <p className="mb-4 text-xs text-gray-500">Selected {photoFiles.length} photo{photoFiles.length === 1 ? '' : 's'} · same person, different lighting/angles works best.</p>}
            <button
              type="button"
              onClick={saveProfile}
              disabled={!name.trim() || photoFiles.length === 0 || saving}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ImagePlus className="h-4 w-4" /> {saving ? 'Processing locally…' : 'Save photo profile'}
            </button>

            <div className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-gray-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-400" />
              The photo and face embedding stay in this browser's local storage and are not uploaded. Remove profiles here to delete them.
            </div>
            <p className="mt-3 text-xs text-gray-500">Face model: {modelStatus}</p>
            {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
            {message && <p role="status" className="mt-4 text-sm text-green-300">{message}</p>}
          </section>

          <section className="glass-card p-5" aria-labelledby="saved-people-heading">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="saved-people-heading" className="text-lg font-semibold text-white">Saved on this device</h2>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-gray-400">{profiles.length}</span>
            </div>
            <div className="mb-4 overflow-hidden rounded-xl bg-[#070b14]">
              <div className="relative aspect-video">
                <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
                {!cameraActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 px-5 text-center text-sm text-gray-300">
                    Start family matching to scan for one saved person at a time.
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 p-3">
                <p className="text-xs text-gray-300" role="status" aria-live="polite">{liveStatus}</p>
                <button
                  type="button"
                  onClick={cameraActive ? stopFamilyScan : startFamilyScan}
                  disabled={!cameraActive && profiles.length === 0}
                  className={`min-h-12 rounded-xl px-4 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${cameraActive ? 'border border-red-400/30 bg-red-500/10 text-red-200' : 'bg-cyan-500 text-white'}`}
                >
                  {cameraActive ? 'Stop family matching' : 'Start family matching'}
                </button>
              </div>
            </div>
            {profiles.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-500">No photo profiles saved yet.</p>
            ) : (
              <ul className="space-y-3">
                {profiles.map((profile) => (
                  <li key={profile.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3">
                    <img src={profile.photo} alt={`Saved portrait of ${profile.name}`} className="h-16 w-16 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">{profile.name}</p>
                      <p className="mt-1 text-xs text-gray-500">{profile.embeddings?.length || 1} reference photo{(profile.embeddings?.length || 1) === 1 ? '' : 's'} · stored locally</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeProfile(profile.id)}
                      aria-label={`Remove ${profile.name}'s saved photo`}
                      className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-red-300 transition-colors hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
