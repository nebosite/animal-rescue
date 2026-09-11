import type { VoiceProfile } from '../game/AnimalProfile'
import type { AudioEngine } from './AudioEngine'
import { createNoiseBuffer } from './NoiseBuffer'
import type { Reverb } from './Reverb'

/**
 * Radio voices, Animal Crossing style: a line of text becomes a run of short
 * pitched blips in the speaker's own timbre, with gaps at the spaces, through
 * a radio-band filter and a crackle at the start. Nobody says words; everyone
 * clearly speaks.
 */
export class VoiceBlips {
  private readonly context: AudioContext
  private readonly output: GainNode
  private readonly noise: AudioBuffer

  constructor(engine: AudioEngine, reverb?: Reverb) {
    const ctx = engine.context
    this.context = ctx
    this.noise = createNoiseBuffer(ctx)

    // A small speaker: the crackle and the lowpass do the radio character; the
    // highpass only trims rumble, because the bass voices (Gus, the Chief)
    // have fundamentals down near 150 Hz and a higher cut silenced them.
    const highpass = ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 120
    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 3400

    this.output = ctx.createGain()
    this.output.connect(highpass)
    highpass.connect(lowpass)
    lowpass.connect(engine.master)

    if (reverb) {
      const room = ctx.createGain()
      room.gain.value = 0.15
      lowpass.connect(room)
      room.connect(reverb.send)
    }
  }

  speak(voice: VoiceProfile, text: string): void {
    const now = this.context.currentTime
    this.crackle(now)

    const step = 1 / voice.rate
    let at = now + 0.09
    let blips = 0
    let parity = 0
    for (const char of text.slice(0, MAX_CHARS)) {
      if (blips >= MAX_BLIPS) break
      if (char === ' ') {
        at += step * 0.7
        continue
      }
      // One blip per two letters keeps the pace speech-like rather than frantic.
      if (parity++ % 2) continue
      // Drift down a little through a phrase, the way a sentence settles.
      const settle = 1 - 0.08 * (blips / MAX_BLIPS)
      const hz = voice.baseHz * settle * (1 + voice.spread * (Math.random() - 0.5))
      this.blip(voice.wave, hz, at, Math.min(0.09, step * 0.75))
      at += step
      blips++
    }
  }

  private blip(wave: OscillatorType, hz: number, at: number, seconds: number): void {
    const osc = this.context.createOscillator()
    osc.type = wave
    osc.frequency.setValueAtTime(hz, at)
    osc.frequency.exponentialRampToValueAtTime(hz * 0.94, at + seconds)

    const envelope = this.context.createGain()
    envelope.gain.setValueAtTime(0, at)
    envelope.gain.linearRampToValueAtTime(BLIP_VOLUME, at + 0.008)
    envelope.gain.exponentialRampToValueAtTime(0.001, at + seconds)

    osc.connect(envelope)
    envelope.connect(this.output)
    osc.start(at)
    osc.stop(at + seconds + 0.01)
  }

  private crackle(at: number): void {
    const source = this.context.createBufferSource()
    source.buffer = this.noise
    const band = this.context.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 2200
    band.Q.value = 0.9
    const envelope = this.context.createGain()
    envelope.gain.setValueAtTime(0.09, at)
    envelope.gain.exponentialRampToValueAtTime(0.001, at + 0.07)
    source.connect(band)
    band.connect(envelope)
    envelope.connect(this.output)
    source.start(at)
    source.stop(at + 0.08)
  }
}

const MAX_CHARS = 60
const MAX_BLIPS = 22
const BLIP_VOLUME = 0.2
