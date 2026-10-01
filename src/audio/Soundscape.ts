import type { Helicopter } from '../game/Helicopter'
import { AnimalBeacon } from './AnimalBeacon'
import type { AudioEngine } from './AudioEngine'
import { Ducker } from './Ducker'
import { FireSound } from './FireSound'
import { Reverb } from './Reverb'
import { RotorSound } from './RotorSound'
import { SoundEffects } from './SoundEffects'
import { RadioVoice } from './RadioVoice'
import { WindSound } from './WindSound'

/** What the world sounds like from where the helicopter is, this frame. */
export interface Surroundings {
  /** Where the animal you are going for is calling from, or null. */
  callFrom: { x: number; y: number; z: number } | null
  /** Metres to the nearest flame. */
  fireDistance: number
  inTheFire: boolean
}

/**
 * Everything the game sounds like, driven from the game state once per frame.
 * Reads the flight model; never decides anything about it.
 *
 * The ambient beds — rotor, wind, fire, the animal's call — run through a
 * ducker, so anything said on the radio pushes them down and is actually heard.
 */
export class Soundscape {
  readonly reverb: Reverb
  readonly ducker: Ducker
  readonly rotor: RotorSound
  readonly wind: WindSound
  readonly fire: FireSound
  readonly beacon: AnimalBeacon
  readonly effects: SoundEffects
  readonly voice: RadioVoice

  constructor(private readonly engine: AudioEngine) {
    this.reverb = new Reverb(engine)
    this.ducker = new Ducker(engine.context, engine.master)
    this.rotor = new RotorSound(engine, this.reverb, this.ducker.input)
    this.wind = new WindSound(engine, this.ducker.input)
    this.fire = new FireSound(engine, this.ducker.input)
    this.beacon = new AnimalBeacon(engine, this.reverb, this.ducker.input)
    this.effects = new SoundEffects(engine, this.reverb)
    this.voice = new RadioVoice(engine, this.reverb, this.ducker)
  }

  /** Call every frame. */
  frame(helicopter: Helicopter, around: Surroundings, dt: number): void {
    this.engine.setListener(helicopter.position, helicopter.heading)
    // The engine note carries the damage: it is the one thing about the state
    // of the machine the pilot cannot see while flying.
    this.rotor.update(helicopter.effort, helicopter.speed, helicopter.condition)
    // Height above the ground, not sea level: on a hilltop the parked
    // helicopter is still parked, and the wind must not howl because the
    // land under it happens to be high.
    this.wind.update(helicopter.altitudeAboveGround, helicopter.speed)
    this.fire.update(around.fireDistance, around.inTheFire)
    this.beacon.update(around.callFrom, dt)
    // Anything that happens once per blade — thrashing through a canopy — is
    // paced from the rotor itself, so the two never drift apart.
    this.effects.setBladeRate(this.rotor.bladeHz)
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
