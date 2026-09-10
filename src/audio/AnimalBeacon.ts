import type { AudioEngine } from './AudioEngine'
import { Cadence } from './Cadence'

/**
 * The waiting animal calling out, placed in 3D so the player can hear which
 * way it is and roughly how far. The panner sits at the animal; the listener
 * is at the helicopter, so turning the nose moves the call around your head.
 */
export class AnimalBeacon {
  private readonly context: AudioContext
  private readonly panner: PannerNode
  private readonly cadence = new Cadence(CALL_PERIOD)

  constructor(engine: AudioEngine) {
    this.context = engine.context
    // refDistance and rolloff are set so a call from the far pad still reads
    // over a hard-working rotor; halve them and it vanishes into the wash.
    this.panner = new PannerNode(this.context, {
      panningModel: 'HRTF',
      distanceModel: 'inverse',
      refDistance: 18,
      maxDistance: 400,
      rolloffFactor: 1.3,
    })
    this.panner.connect(engine.master)
  }

  /** Where the call is currently coming from in the world. */
  get callPosition(): { x: number; y: number; z: number } {
    return {
      x: this.panner.positionX.value,
      y: this.panner.positionY.value,
      z: this.panner.positionZ.value,
    }
  }

  /** Call from where the animal is; pass null while there is no animal to hear. */
  update(position: { x: number; y: number; z: number } | null, dt: number): void {
    if (!position) {
      // Arm the cadence so the next animal is heard the moment it appears.
      this.cadence.reset()
      return
    }

    this.place(position)
    if (this.cadence.advance(dt)) this.call()
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

  /** A short two-note bleat, falling in pitch. */
  private call(): void {
    const ctx = this.context
    const now = ctx.currentTime

    const voice = ctx.createOscillator()
    voice.type = 'sawtooth'
    voice.frequency.setValueAtTime(620, now)
    voice.frequency.exponentialRampToValueAtTime(470, now + 0.28)

    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 1400

    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0, now)
    envelope.gain.linearRampToValueAtTime(CALL_VOLUME, now + 0.02)
    envelope.gain.setValueAtTime(CALL_VOLUME, now + 0.18)
    envelope.gain.linearRampToValueAtTime(0, now + 0.38)

    voice.connect(tone)
    tone.connect(envelope)
    envelope.connect(this.panner)
    voice.start(now)
    voice.stop(now + 0.4)
  }
}

/** Seconds between calls. */
const CALL_PERIOD = 1.8
const CALL_VOLUME = 0.7
