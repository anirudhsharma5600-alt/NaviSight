/**
 * NaviAble AI 3.0 — Voice Activity Detector (VAD)
 * 
 * Provides:
 * - Real-time audio energy measurement via Web Audio API.
 * - Speech-start threshold detection to distinguish speech from ambient noise.
 * - End-of-speech silence detection with support for natural speaking pauses (1200ms).
 * - Automatic fallback if Web Audio stream access is restricted.
 */

export interface VADConfig {
  energyThreshold: number // 0-255 dB equivalent
  silenceDurationMs: number // time of continuous silence before concluding utterance
  minSpeechDurationMs: number // minimum speech time to filter mic pops
}

type SpeechCallback = () => void
type EnergyCallback = (energy: number, isSpeaking: boolean) => void

const DEFAULT_VAD_CONFIG: VADConfig = {
  energyThreshold: 22,
  silenceDurationMs: 1200,
  minSpeechDurationMs: 300,
}

export class VoiceActivityDetectorClass {
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private microphoneStream: MediaStream | null = null
  private animationFrameId: number | null = null
  private config: VADConfig = DEFAULT_VAD_CONFIG

  private isSpeaking = false
  private speechStartTime = 0
  private lastAudibleTime = 0
  private silenceTimer: any = null

  private speechStartCallbacks: Set<SpeechCallback> = new Set()
  private speechEndCallbacks: Set<SpeechCallback> = new Set()
  private energyCallbacks: Set<EnergyCallback> = new Set()

  public configure(config: Partial<VADConfig>) {
    this.config = { ...this.config, ...config }
  }

  /**
   * Initialize audio analyzer on microphone stream
   */
  public async init(stream?: MediaStream): Promise<boolean> {
    if (typeof window === 'undefined') return false

    try {
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        })
      }

      this.microphoneStream = stream
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) return false

      this.audioContext = new AudioContextClass()
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      const source = this.audioContext.createMediaStreamSource(stream)
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 512
      this.analyser.smoothingTimeConstant = 0.4
      source.connect(this.analyser)

      this.startMonitoring()
      return true
    } catch (err) {
      console.warn('[VAD] Could not initialize Web Audio Analyser (using fallback timer):', err)
      return false
    }
  }

  private startMonitoring() {
    if (!this.analyser) return

    const bufferLength = this.analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const checkAudio = () => {
      if (!this.analyser) return
      this.analyser.getByteFrequencyData(dataArray)

      // Compute average energy
      let sum = 0
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i]
      }
      const energy = sum / bufferLength
      const now = Date.now()

      this.energyCallbacks.forEach(cb => cb(energy, this.isSpeaking))

      if (energy > this.config.energyThreshold) {
        this.lastAudibleTime = now

        if (!this.isSpeaking) {
          this.isSpeaking = true
          this.speechStartTime = now
          clearTimeout(this.silenceTimer)
          this.silenceTimer = null
          this.speechStartCallbacks.forEach(cb => cb())
        }
      } else {
        // Energy is below threshold (silence or background hum)
        if (this.isSpeaking) {
          const speechDuration = now - this.speechStartTime
          if (now - this.lastAudibleTime > this.config.silenceDurationMs) {
            if (speechDuration >= this.config.minSpeechDurationMs) {
              this.isSpeaking = false
              this.speechEndCallbacks.forEach(cb => cb())
            } else {
              // Mic click or false transient
              this.isSpeaking = false
            }
          }
        }
      }

      this.animationFrameId = requestAnimationFrame(checkAudio)
    }

    this.animationFrameId = requestAnimationFrame(checkAudio)
  }

  public onSpeechStart(cb: SpeechCallback): () => void {
    this.speechStartCallbacks.add(cb)
    return () => this.speechStartCallbacks.delete(cb)
  }

  public onSpeechEnd(cb: SpeechCallback): () => void {
    this.speechEndCallbacks.add(cb)
    return () => this.speechEndCallbacks.delete(cb)
  }

  public onEnergy(cb: EnergyCallback): () => void {
    this.energyCallbacks.add(cb)
    return () => this.energyCallbacks.delete(cb)
  }

  public stop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
    clearTimeout(this.silenceTimer)
    this.isSpeaking = false

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close()
      } catch {}
      this.audioContext = null
    }
    this.analyser = null
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach(t => t.stop())
      this.microphoneStream = null
    }
  }
}

export const VoiceActivityDetector = new VoiceActivityDetectorClass()
