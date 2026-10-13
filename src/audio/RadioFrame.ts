import type { AudioEngine } from './AudioEngine'
import { decibels, TRIM } from './Mix'
import { createNoiseBuffer } from './NoiseBuffer'

/**
 * What makes a spoken line sound like it came over a walkie-talkie: a squelch
 * burst as the mic is keyed, a bed of static under the voice, and a short tick
 * as it is released.
 *
 * It frames the voice rather than filtering it, because the browser's speech
 * synthesiser is outside the audio graph — there is nothing to run a filter on.
 * The blip voices, which do go through the graph, have their own radio chain.
 *
 * Three calls, all safe to repeat:
 * - `open` keys the mic. Opening while open re-keys it (a new squelch) without
 *   stacking a second bed of static.
 * - `close` releases it with a tick.
 * - `cancel` drops it quietly, for a line that was cut off.
 *
 * Whatever happens to the speech's own events, the static cannot outlive
 * `CEILING`: its fade-out is scheduled on the audio clock the moment it starts,
 * not left to a timer or to an end event that a browser may never send.
 */
export class RadioFrame {
  private readonly context: AudioContext
  private readonly noise: AudioBuffer
  private readonly output: GainNode
  private session: Static | null = null

  constructor(engine: AudioEngine) {
    this.context = engine.context
    this.noise = createNoiseBuffer(this.context)
    // Straight to the master, not through the ducker: the beds dip while
    // someone talks, and the frame is part of the talking.
    this.output = this.context.createGain()
    this.output.gain.value = decibels(TRIM.radio)
    this.output.connect(engine.master)
  }

  /** Whether the static is running, for the benefit of tests. */
  get isOpen(): boolean {
    return this.session !== null
  }

  open(): void {
    const now = this.context.currentTime
    // Re-keying replaces the old bed rather than adding to it.
    this.fadeOut(now)
    this.burst(now, SQUELCH)

    const source = this.context.createBufferSource()
    source.buffer = this.noise
    source.loop = true
    const band = this.context.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = STATIC_HZ
    band.Q.value = 0.8
    const high = this.context.createBiquadFilter()
    high.type = 'highpass'
    high.frequency.value = 700

    const bed = this.context.createGain()
    // Set the resting value too, not only a scheduled one: fading out in the same
    // instant cancels the scheduled events, and the bed would then decay from the
    // node's default of 1, which is twenty-five times the level it is meant to be.
    bed.gain.value = 0
    bed.gain.setValueAtTime(0, now)
    bed.gain.linearRampToValueAtTime(STATIC_LEVEL, now + 0.08)
    // The watchdog: fade out at the ceiling whatever else happens.
    bed.gain.setValueAtTime(STATIC_LEVEL, now + CEILING)
    bed.gain.linearRampToValueAtTime(0, now + CEILING + 0.3)

    // A steady pulse under the static, so it breathes and breaks up a little
    // instead of sitting there as a flat wash. It is summed onto the bed's gain,
    // so it has to be faded out with the bed or it keeps hissing after it.
    const chatter = this.context.createOscillator()
    chatter.type = 'square'
    chatter.frequency.value = CHATTER_HZ
    const chatterDepth = this.context.createGain()
    chatterDepth.gain.value = STATIC_LEVEL * 0.4
    chatterDepth.gain.setValueAtTime(STATIC_LEVEL * 0.4, now + CEILING)
    chatterDepth.gain.linearRampToValueAtTime(0, now + CEILING + 0.3)
    chatter.connect(chatterDepth)
    chatterDepth.connect(bed.gain)

    source.connect(band)
    band.connect(high)
    high.connect(bed)
    bed.connect(this.output)

    const stopAt = now + CEILING + 0.4
    source.start(now, Math.random() * 1.5)
    source.stop(stopAt)
    chatter.start(now)
    chatter.stop(stopAt)
    this.session = { bed, source, chatter, chatterDepth }
  }

  /** The mic is released: static away, with a tick. */
  close(): void {
    if (!this.session) return
    const now = this.context.currentTime
    this.fadeOut(now)
    this.burst(now, TICK)
  }

  /** Dropped without ceremony: a line that was cut off, or a restart. */
  cancel(): void {
    if (!this.session) return
    this.fadeOut(this.context.currentTime)
  }

  private fadeOut(now: number): void {
    const session = this.session
    if (!session) return
    this.session = null
    for (const gain of [session.bed.gain, session.chatterDepth.gain]) {
      gain.cancelScheduledValues(now)
      gain.setTargetAtTime(0, now, FADE_SECONDS / 4)
    }
    // A later stop() replaces the ceiling one scheduled when the bed started.
    session.source.stop(now + FADE_SECONDS + 0.05)
    session.chatter.stop(now + FADE_SECONDS + 0.05)
  }

  /** A short filtered noise crack: the squelch and the tick. */
  private burst(now: number, shape: Burst): void {
    const source = this.context.createBufferSource()
    source.buffer = this.noise
    const band = this.context.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = shape.hz
    band.Q.value = 1.2
    const envelope = this.context.createGain()
    envelope.gain.setValueAtTime(shape.level, now)
    envelope.gain.exponentialRampToValueAtTime(0.001, now + shape.seconds)
    source.connect(band)
    band.connect(envelope)
    envelope.connect(this.output)
    source.start(now, Math.random() * 1.5)
    source.stop(now + shape.seconds + 0.02)
  }
}

interface Static {
  bed: GainNode
  source: AudioBufferSourceNode
  chatter: OscillatorNode
  chatterDepth: GainNode
}

interface Burst {
  hz: number
  seconds: number
  level: number
}

/**
 * The longest the static may run, about as long as the duck held while someone
 * talks (`RadioVoice`). They are not tied together: the frame's clock starts
 * when a line is queued and the duck's when it starts speaking.
 */
export const CEILING = 12
const STATIC_LEVEL = 0.04
const STATIC_HZ = 2200
const CHATTER_HZ = 13
const FADE_SECONDS = 0.08
const SQUELCH: Burst = { hz: 1800, seconds: 0.09, level: 0.5 }
const TICK: Burst = { hz: 2600, seconds: 0.035, level: 0.3 }
