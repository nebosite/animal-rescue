import type { AudioEngine } from './AudioEngine'
import { createNoiseBuffer } from './NoiseBuffer'

/** How much wind, and how high it whistles, for a given altitude and speed. */
export interface WindTargets {
  gain: number
  centerHz: number
}

/**
 * Wind is silent on the ground and grows with height and speed — so it is
 * atmosphere, but it also tells the player how high and how fast they are.
 * Pure, so the mapping is testable without audio.
 */
export function windTargets(altitudeAboveGround: number, speed: number): WindTargets {
  const height = clamp01(altitudeAboveGround / FULL_WIND_ALTITUDE)
  const pace = clamp01(speed / TOP_SPEED)
  // A bandpassed noise bed carries little energy per unit of gain, so these
  // numbers are higher than they look. They are set so the wind sits under the
  // rotor even at full cruise: it is weather behind the machine, never the
  // loudest thing in the mix, because a loud bed that swells is heard as the
  // sound cutting in and out.
  return {
    gain: 0.3 * height + 0.26 * pace,
    centerHz: 350 + 150 * height + 500 * pace,
  }
}

/**
 * A rushing-air bed: noise through a bandpass whose centre drifts slowly, with
 * a slow gust in the level, so it breathes rather than hisses.
 */
export class WindSound {
  private readonly context: AudioContext
  private readonly output: GainNode
  private readonly filter: BiquadFilterNode

  constructor(engine: AudioEngine, destination: AudioNode = engine.master) {
    const ctx = engine.context
    this.context = ctx

    this.output = ctx.createGain()
    this.output.gain.value = 0
    this.output.connect(destination)

    // Gusts: a slow LFO that swings the level a little. Kept shallow — a deep
    // swell on the loudest bed reads as the whole mix fading in and out.
    const gusting = ctx.createGain()
    gusting.gain.value = 1
    gusting.connect(this.output)
    const gust = ctx.createOscillator()
    gust.type = 'sine'
    gust.frequency.value = 0.13
    const gustDepth = ctx.createGain()
    gustDepth.gain.value = 0.12
    gust.connect(gustDepth)
    gustDepth.connect(gusting.gain)

    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'bandpass'
    this.filter.Q.value = 0.6
    this.filter.frequency.value = windTargets(0, 0).centerHz
    this.filter.connect(gusting)

    // Drift: the whistle wanders ±80 Hz so it never sits on one note.
    const drift = ctx.createOscillator()
    drift.type = 'sine'
    drift.frequency.value = 0.09
    const driftDepth = ctx.createGain()
    driftDepth.gain.value = 80
    drift.connect(driftDepth)
    driftDepth.connect(this.filter.frequency)

    const noise = ctx.createBufferSource()
    noise.buffer = createNoiseBuffer(ctx)
    noise.loop = true
    noise.connect(this.filter)

    gust.start()
    drift.start()
    noise.start()
  }

  update(altitude: number, speed: number): void {
    const targets = windTargets(altitude, speed)
    const now = this.context.currentTime
    this.output.gain.setTargetAtTime(targets.gain, now, SMOOTHING)
    this.filter.frequency.setTargetAtTime(targets.centerHz, now, SMOOTHING)
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** Height above the ground at which wind reaches full strength. */
const FULL_WIND_ALTITUDE = 40
/** Matches the flight model's top speed. */
const TOP_SPEED = 31
const SMOOTHING = 0.4
