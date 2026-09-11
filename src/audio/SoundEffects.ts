import type { AudioEngine } from './AudioEngine'
import { Cooldown } from '../game/Cooldown'
import { createNoiseBuffer } from './NoiseBuffer'
import type { Reverb } from './Reverb'

/**
 * One-shot sounds that tell the player something just happened. Each is a few
 * oscillators or a noise burst with an envelope — no samples to load.
 */
export class SoundEffects {
  private readonly context: AudioContext
  private readonly output: GainNode
  private readonly noise: AudioBuffer
  private readonly bumpCooldown = new Cooldown(BUMP_COOLDOWN)

  constructor(engine: AudioEngine, reverb?: Reverb) {
    this.context = engine.context
    this.noise = createNoiseBuffer(this.context)

    this.output = this.context.createGain()
    this.output.connect(engine.master)

    // One-shots ring out into the space so they land as events, not blips.
    if (reverb) {
      const ring = this.context.createGain()
      ring.gain.value = 0.5
      this.output.connect(ring)
      ring.connect(reverb.send)
    }
  }

  advance(dt: number): void {
    this.bumpCooldown.advance(dt)
  }

  /** Animal aboard: two quick rising chirps and a whoosh of rotor wash. */
  pickup(): void {
    const now = this.context.currentTime
    this.tone('sine', 440, 880, now, 0.14, 0.4)
    this.tone('sine', 660, 1320, now + 0.12, 0.16, 0.4)
    this.burst('lowpass', 900, now, 0.35, 0.25)
  }

  /** Delivered: a bright four-note run and a bell that rings out. */
  delivered(): void {
    const now = this.context.currentTime
    const run = [523, 659, 784, 1046]
    run.forEach((hz, i) => this.tone('triangle', hz, hz, now + i * 0.09, 0.18, 0.35))
    this.tone('sine', 1568, 1568, now + 0.3, 0.9, 0.3)
  }

  /** Skids meeting the ground: a low thump with a little grit. */
  touchdown(): void {
    const now = this.context.currentTime
    this.tone('sine', 95, 40, now, 0.18, 0.7)
    this.burst('lowpass', 320, now, 0.12, 0.35)
  }

  /** Pushed back by the edge of the field or the ceiling: a dull knock. */
  bump(): void {
    if (!this.bumpCooldown.tryFire()) return
    const now = this.context.currentTime
    this.tone('square', 150, 90, now, 0.09, 0.25)
    this.burst('bandpass', 500, now, 0.08, 0.3)
  }

  private tone(type: OscillatorType, fromHz: number, toHz: number, at: number, seconds: number, peak: number): void {
    const osc = this.context.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(fromHz, at)
    if (toHz !== fromHz) osc.frequency.exponentialRampToValueAtTime(toHz, at + seconds)

    const envelope = this.context.createGain()
    envelope.gain.setValueAtTime(0, at)
    envelope.gain.linearRampToValueAtTime(peak, at + 0.012)
    envelope.gain.exponentialRampToValueAtTime(0.001, at + seconds)

    osc.connect(envelope)
    envelope.connect(this.output)
    osc.start(at)
    osc.stop(at + seconds + 0.02)
  }

  private burst(filter: BiquadFilterType, hz: number, at: number, seconds: number, peak: number): void {
    const source = this.context.createBufferSource()
    source.buffer = this.noise

    const shape = this.context.createBiquadFilter()
    shape.type = filter
    shape.frequency.value = hz

    const envelope = this.context.createGain()
    envelope.gain.setValueAtTime(peak, at)
    envelope.gain.exponentialRampToValueAtTime(0.001, at + seconds)

    source.connect(shape)
    shape.connect(envelope)
    envelope.connect(this.output)
    source.start(at)
    source.stop(at + seconds + 0.02)
  }
}

/** Seconds between bumps while held against a wall. */
const BUMP_COOLDOWN = 0.35
