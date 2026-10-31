import { Human } from '@vladmandic/human'

export type FaceEmbedding = number[]

export interface FaceProfileMatch {
  id: string
  name: string
  embedding: FaceEmbedding
  embeddings?: FaceEmbedding[]
}

export interface FaceMatchResult {
  profile: FaceProfileMatch | null
  similarity: number
  margin: number
  faceCount: number
}

interface HumanFaceResult {
  embedding?: number[]
  score?: number
}

interface HumanFaceApi {
  load(): Promise<void>
  detect(input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<{ face?: HumanFaceResult[] }>
  match: { similarity(first: number[], second: number[]): number }
}

let human: HumanFaceApi | null = null
let loading: Promise<void> | null = null
let loaded = false

function getHuman(): HumanFaceApi {
  if (!human) {
    human = new Human({
      backend: 'webgl',
      modelBasePath: '/models/faces/',
      face: {
        enabled: true,
        // This is a live matcher. Human's defaults reuse the detector box for
        // up to 99 frames and the face descriptor for 3 seconds, which makes
        // repeated checks compare stale frames instead of the current face.
        detector: { maxDetected: 2, rotation: true, return: true, skipFrames: 0, skipTime: 0, minConfidence: 0.2 },
        // Keep the same alignment path used when existing family profiles were
        // enrolled; only disable stale frame/descriptor reuse above.
        mesh: { enabled: true },
        description: { enabled: true, skipFrames: 0, skipTime: 0, minConfidence: 0.1 },
        iris: { enabled: false },
        emotion: { enabled: false },
        antispoof: { enabled: false },
        liveness: { enabled: false },
      },
      body: { enabled: false },
      hand: { enabled: false },
      object: { enabled: false },
      segmentation: { enabled: false },
      gesture: { enabled: false },
    }) as unknown as HumanFaceApi
  }
  return human
}

export async function loadKnownFaceModel(): Promise<void> {
  if (loaded) return
  if (loading) return loading
  const instance = getHuman()
  loading = instance.load()
  try {
    await loading
    loaded = true
  } finally {
    loading = null
  }
}

export async function createFaceEmbedding(
  input: HTMLImageElement | HTMLCanvasElement,
): Promise<FaceEmbedding> {
  await loadKnownFaceModel()
  const results = await getHuman().detect(input)
  const faces = (results.face || []).filter((face) => face.embedding && (face.score ?? 0) >= 0.65)
  if (faces.length !== 1 || !faces[0].embedding) {
    throw new Error(faces.length === 0
      ? 'No clear face found. Choose a brighter, front-facing photo.'
      : 'Use a photo with only one clear face.')
  }
  return Array.from(faces[0].embedding)
}

export async function findKnownFace(
  input: HTMLVideoElement,
  profiles: FaceProfileMatch[],
): Promise<FaceMatchResult> {
  await loadKnownFaceModel()
  const results = await getHuman().detect(input)
  const faces = (results.face || []).filter((face) => face.embedding && (face.score ?? 0) >= 0.5)
  if (faces.length !== 1 || !faces[0].embedding || profiles.length === 0) {
    return { profile: null, similarity: 0, margin: 0, faceCount: faces.length }
  }

  let best: FaceProfileMatch | null = null
  let bestSimilarity = 0
  let secondBestSimilarity = 0
  for (const profile of profiles) {
    const references = profile.embeddings?.length ? profile.embeddings : [profile.embedding]
    let profileSimilarity = 0
    for (const reference of references) {
      if (reference.length !== faces[0].embedding.length) continue
      const similarity = getHuman().match.similarity(faces[0].embedding, reference)
      if (Number.isFinite(similarity) && similarity > profileSimilarity) {
        profileSimilarity = similarity
      }
    }

    if (profileSimilarity > bestSimilarity) {
      secondBestSimilarity = bestSimilarity
      best = profile
      bestSimilarity = profileSimilarity
    } else if (profileSimilarity > secondBestSimilarity) {
      secondBestSimilarity = profileSimilarity
    }
  }

  const margin = profiles.length > 1 ? bestSimilarity - secondBestSimilarity : bestSimilarity

  // Keep recognition cautious with a relative-margin check. Live callers use
  // repeated-frame evidence when a match is not exceptionally strong.
  if (bestSimilarity < 0.6 || (profiles.length > 1 && margin < 0.04)) {
    return { profile: null, similarity: bestSimilarity, margin, faceCount: faces.length }
  }
  return { profile: best, similarity: bestSimilarity, margin, faceCount: faces.length }
}
