import type { AudioEngine } from './AudioEngine'

/**
 * An outdoor space for sounds to sit in: a convolver fed by a synthesized
 * impulse response, used as a send bus. Sources connect a share of their
 * signal to `send`; the wet result goes to the master. No sample to load —
 * the response is generated at start.
 */
export class Reverb {
  /** Connect here to put a sound into the space. */
  readonly send: GainNode

  constructor(engine: AudioEngine, seconds = TAIL_SECONDS, wet = WET_LEVEL) {
    const ctx = engine.context

    const channels = impulseResponse(ctx.sampleRate, seconds)
    const buffer = ctx.createBuffer(channels.length, channels[0].length, ctx.sampleRate)
    channels.forEach((samples, i) => buffer.copyToChannel(samples, i))

    const convolver = ctx.createConvolver()
    convolver.buffer = buffer

    const wetGain = ctx.createGain()
    wetGain.gain.value = wet

    this.send = ctx.createGain()
    this.send.connect(convolver)
    convolver.connect(wetGain)
    wetGain.connect(engine.master)
  }
}

/**
 * A stereo impulse response for a wide outdoor space: noise that decays
 * exponentially and darkens as it fades, the way reflections lose their highs
 * over distance. Pure, so it can be tested without an AudioContext.
 */
export function impulseResponse(sampleRate: number, seconds: number, decay = DECAY_RATE): Float32Array<ArrayBuffer>[] {
  const length = Math.max(1, Math.floor(sampleRate * seconds))
  return [0, 1].map(() => {
    const samples = new Float32Array(length)
    let lowpassed = 0
    for (let i = 0; i < length; i++) {
      const t = i / length
      const envelope = Math.exp(-decay * t)
      // A one-pole lowpass whose cutoff falls over time, so the tail goes dull.
      const smoothing = 0.55 - 0.45 * t
      lowpassed += smoothing * ((Math.random() * 2 - 1) - lowpassed)
      samples[i] = lowpassed * envelope
    }
    return samples
  })
}

// The convolver normalises the response, which makes a tail quiet next to the
// dry sound; these are set so a one-shot audibly hangs in the air for about a
// second and a half. Taste knobs — turn WET_LEVEL down for a drier valley.
const TAIL_SECONDS = 2.4
const WET_LEVEL = 0.8
const DECAY_RATE = 3.2
