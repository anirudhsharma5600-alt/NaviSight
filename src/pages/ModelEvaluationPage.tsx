import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import {
  COCO_CLASSES,
  detectObjectsInImage,
  getConfig,
  loadModel,
  type Detection,
} from '../services/objectDetection'

interface EvalBox {
  class: string
  bbox: [number, number, number, number]
  score?: number
}

interface EvalImage {
  id: string
  name: string
  objectUrl: string
  width: number
  height: number
  captureSession: string
  reviewed: boolean
  groundTruth: EvalBox[]
  predictions: EvalBox[] | null
  inferenceLatencyMs: number | null
}

interface DraftBox {
  x: number
  y: number
  width: number
  height: number
}

function loadLocalImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('This image could not be opened.'))
    image.src = url
  })
}

function clamp(value: number, max: number): number {
  return Math.max(0, Math.min(max, value))
}

function formatBox(box: EvalBox): string {
  const score = box.score === undefined ? '' : ` · ${(box.score * 100).toFixed(0)}%`
  return `${box.class}${score}`
}

export default function ModelEvaluationPage() {
  const [images, setImages] = useState<EvalImage[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [datasetName, setDatasetName] = useState('NaviAble object baseline v1')
  const [split, setSplit] = useState<'validation' | 'test'>('validation')
  const [device, setDevice] = useState('')
  const [className, setClassName] = useState('')
  const [drawingStart, setDrawingStart] = useState<{ x: number; y: number } | null>(null)
  const [draftBox, setDraftBox] = useState<DraftBox | null>(null)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [running, setRunning] = useState(false)
  const [loadingModel, setLoadingModel] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const objectUrlsRef = useRef<string[]>([])
  const activeImage = images[activeIndex]
  const config = useMemo(() => getConfig(), [])

  useEffect(() => () => {
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !activeImage?.width || !activeImage.height) return
    if (canvas.width !== activeImage.width) canvas.width = activeImage.width
    if (canvas.height !== activeImage.height) canvas.height = activeImage.height

    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.lineWidth = Math.max(2, Math.min(canvas.width, canvas.height) / 300)
    context.font = `bold ${Math.max(14, Math.min(canvas.width, canvas.height) / 45)}px sans-serif`

    const drawBox = (box: EvalBox, color: string, prefix: string) => {
      const [x, y, width, height] = box.bbox
      context.strokeStyle = color
      context.fillStyle = color
      context.strokeRect(x, y, width, height)
      const label = `${prefix}${formatBox(box)}`
      const labelWidth = context.measureText(label).width + 12
      const labelHeight = Math.max(22, Math.min(canvas.width, canvas.height) / 26)
      const labelY = Math.max(labelHeight, y)
      context.fillRect(x, labelY - labelHeight, labelWidth, labelHeight)
      context.fillStyle = '#07111d'
      context.fillText(label, x + 6, labelY - 5)
    }

    activeImage.groundTruth.forEach(box => drawBox(box, '#4ade80', 'GT: '))
    activeImage.predictions?.forEach(box => drawBox(box, '#22d3ee', 'AI: '))
    if (draftBox && draftBox.width > 1 && draftBox.height > 1) {
      context.strokeStyle = '#facc15'
      context.setLineDash([8, 5])
      context.strokeRect(draftBox.x, draftBox.y, draftBox.width, draftBox.height)
      context.setLineDash([])
    }
  }, [activeImage, draftBox])

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setError('')
    setLoadingFiles(true)
    const nextObjectUrls: string[] = []

    try {
      const records: EvalImage[] = []
      for (const [index, file] of Array.from(files).entries()) {
        if (!file.type.startsWith('image/')) continue
        const objectUrl = URL.createObjectURL(file)
        nextObjectUrls.push(objectUrl)
        const image = await loadLocalImage(objectUrl)
        records.push({
          id: `image-${String(index + 1).padStart(3, '0')}`,
          name: file.name,
          objectUrl,
          width: image.naturalWidth,
          height: image.naturalHeight,
          captureSession: 'session-1',
          reviewed: false,
          groundTruth: [],
          predictions: null,
          inferenceLatencyMs: null,
        })
      }
      if (records.length === 0) throw new Error('Choose one or more image files.')
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
      objectUrlsRef.current = nextObjectUrls
      setImages(records)
      setActiveIndex(0)
    } catch (loadError) {
      nextObjectUrls.forEach(url => URL.revokeObjectURL(url))
      setError(loadError instanceof Error ? loadError.message : 'Could not read the selected images.')
    } finally {
      setLoadingFiles(false)
    }
  }

  function pointFromEvent(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    return {
      x: clamp((event.clientX - rect.left) * canvas.width / rect.width, canvas.width),
      y: clamp((event.clientY - rect.top) * canvas.height / rect.height, canvas.height),
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!activeImage || !className.trim()) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointFromEvent(event)
    setDrawingStart(point)
    setDraftBox({ ...point, width: 0, height: 0 })
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingStart || !activeImage) return
    const point = pointFromEvent(event)
    setDraftBox({
      x: Math.min(drawingStart.x, point.x),
      y: Math.min(drawingStart.y, point.y),
      width: Math.abs(point.x - drawingStart.x),
      height: Math.abs(point.y - drawingStart.y),
    })
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingStart || !activeImage) return
    const point = pointFromEvent(event)
    const box: EvalBox = {
      class: className.trim().toLowerCase(),
      bbox: [
        Math.min(drawingStart.x, point.x),
        Math.min(drawingStart.y, point.y),
        Math.abs(point.x - drawingStart.x),
        Math.abs(point.y - drawingStart.y),
      ],
    }
    if (box.bbox[2] >= 6 && box.bbox[3] >= 6) {
      setImages(previous => previous.map((image, index) => index === activeIndex
        ? { ...image, groundTruth: [...image.groundTruth, box] }
        : image))
    }
    setDrawingStart(null)
    setDraftBox(null)
  }

  async function runPredictions() {
    if (!images.length || running) return
    setRunning(true)
    setLoadingModel(true)
    setProgress(0)
    setError('')
    try {
      await loadModel()
      setLoadingModel(false)
      for (let index = 0; index < images.length; index++) {
        const image = await loadLocalImage(images[index].objectUrl)
        const startedAt = performance.now()
        const detections = await detectObjectsInImage(image, { resizeMaxDim: 640 })
        const inferenceLatencyMs = performance.now() - startedAt
        const predictions: EvalBox[] = detections.map((detection: Detection) => ({
          class: detection.class.toLowerCase(),
          score: detection.score,
          bbox: detection.bbox,
        }))
        setImages(previous => previous.map((record, recordIndex) => recordIndex === index
          ? { ...record, predictions, inferenceLatencyMs }
          : record))
        setProgress(index + 1)
      }
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Model prediction did not complete.')
    } finally {
      setLoadingModel(false)
      setRunning(false)
    }
  }

  function exportManifest() {
    if (!images.length || images.some(image => image.predictions === null || !image.reviewed) || !datasetName.trim() || !device.trim()) {
      setError('Run predictions, review and label every image (including true empty scenes), then enter the dataset name and tested device before exporting.')
      return
    }

    const manifest = {
      schema_version: 1,
      model: {
        name: 'COCO-SSD lite_mobilenet_v2',
        version: 'bundled @tensorflow-models/coco-ssd',
        runtime: 'TensorFlow.js in browser',
        device: device.trim(),
        resize_max_dimension: 640,
        confidence_threshold: config.confidenceThreshold,
        inference_timing: 'Warmed model; excludes model download/load, camera capture, and audio playback.',
      },
      dataset: {
        name: datasetName.trim(),
        split,
        capture_sessions: new Set(images.map(image => image.captureSession.trim()).filter(Boolean)).size,
        label_source: 'manual bounding boxes by project team',
      },
      images: images.map(image => ({
        id: image.id,
        width: image.width,
        height: image.height,
        capture_session: image.captureSession.trim(),
        reviewed: image.reviewed,
        ground_truth: image.groundTruth,
        predictions: image.predictions,
        inference_latency_ms: image.inferenceLatencyMs,
      })),
    }

    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${datasetName.trim().replace(/[^a-z0-9-_]+/gi, '-')}-${split}.json`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setError('')
  }

  const annotatedCount = images.reduce((total, image) => total + image.groundTruth.length, 0)
  const predictionReady = images.length > 0 && images.every(image => image.predictions !== null)

  return (
    <main className="min-h-screen px-4 pb-24 pt-24 text-white sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Developer tool · local processing</p>
          <h1 className="mt-2 text-3xl font-bold">Object model evaluation set</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Load consented images, draw ground-truth boxes, run the bundled detector, and download a reproducible evaluation manifest. Images stay in this browser; nothing is uploaded.
          </p>
          <p className="mt-2 max-w-3xl text-xs text-slate-400">
            The first model run may need to download detector weights. The selected image files remain on this device.
          </p>
        </header>

        <section className="grid gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:grid-cols-3">
          <label className="space-y-1 text-xs text-slate-300">
            Dataset name
            <input value={datasetName} onChange={event => setDatasetName(event.target.value)} className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" />
          </label>
          <label className="space-y-1 text-xs text-slate-300">
            Split
            <select value={split} onChange={event => setSplit(event.target.value as 'validation' | 'test')} className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white">
              <option value="validation">Validation</option>
              <option value="test">Hold-out test</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-300">
            Device used for this run
            <input value={device} onChange={event => setDevice(event.target.value)} placeholder="e.g. Pixel model + Android version" className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
          </label>
        </section>

        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          <label className="cursor-pointer rounded-xl bg-cyan-700 px-4 py-3 text-sm font-semibold hover:bg-cyan-600">
            {loadingFiles ? 'Loading images…' : 'Choose local images'}
            <input type="file" accept="image/*" multiple className="sr-only" disabled={loadingFiles || running} onChange={event => { void handleFiles(event.target.files); event.currentTarget.value = '' }} />
          </label>
          <button type="button" onClick={() => { void runPredictions() }} disabled={!images.length || running || loadingFiles} className="rounded-xl border border-cyan-400/40 px-4 py-3 text-sm font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40">
            {running ? loadingModel ? 'Loading detector model…' : `Running model ${progress}/${images.length}…` : 'Run model on all images'}
          </button>
          <button type="button" onClick={exportManifest} disabled={!predictionReady || running} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40">
            Download evaluation JSON
          </button>
          <span className="text-xs text-slate-400">Current app threshold: {Math.round(config.confidenceThreshold * 100)}% · Model input max: 640 px</span>
        </section>

        {error && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</p>}

        {images.length > 0 ? (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{activeImage?.name}</h2>
                  <p className="text-xs text-slate-400">{activeImage?.width}×{activeImage?.height} · {activeIndex + 1} of {images.length}</p>
                </div>
                <label className="text-xs text-slate-300">
                  Capture session
                  <input value={activeImage?.captureSession || ''} onChange={event => setImages(previous => previous.map((image, index) => index === activeIndex ? { ...image, captureSession: event.target.value } : image))} className="ml-2 w-32 rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-white" />
                </label>
              </div>
              <div className="relative inline-block w-full overflow-hidden rounded-xl bg-black">
                <img src={activeImage?.objectUrl} alt="Selected evaluation frame" className="block h-auto w-full" />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 h-full w-full touch-none"
                  aria-label="Image annotation canvas. Drag to draw a ground-truth box."
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={() => { setDrawingStart(null); setDraftBox(null) }}
                />
              </div>
              <p className="text-xs text-slate-400">Ground truth boxes are green; model predictions are cyan; an active annotation is yellow. Draw around one object after entering its class label.</p>
            </section>

            <aside className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <label className="block space-y-1 text-xs text-slate-300">
                Ground-truth class
                <input list="coco-classes" value={className} onChange={event => setClassName(event.target.value)} placeholder="e.g. bottle, cup, door" className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
                <datalist id="coco-classes">{COCO_CLASSES.map(name => <option key={name} value={name} />)}</datalist>
              </label>

              <div>
                <h3 className="text-sm font-semibold">Human labels ({activeImage?.groundTruth.length || 0})</h3>
                <label className="mt-2 flex items-start gap-2 rounded-lg bg-slate-950/70 p-2 text-xs text-slate-300">
                  <input type="checkbox" checked={activeImage?.reviewed ?? false} onChange={event => setImages(previous => previous.map((image, index) => index === activeIndex ? { ...image, reviewed: event.target.checked } : image))} className="mt-0.5 accent-emerald-500" />
                  I reviewed this whole image; its boxes are complete, including if it has no target object.
                </label>
                <ul className="mt-2 space-y-2">
                  {activeImage?.groundTruth.map((box, index) => (
                    <li key={`${box.class}-${index}`} className="flex items-center justify-between gap-2 rounded-lg bg-emerald-950/30 px-3 py-2 text-xs text-emerald-100">
                      <span>{formatBox(box)}</span>
                      <button type="button" aria-label={`Remove ${box.class} label`} onClick={() => setImages(previous => previous.map((image, imageIndex) => imageIndex === activeIndex ? { ...image, groundTruth: image.groundTruth.filter((_, boxIndex) => boxIndex !== index) } : image))} className="px-2 text-rose-300">Remove</button>
                    </li>
                  ))}
                  {!activeImage?.groundTruth.length && <li className="text-xs text-slate-500">No boxes. Leave empty only if this is a true no-object/hard-negative image.</li>}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Model predictions ({activeImage?.predictions?.length ?? 'not run'})</h3>
                <ul className="mt-2 space-y-1 text-xs text-cyan-100">
                  {activeImage?.predictions?.map((box, index) => <li key={`${box.class}-${index}`} className="rounded-lg bg-cyan-950/30 px-3 py-2">{formatBox(box)}</li>)}
                  {activeImage?.predictions && activeImage.predictions.length === 0 && <li className="text-slate-500">No detections above the configured thresholds.</li>}
                </ul>
                {activeImage?.inferenceLatencyMs !== null && activeImage?.inferenceLatencyMs !== undefined && <p className="mt-2 text-xs text-slate-400">Model pipeline: {activeImage.inferenceLatencyMs.toFixed(1)} ms (browser measurement; not capture-to-audio latency)</p>}
              </div>
            </aside>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/40 p-10 text-center text-sm text-slate-400">
            Choose the sample images from the project’s <code>test_assets</code> folder or add consented images captured for this evaluation.
          </div>
        )}

        {images.length > 1 && (
          <section className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-slate-900/70 p-4" aria-label="Evaluation images">
            {images.map((image, index) => (
              <button key={image.id} type="button" onClick={() => { setActiveIndex(index); setDraftBox(null); setDrawingStart(null) }} className={`max-w-56 rounded-lg px-3 py-2 text-left text-xs ${index === activeIndex ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-300'}`}>
                <span className="block truncate">{image.name}</span>
                <span className="text-[10px] opacity-75">{image.reviewed ? 'reviewed' : 'needs review'} · {image.groundTruth.length} labels · {image.predictions === null ? 'not run' : `${image.predictions.length} predictions`}</span>
              </button>
            ))}
          </section>
        )}

        <p className="text-xs leading-relaxed text-slate-500">
          Keep validation and final test images separate. Do not put people’s names, faces, or GPS data in this manifest. Empty labels mean the image truly has no object in scope; they do not mean the image was not annotated. This developer page is available only in local development mode.
          <span className="ml-2 text-slate-400">Annotated boxes: {annotatedCount}</span>
        </p>
      </div>
    </main>
  )
}
