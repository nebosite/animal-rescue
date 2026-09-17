import type { AudioEngine } from './AudioEngine'
import { createNoiseBuffer } from './NoiseBuffer'

/**
 * The fire, heard: a crackling roar that swells as you approach and drops
 * away as you leave. You hear where the fire is before you see it, which on
 * this map is both atmosphere and a warning.
 */
export class FireSound {
  private readonly context: AudioContext
  private readonly output: GainNode
  private readonly roar: BiquadFilterNode
  private readonly noise: AudioBuffer
  private nextCrackle = 0

  constructor(engine: AudioEngine, destination: AudioNode = engine.master) {
    const ctx = engine.context
    this.context = ctx
    this.noise = createNoiseBuffer(ctx)

    this.output = ctx.createGain()
    this.output.gain.value = 0
    this.output.connect(destination)

    // The roar: noise through a bandpass, a low rushing bed.
    this.roar = ctx.createBiquadFilter()
    this.roar.type = 'bandpass'
    this.roar.frequency.value = 420
    this.roar.Q.value = 0.5
    const roarGain = ctx.createGain()
    roarGain.gain.value = 0.55
    const source = ctx.createBufferSource()
    source.buffer = this.noise
    source.loop = true
    source.connect(this.roar)
    this.roar.connect(roarGain)
    roarGain.connect(this.output)
    source.start()
  }

  /** How near the flames are, in metres; and whether you are in them. */
  update(distanceToFire: number, inTheFire: boolean): void {
    const now = this.context.currentTime
    const nearness = Math.max(0, 1 - distanceToFire / HEARING_RANGE)
    const loudness = inTheFire ? 1 : nearness * nearness
    this.output.gain.setTargetAtTime(loudness * MAX_LEVEL, now, 0.3)

    // Crackle: short bright pops, more of them the closer you are.
    if (loudness > 0.04 && now >= this.nextCrackle) {
      this.pop(now, loudness)
      this.nextCrackle = now + 0.05 + Math.random() * (0.35 - 0.3 * loudness)
    }
  }

  private pop(at: number, loudness: number): void {
    const source = this.context.createBufferSource()
    source.buffer = this.noise
    const band = this.context.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 1800 + Math.random() * 2600
    band.Q.value = 3
    const envelope = this.context.createGain()
    envelope.gain.setValueAtTime(0.5 * loudness, at)
    envelope.gain.exponentialRampToValueAtTime(0.001, at + 0.03 + Math.random() * 0.05)
    source.connect(band)
    band.connect(envelope)
    envelope.connect(this.output)
    source.start(at, Math.random() * 1.5)
    source.stop(at + 0.1)
  }
}

/** Beyond this the fire is silent. */
const HEARING_RANGE = 170
const MAX_LEVEL = 0.75
