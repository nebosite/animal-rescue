import type { CallProfile } from '../game/AnimalProfile'
import type { AudioEngine } from './AudioEngine'
import { Cadence } from './Cadence'
import type { Reverb } from './Reverb'

/**
 * The waiting animal calling out, placed in 3D so the player can hear which
 * way it is and roughly how far. The panner sits at the animal; the listener
 * is at the helicopter, so turning the nose moves the call around your head.
 */
export class AnimalBeacon {
  private readonly context: AudioContext
  private readonly panner: PannerNode
  private readonly cadence = new Cadence(CALL_PERIOD)
  private call: CallProfile = DEFAULT_CALL

  constructor(engine: AudioEngine, reverb?: Reverb, destination: AudioNode = engine.master) {
    this.context = engine.context
    // A gentle rolloff so the call carries from the far pad over a working
    // rotor, while the modest volume keeps it from swamping the mix up close —
    // a loud call right under the skids made the pickup feel like a cut-out.
    this.panner = new PannerNode(this.context, {
      panningModel: 'HRTF',
      distanceModel: 'inverse',
      refDistance: 18,
      maxDistance: 400,
      rolloffFactor: 0.8,
    })
    this.panner.connect(destination)

    // A far-off call in open country comes back off the hills: a strong send.
    if (reverb) {
      const echo = this.context.createGain()
      echo.gain.value = 0.55
      this.panner.connect(echo)
      echo.connect(reverb.send)
    }
  }

  /** Where the call is currently coming from in the world. */
  get callPosition(): { x: number; y: number; z: number } {
    return {
      x: this.panner.positionX.value,
      y: this.panner.positionY.value,
      z: this.panner.positionZ.value,
    }
  }

  /** Give the beacon this animal's voice. */
  setCall(call: CallProfile): void {
    this.call = call
  }

  /** Call from where the animal is; pass null while there is no animal to hear. */
  update(position: { x: number; y: number; z: number } | null, dt: number): void {
    if (!position) {
      // Arm the cadence so the next animal is heard the moment it appears.
      this.cadence.reset()
      return
    }

    this.place(position)
    if (this.cadence.advance(dt)) this.cry()
  }

  private place(position: { x: number; y: number; z: number }): void {
    if (this.panner.positionX) {
      this.panner.positionX.value = position.x
      this.panner.positionY.value = position.y
      this.panner.positionZ.value = position.z
    } else {
      this.panner.setPosition(position.x, position.y, position.z)
    }
  }

  /** The animal's own call — a yip, a hoot, a moan — repeated as its profile says. */
  private cry(): void {
    const ctx = this.context
    const { wave, fromHz, toHz, seconds, lowpassHz, repeats } = this.call
    const gap = seconds + 0.08

    for (let i = 0; i < repeats; i++) {
      const at = ctx.currentTime + i * gap

      const voice = ctx.createOscillator()
      voice.type = wave
      voice.frequency.setValueAtTime(fromHz, at)
      voice.frequency.exponentialRampToValueAtTime(toHz, at + seconds)

      const tone = ctx.createBiquadFilter()
      tone.type = 'lowpass'
      tone.frequency.value = lowpassHz

      const envelope = ctx.createGain()
      envelope.gain.setValueAtTime(0, at)
      envelope.gain.linearRampToValueAtTime(CALL_VOLUME, at + 0.02)
      envelope.gain.setValueAtTime(CALL_VOLUME, at + seconds * 0.6)
      envelope.gain.linearRampToValueAtTime(0, at + seconds + 0.05)

      voice.connect(tone)
      tone.connect(envelope)
      envelope.connect(this.panner)
      voice.start(at)
      voice.stop(at + seconds + 0.07)
    }
  }
}

/** Seconds between calls. */
const CALL_PERIOD = 1.8
const CALL_VOLUME = 0.45
const DEFAULT_CALL: CallProfile = { wave: 'sawtooth', fromHz: 620, toHz: 470, seconds: 0.28, lowpassHz: 1400, repeats: 1 }
