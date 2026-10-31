/**
 * NaviAble AI — Unified Mobile & Desktop Camera Controller
 *
 * Implements resilient camera acquisition for Android Chrome, iOS Safari, and Desktop:
 * - isSecureContext verification (HTTPS / localhost)
 * - facingMode: { ideal: 'environment' } rear-camera prioritization
 * - Graceful fallback constraints
 * - iOS Safari playsInline / muted lifecycle safety
 * - Device enumeration and camera switching
 * - Active track cleanup on unmount
 * - Full telemetry diagnostics
 */

export interface CameraTelemetry {
  isSecureContext: boolean
  hasMediaDevices: boolean
  hasGetUserMedia: boolean
  permissionState: 'granted' | 'denied' | 'prompt' | 'unsupported' | 'unknown'
  streamStatus: 'idle' | 'initializing' | 'streaming' | 'error' | 'stopped'
  selectedCameraId: string
  selectedCameraLabel: string
  availableCameras: Array<{ deviceId: string; label: string }>
  activeTrackCount: number
  trackReadyState: string
  videoWidth: number
  videoHeight: number
  errorMessage: string
  errorType: string
  facingModeUsed: string
}

export interface CameraStartOptions {
  preferredFacingMode?: 'environment' | 'user'
  deviceId?: string
  targetVideoElement: HTMLVideoElement
  onTelemetryChange?: (telemetry: CameraTelemetry) => void
}

let activeStream: MediaStream | null = null
let currentDeviceId = ''
let isInitializingLock = false

function getInitialTelemetry(): CameraTelemetry {
  const isSecure = typeof window !== 'undefined' ? Boolean(window.isSecureContext) : false
  const hasNav = typeof navigator !== 'undefined'
  const hasMD = hasNav && Boolean(navigator.mediaDevices)
  const hasGUM = hasMD && typeof navigator.mediaDevices.getUserMedia === 'function'

  return {
    isSecureContext: isSecure,
    hasMediaDevices: hasMD,
    hasGetUserMedia: hasGUM,
    permissionState: 'unknown',
    streamStatus: 'idle',
    selectedCameraId: '',
    selectedCameraLabel: '',
    availableCameras: [],
    activeTrackCount: 0,
    trackReadyState: 'none',
    videoWidth: 0,
    videoHeight: 0,
    errorMessage: '',
    errorType: '',
    facingModeUsed: 'none',
  }
}

let currentTelemetry: CameraTelemetry = getInitialTelemetry()

export function getCameraTelemetry(): CameraTelemetry {
  return { ...currentTelemetry }
}

/**
 * Enumerate connected video cameras. Labels are only exposed once permission is granted.
 */
export async function enumerateVideoCameras(): Promise<Array<{ deviceId: string; label: string }>> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return []
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoInputs = devices
      .filter((d) => d.kind === 'videoinput')
      .map((d, idx) => ({
        deviceId: d.deviceId,
        label: d.label || `Camera ${idx + 1} (${d.deviceId ? d.deviceId.slice(0, 6) + '...' : 'Default'})`,
      }))
    currentTelemetry.availableCameras = videoInputs
    return videoInputs
  } catch (err: any) {
    console.warn('[CameraManager] enumerateDevices failed:', err?.message)
    return []
  }
}

/**
 * Query Permissions API for camera status if available in current browser
 */
export async function queryCameraPermission(): Promise<CameraTelemetry['permissionState']> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unsupported'
  }
  try {
    const res = await navigator.permissions.query({ name: 'camera' as any })
    currentTelemetry.permissionState = res.state as any
    res.onchange = () => {
      currentTelemetry.permissionState = res.state as any
    }
    return res.state as any
  } catch {
    return 'unsupported'
  }
}

/**
 * Start camera feed with multi-tier fallback
 */
export async function startCameraFeed(
  options: CameraStartOptions
): Promise<{ success: boolean; stream?: MediaStream; error?: string }> {
  if (isInitializingLock) {
    console.warn('[CameraManager] Camera initialization already in progress.')
    return { success: false, error: 'Initialization in progress' }
  }

  isInitializingLock = true
  currentTelemetry.streamStatus = 'initializing'
  currentTelemetry.errorMessage = ''
  currentTelemetry.errorType = ''
  options.onTelemetryChange?.(getCameraTelemetry())

  // 1. Verify Secure Context (Critical on Mobile: HTTP over IP address blocks getUserMedia)
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '::1'

    if (!isLocalhost) {
      const msg =
        'Camera blocked: Insecure HTTP Context. Mobile browsers (Android Chrome, iOS Safari) refuse camera access over unencrypted HTTP when accessed via IP address. Deploy to HTTPS, use localhost, or tunnel via HTTPS.'
      currentTelemetry.streamStatus = 'error'
      currentTelemetry.errorType = 'InsecureContextError'
      currentTelemetry.errorMessage = msg
      isInitializingLock = false
      options.onTelemetryChange?.(getCameraTelemetry())
      return { success: false, error: msg }
    }
  }

  // 2. Verify mediaDevices API support
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    const msg = 'navigator.mediaDevices.getUserMedia is not supported on this browser or platform.'
    currentTelemetry.streamStatus = 'error'
    currentTelemetry.errorType = 'UnsupportedBrowserError'
    currentTelemetry.errorMessage = msg
    isInitializingLock = false
    options.onTelemetryChange?.(getCameraTelemetry())
    return { success: false, error: msg }
  }

  // 3. Stop any existing media tracks before starting a new stream
  stopCameraFeed()

  const video = options.targetVideoElement
  let stream: MediaStream | null = null
  let lastError: any = null
  let facingUsed = 'environment'

  // Attempt 1: Target deviceId if user selected a specific camera
  if (options.deviceId) {
    try {
      console.log(`[CameraManager] Requesting exact deviceId: ${options.deviceId}`)
      stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: options.deviceId } },
        audio: false,
      })
      facingUsed = `deviceId:${options.deviceId.slice(0, 8)}`
    } catch (err: any) {
      console.warn('[CameraManager] Specific deviceId failed, falling back:', err.name, err.message)
      lastError = err
    }
  }

  // Attempt 2: Preferred facingMode with ideal constraint (non-fatal if single webcam)
  if (!stream) {
    const targetFacing = options.preferredFacingMode || 'environment'
    try {
      console.log(`[CameraManager] Requesting ideal facingMode: ${targetFacing}`)
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: targetFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      facingUsed = targetFacing
    } catch (err: any) {
      console.warn('[CameraManager] Ideal facingMode failed, falling back to general video: true:', err.name, err.message)
      lastError = err
    }
  }

  // Attempt 3: General fallback constraints
  if (!stream) {
    try {
      console.log('[CameraManager] Requesting fallback constraint: { video: true, audio: false }')
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      })
      facingUsed = 'general-fallback'
      lastError = null
    } catch (fallbackErr: any) {
      lastError = fallbackErr
    }
  }

  // Handle failure to acquire stream
  if (!stream) {
    const errName = lastError?.name || 'Error'
    const errMsg = lastError?.message || 'Could not access camera hardware'
    let userMsg = `${errName}: ${errMsg}`

    if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
      userMsg = 'Camera permission denied. Please enable camera access in your browser or operating system settings.'
      currentTelemetry.permissionState = 'denied'
    } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
      userMsg = 'No camera found on this device. Please connect a webcam or enable the device camera.'
    } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
      userMsg = 'Camera is in use by another application or tab. Please close other camera apps and retry.'
    } else if (errName === 'OverconstrainedError') {
      userMsg = 'Requested camera resolution or facing mode is not supported by your hardware.'
    }

    currentTelemetry.streamStatus = 'error'
    currentTelemetry.errorType = errName
    currentTelemetry.errorMessage = userMsg
    isInitializingLock = false
    options.onTelemetryChange?.(getCameraTelemetry())
    return { success: false, error: userMsg }
  }

  activeStream = stream
  const tracks = stream.getVideoTracks()
  const activeTrack = tracks[0]

  // Attach real camera stream to HTMLVideoElement with iOS Safari compatibility
  video.srcObject = stream
  video.muted = true
  video.playsInline = true
  video.autoplay = true
  video.setAttribute('playsinline', 'true')
  video.setAttribute('webkit-playsinline', 'true')
  video.setAttribute('autoplay', 'true')
  video.setAttribute('muted', 'true')

  // Wait for loadedmetadata event with fallback timeout
  await new Promise<void>((resolve) => {
    if (video.readyState >= 1 && video.videoWidth > 0) {
      resolve()
      return
    }
    const onLoaded = () => {
      video.removeEventListener('loadedmetadata', onLoaded)
      resolve()
    }
    video.addEventListener('loadedmetadata', onLoaded, { once: true })
    setTimeout(resolve, 2500)
  })

  // Play video stream and catch promise rejections
  try {
    const playPromise = video.play()
    if (playPromise !== undefined) {
      await playPromise
    }
  } catch (playErr: any) {
    console.warn('[CameraManager] video.play() interrupted or rejected:', playErr?.message)
  }

  // Update telemetry
  const width = video.videoWidth || (activeTrack?.getSettings()?.width as number) || 640
  const height = video.videoHeight || (activeTrack?.getSettings()?.height as number) || 480

  currentDeviceId = activeTrack?.getSettings()?.deviceId || options.deviceId || ''

  currentTelemetry = {
    ...currentTelemetry,
    streamStatus: 'streaming',
    permissionState: 'granted',
    selectedCameraId: currentDeviceId,
    selectedCameraLabel: activeTrack?.label || 'Active Camera',
    activeTrackCount: tracks.length,
    trackReadyState: activeTrack?.readyState || 'live',
    videoWidth: width,
    videoHeight: height,
    errorMessage: '',
    errorType: '',
    facingModeUsed: facingUsed,
  }

  // Re-enumerate cameras now that labels are populated
  await enumerateVideoCameras()

  isInitializingLock = false
  options.onTelemetryChange?.(getCameraTelemetry())

  return { success: true, stream }
}

/**
 * Release all active tracks and reset video element
 */
export function stopCameraFeed(targetVideoElement?: HTMLVideoElement | null): void {
  if (activeStream) {
    activeStream.getTracks().forEach((track) => {
      try {
        track.stop()
        console.log(`[CameraManager] Released track: ${track.label} (${track.kind})`)
      } catch {
        /* ignore */
      }
    })
    activeStream = null
  }

  if (targetVideoElement) {
    targetVideoElement.srcObject = null
  }

  currentTelemetry = {
    ...currentTelemetry,
    streamStatus: 'stopped',
    activeTrackCount: 0,
    trackReadyState: 'ended',
    videoWidth: 0,
    videoHeight: 0,
  }
}
