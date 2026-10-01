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
  /** How fast a failing engine surges, in Hz, and how far it drags the pitch. */
  surgeHz: number
  surgeDepthHz: number
  /** Grinding from a machine that should be in a hangar, 0..1. */
  rasp: number
}

/**
 * Maps how hard the helicopter is working — and how much helicopter is left —
 * to pitch, chop rate, brightness, loudness and the noises a wreck makes.
 * Kept as a pure function so the mapping is testable without audio.
 *
 * Damage is deliberately loud in the mix. It is the one thing in the game the
 * player cannot see on the airframe itself while flying, and it is the number
 * every decision in the back half of a shift turns on, so the engine has to
 * say it: lower, slower, rougher, and surging in a way nothing the pilot does
 * could ever cause.
 */
export function rotorTargets(effort: number, speed: number, condition = 1): RotorTargets {
  const work = clamp01(effort)
  const pace = clamp01(speed / TOP_SPEED)
  const hurt = 1 - clamp01(condition)
  return {
    droneHz: (50 + 28 * work + 6 * pace) * (1 - 0.3 * hurt),
    chopHz: (11 + 7 * work + 2 * pace) * (1 - 0.22 * hurt),
    // Brighter as it works, and harsher as it breaks.
    cutoffHz: 240 + 420 * work + 300 * hurt,
    whineHz: (1150 + 750 * work) * (1 - 0.25 * hurt),
    // The idle floor matters: parked after a pickup, the rotor is all that is
    // left in the mix, and if it fades too far the game sounds like it stopped.
    gain: IDLE_GAIN + 0.38 * work + 0.08 * pace,
    surgeHz: 1.7 + 1.1 * hurt,
    // Squared, like the airframe judder: a scuff should sound like nothing.
    surgeDepthHz: 26 * hurt * hurt,
    rasp: hurt * hurt,
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
  /** Blade passes a second, as the drone is currently chopping them. */
  private chopping = rotorTargets(0, 0).chopHz

  /** The slow surge of an engine that is giving up, and how deep it bites. */
  private readonly surge: OscillatorNode
  private readonly surgeDepth: GainNode
  /** Low grinding, silent on a healthy machine. */
  private readonly rasp: GainNode

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

    // The surge: a slow LFO on the drone pitch with no depth at all until the
    // machine is damaged. Routed to the oscillator frequencies rather than to
    // a gain, because a dying engine changes note — a dying *volume* just
    // sounds like the mix going wrong.
    this.surge = ctx.createOscillator()
    this.surge.type = 'sine'
    this.surge.frequency.value = 1.7
    this.surgeDepth = ctx.createGain()
    this.surgeDepth.gain.value = 0
    this.surge.connect(this.surgeDepth)

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
    this.surgeDepth.connect(this.drone.frequency)
    this.surgeDepth.connect(this.droneTwin.frequency)
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

    // The grind: low broadband noise that only appears as the machine fails.
    // Chopped with everything else, so it reads as coming from the rotor head
    // rather than as a sound effect laid over the top.
    const grind = ctx.createBufferSource()
    grind.buffer = createNoiseBuffer(ctx)
    grind.loop = true
    const grindFilter = ctx.createBiquadFilter()
    grindFilter.type = 'bandpass'
    grindFilter.frequency.value = 170
    grindFilter.Q.value = 2.2
    this.rasp = ctx.createGain()
    this.rasp.gain.value = 0
    grind.connect(grindFilter)
    grindFilter.connect(this.rasp)
    this.rasp.connect(chopped)

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
    this.surge.start()
    this.drone.start()
    this.droneTwin.start()
    wash.start()
    grind.start()
    this.whine.start()
  }

  /**
   * How fast the blades are going round, in passes a second.
   *
   * Anything that should happen *per blade* reads this rather than guessing,
   * so the rotor and whatever it is hitting stay in step — including when a
   * wrecked engine drags the whole thing slower.
   */
  get bladeHz(): number {
    return this.chopping
  }

  /** `condition` is how much helicopter is left, 1 fresh and 0 a wreck. */
  update(effort: number, speed: number, condition = 1): void {
    const targets = rotorTargets(effort, speed, condition)
    this.chopping = targets.chopHz
    const now = this.context.currentTime
    this.surge.frequency.setTargetAtTime(targets.surgeHz, now, SMOOTHING)
    this.surgeDepth.gain.setTargetAtTime(targets.surgeDepthHz, now, SMOOTHING)
    this.rasp.gain.setTargetAtTime(targets.rasp * RASP_GAIN, now, SMOOTHING)
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
/** How loud the grind gets on a completely wrecked machine. */
const RASP_GAIN = 0.5
