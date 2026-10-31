import { Human } from '@vladmandic/human'

export type FaceEmbedding = number[]

export interface FaceProfileMatch {
  id: string
  name: string
  embedding: FaceEmbedding
}

export interface FaceMatchResult {
  profile: FaceProfileMatch | null
  similarity: number
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
        detector: { maxDetected: 5, rotation: true, return: true },
        mesh: { enabled: true },
        description: { enabled: true },
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
  const faces = (results.face || []).filter((face) => face.embedding && (face.score ?? 0) >= 0.65)
  if (faces.length !== 1 || !faces[0].embedding || profiles.length === 0) {
    return { profile: null, similarity: 0, faceCount: faces.length }
  }

  let best: FaceProfileMatch | null = null
  let bestSimilarity = 0
  for (const profile of profiles) {
    const similarity = getHuman().match.similarity(faces[0].embedding, profile.embedding)
    if (Number.isFinite(similarity) && similarity > bestSimilarity) {
      best = profile
      bestSimilarity = similarity
    }
  }

  // High threshold: uncertain faces remain unidentified.
  if (bestSimilarity < 0.72) return { profile: null, similarity: bestSimilarity, faceCount: faces.length }
  return { profile: best, similarity: bestSimilarity, faceCount: faces.length }
}
