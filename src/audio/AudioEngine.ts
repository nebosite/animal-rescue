/**
 * Owns the AudioContext, the master bus and the listener.
 *
 * Browsers refuse to make sound until the page has had a key press or a
 * click, so the context is created on the first gesture rather than at load.
 * Everything that needs the context waits on `onStart`.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null
  private masterBus: GainNode | null = null
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

    // A compressor on the bus keeps one-shots stacked on the rotor from clipping.
    const limiter = this.ctx.createDynamicsCompressor()
    limiter.threshold.value = -12
    limiter.ratio.value = 6
    limiter.connect(this.ctx.destination)

    this.masterBus = this.ctx.createGain()
    this.masterBus.gain.value = MASTER_VOLUME
    this.masterBus.connect(limiter)

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
}

/** The direction the nose points for a heading — the same convention as the flight model. */
export function listenerOrientation(heading: number): { x: number; y: number; z: number } {
  return { x: -Math.sin(heading), y: 0, z: -Math.cos(heading) }
}

const MASTER_VOLUME = 0.8
