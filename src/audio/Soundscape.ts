import type { Helicopter } from '../game/Helicopter'
import { AnimalBeacon } from './AnimalBeacon'
import type { AudioEngine } from './AudioEngine'
import { Ducker } from './Ducker'
import { Reverb } from './Reverb'
import { RotorSound } from './RotorSound'
import { SoundEffects } from './SoundEffects'
import { VoiceBlips } from './VoiceBlips'
import { WindSound } from './WindSound'

/**
 * Everything the game sounds like, driven from the game state once per frame.
 * Reads the flight model; never decides anything about it.
 *
 * The ambient beds — rotor, wind, the animal's call — run through a ducker, so
 * anything said on the radio pushes them down and is actually heard.
 */
export class Soundscape {
  readonly reverb: Reverb
  readonly ducker: Ducker
  readonly rotor: RotorSound
  readonly wind: WindSound
  readonly beacon: AnimalBeacon
  readonly effects: SoundEffects
  readonly voice: VoiceBlips

  constructor(private readonly engine: AudioEngine) {
    this.reverb = new Reverb(engine)
    this.ducker = new Ducker(engine.context, engine.master)
    this.rotor = new RotorSound(engine, this.reverb, this.ducker.input)
    this.wind = new WindSound(engine, this.ducker.input)
    this.beacon = new AnimalBeacon(engine, this.reverb, this.ducker.input)
    this.effects = new SoundEffects(engine, this.reverb)
    this.voice = new VoiceBlips(engine, this.reverb, this.ducker)
  }

  /** Call every frame. `animalPosition` is where a waiting animal is, or null. */
  frame(helicopter: Helicopter, animalPosition: { x: number; y: number; z: number } | null, dt: number): void {
    this.engine.setListener(helicopter.position, helicopter.heading)
    this.rotor.update(helicopter.effort, helicopter.speed)
    // Height above the ground, not sea level: on a hilltop the parked
    // helicopter is still parked, and the wind must not howl because the
    // land under it happens to be high.
    this.wind.update(helicopter.altitudeAboveGround, helicopter.speed)
    this.beacon.update(animalPosition, dt)
    this.effects.advance(dt)

    if (helicopter.justLanded) this.effects.touchdown()
    if (helicopter.justBumped) this.effects.bump()
  }

  pickedUp(): void {
    this.effects.pickup()
  }

  delivered(): void {
    this.effects.delivered()
  }
}
