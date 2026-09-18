import { TOP_SPEED } from '../game/Helicopter'
import type { AudioEngine } from './AudioEngine'
import { createNoiseBuffer } from './NoiseBuffer'
import type { Reverb } from './Reverb'

/** What the rotor should sound like for a given amount of work. */
export interface RotorTargets {
  droneHz: number
  chopHz: number
  cutoffHz: number
  whineHz: number
  gain: number
}

/**
 * Maps how hard the helicopter is working to pitch, chop rate, brightness and
 * loudness. Kept as a pure function so the mapping is testable without audio.
 */
export function rotorTargets(effort: number, speed: number): RotorTargets {
  const work = clamp01(effort)
  const pace = clamp01(speed / TOP_SPEED)
  return {
    droneHz: 50 + 28 * work + 6 * pace,
    chopHz: 11 + 7 * work + 2 * pace,
    cutoffHz: 240 + 420 * work,
    whineHz: 1150 + 750 * work,
    // The idle floor matters: parked after a pickup, the rotor is all that is
    // left in the mix, and if it fades too far the game sounds like it stopped.
    gain: IDLE_GAIN + 0.38 * work + 0.08 * pace,
  }
}

/**
 * The running helicopter: a low sawtooth drone and a noise wash, both chopped
 * by a blade-pass LFO (the whop-whop), plus a faint turbine whine that rises
 * with effort. Everything eases toward its target so the engine swells rather
 * than steps.
 */
export class RotorSound {
  private readonly context: AudioContext
  private readonly output: GainNode
  private readonly drone: OscillatorNode
  private readonly droneTwin: OscillatorNode
  private readonly droneFilter: BiquadFilterNode
  private readonly chop: OscillatorNode
  private readonly whine: OscillatorNode

  constructor(engine: AudioEngine, reverb?: Reverb, destination: AudioNode = engine.master) {
    const ctx = engine.context
    this.context = ctx

    this.output = ctx.createGain()
    this.output.gain.value = 0
    this.output.connect(destination)

    // A little of the rotor into the space gives it air without washing it out.
    if (reverb) {
      const air = ctx.createGain()
      air.gain.value = 0.16
      this.output.connect(air)
      air.connect(reverb.send)
    }

    // The chop: a gain that swings 0.3..1.0 at blade-pass rate. The trough is
    // kept off the floor so idle does not thump-then-vanish between blades.
    const chopped = ctx.createGain()
    chopped.gain.value = 0.65
    chopped.connect(this.output)
    this.chop = ctx.createOscillator()
    this.chop.type = 'sine'
    const chopDepth = ctx.createGain()
    chopDepth.gain.value = 0.35
    this.chop.connect(chopDepth)
    chopDepth.connect(chopped.gain)

    // The drone: two sawtooths a few hertz apart, so they beat against each
    // other like real blades, through a lowpass that opens with effort.
    this.drone = ctx.createOscillator()
    this.drone.type = 'sawtooth'
    this.droneTwin = ctx.createOscillator()
    this.droneTwin.type = 'sawtooth'
    const droneMix = ctx.createGain()
    droneMix.gain.value = 0.55
    this.droneFilter = ctx.createBiquadFilter()
    this.droneFilter.type = 'lowpass'
    this.droneFilter.Q.value = 1.2
    this.drone.connect(droneMix)
    this.droneTwin.connect(droneMix)
    droneMix.connect(this.droneFilter)
    this.droneFilter.connect(chopped)

    // The wash: noise through a bandpass, also chopped.
    const wash = ctx.createBufferSource()
    wash.buffer = createNoiseBuffer(ctx)
    wash.loop = true
    const washFilter = ctx.createBiquadFilter()
    washFilter.type = 'bandpass'
    washFilter.frequency.value = 650
    washFilter.Q.value = 0.8
    const washGain = ctx.createGain()
    washGain.gain.value = 0.35
    wash.connect(washFilter)
    washFilter.connect(washGain)
    washGain.connect(chopped)

    // The whine: quiet, unchopped, and the clearest "working hard" cue.
    this.whine = ctx.createOscillator()
    this.whine.type = 'triangle'
    const whineGain = ctx.createGain()
    whineGain.gain.value = 0.035
    this.whine.connect(whineGain)
    whineGain.connect(this.output)

    const targets = rotorTargets(0, 0)
    this.drone.frequency.value = targets.droneHz
    this.droneTwin.frequency.value = targets.droneHz * TWIN_DETUNE
    this.chop.frequency.value = targets.chopHz
    this.droneFilter.frequency.value = targets.cutoffHz
    this.whine.frequency.value = targets.whineHz

    this.chop.start()
    this.drone.start()
    this.droneTwin.start()
    wash.start()
    this.whine.start()
  }

  update(effort: number, speed: number): void {
    const targets = rotorTargets(effort, speed)
    const now = this.context.currentTime
    this.drone.frequency.setTargetAtTime(targets.droneHz, now, SMOOTHING)
    this.droneTwin.frequency.setTargetAtTime(targets.droneHz * TWIN_DETUNE, now, SMOOTHING)
    this.chop.frequency.setTargetAtTime(targets.chopHz, now, SMOOTHING)
    this.droneFilter.frequency.setTargetAtTime(targets.cutoffHz, now, SMOOTHING)
    this.whine.frequency.setTargetAtTime(targets.whineHz, now, SMOOTHING)
    this.output.gain.setTargetAtTime(targets.gain, now, SMOOTHING)
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** Loudness while idling on the ground. Below about 0.3 it reads as silence after a pickup. */
const IDLE_GAIN = 0.32
/** Time constant for parameter changes, seconds. */
const SMOOTHING = 0.12
/** The twin drone runs 3.5% sharp: a 2–3 Hz beat across the working range. */
const TWIN_DETUNE = 1.035
