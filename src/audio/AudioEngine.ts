/**
 * Owns the AudioContext, the master bus, the volume, and the listener.
 *
 * Browsers refuse to make sound until the page has had a key press or a
 * click, so the context is created on the first gesture rather than at load.
 * Everything that needs the context waits on `onStart`.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null
  private masterBus: GainNode | null = null
  private meter: AnalyserNode | null = null
  private meterSamples: Float32Array<ArrayBuffer> | null = null
  private volumeSetting = 1
  private mutedSetting = false
  private readonly startListeners: Array<(engine: AudioEngine) => void> = []

  /** True once the browser is actually producing sound. */
  get started(): boolean {
    return this.ctx !== null && this.ctx.state === 'running'
  }

  get context(): AudioContext {
    if (!this.ctx) throw new Error('AudioEngine has not started — wait for onStart')
    return this.ctx
  }

  /** Where every sound should connect. */
  get master(): GainNode {
    if (!this.masterBus) throw new Error('AudioEngine has not started — wait for onStart')
    return this.masterBus
  }

  /** 0..1, what the player set. Applied on top of the fixed headroom. */
  get volume(): number {
    return this.volumeSetting
  }

  get muted(): boolean {
    return this.mutedSetting
  }

  setVolume(volume: number): void {
    this.volumeSetting = Math.min(1, Math.max(0, volume))
    this.applyVolume()
  }

  setMuted(muted: boolean): void {
    this.mutedSetting = muted
    this.applyVolume()
  }

  /**
   * RMS of what is actually leaving the speakers, 0 when silent. Read after
   * the limiter, so it reports the real output rather than the pre-mix.
   */
  get level(): number {
    if (!this.meter || !this.meterSamples) return 0
    this.meter.getFloatTimeDomainData(this.meterSamples)
    let sum = 0
    for (const sample of this.meterSamples) sum += sample * sample
    return Math.sqrt(sum / this.meterSamples.length)
  }

  /** Start on the first key press or click, which is when browsers allow sound. */
  armOnGesture(target: Window): void {
    const start = () => this.start()
    for (const type of ['keydown', 'pointerdown', 'touchstart'] as const) {
      target.addEventListener(type, start, { once: true, passive: true })
    }
  }

  /** Run once the context exists — immediately if it already does. */
  onStart(listener: (engine: AudioEngine) => void): void {
    if (this.ctx) listener(this)
    else this.startListeners.push(listener)
  }

  start(): void {
    if (this.ctx) {
      if (this.ctx.state !== 'running') void this.ctx.resume()
      return
    }

    this.ctx = new AudioContext()

    // A gentle limiter on the bus keeps one-shots stacked on the rotor from
    // clipping. It is a safety net, not a ducker: it only bites near full scale.
    const limiter = this.ctx.createDynamicsCompressor()
    limiter.threshold.value = -6
    limiter.knee.value = 6
    limiter.ratio.value = 4
    limiter.attack.value = 0.003
    limiter.release.value = 0.12

    this.meter = this.ctx.createAnalyser()
    this.meter.fftSize = 1024
    this.meterSamples = new Float32Array(this.meter.fftSize)

    this.masterBus = this.ctx.createGain()
    this.masterBus.connect(limiter)
    limiter.connect(this.meter)
    this.meter.connect(this.ctx.destination)
    this.applyVolume()

    void this.ctx.resume()
    for (const listener of this.startListeners) listener(this)
    this.startListeners.length = 0
  }

  /** Put the listener's ears at the helicopter, facing along its heading. */
  setListener(position: { x: number; y: number; z: number }, heading: number): void {
    const listener = this.context.listener
    const forward = listenerOrientation(heading)

    if (listener.positionX) {
      listener.positionX.value = position.x
      listener.positionY.value = position.y
      listener.positionZ.value = position.z
      listener.forwardX.value = forward.x
      listener.forwardY.value = forward.y
      listener.forwardZ.value = forward.z
      listener.upX.value = 0
      listener.upY.value = 1
      listener.upZ.value = 0
    } else {
      // Safari still only has the older setter API.
      listener.setPosition(position.x, position.y, position.z)
      listener.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0)
    }
  }

  private applyVolume(): void {
    if (!this.ctx || !this.masterBus) return
    const target = this.mutedSetting ? 0 : this.volumeSetting * MASTER_HEADROOM
    // A short ramp rather than a jump, so mute never clicks.
    this.masterBus.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02)
  }
}

/** The direction the nose points for a heading — the same convention as the flight model. */
export function listenerOrientation(heading: number): { x: number; y: number; z: number } {
  return { x: -Math.sin(heading), y: 0, z: -Math.cos(heading) }
}

/** Full volume still leaves a little headroom below the limiter. */
const MASTER_HEADROOM = 0.8
