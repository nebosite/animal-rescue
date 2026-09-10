import type { Helicopter } from '../game/Helicopter'
import { AnimalBeacon } from './AnimalBeacon'
import type { AudioEngine } from './AudioEngine'
import { RotorSound } from './RotorSound'
import { SoundEffects } from './SoundEffects'

/**
 * Everything the game sounds like, driven from the game state once per frame.
 * Reads the flight model; never decides anything about it.
 */
export class Soundscape {
  readonly rotor: RotorSound
  readonly beacon: AnimalBeacon
  readonly effects: SoundEffects

  constructor(private readonly engine: AudioEngine) {
    this.rotor = new RotorSound(engine)
    this.beacon = new AnimalBeacon(engine)
    this.effects = new SoundEffects(engine)
  }

  /** Call every frame. `animalPosition` is where a waiting animal is, or null. */
  frame(helicopter: Helicopter, animalPosition: { x: number; y: number; z: number } | null, dt: number): void {
    this.engine.setListener(helicopter.position, helicopter.heading)
    this.rotor.update(helicopter.effort, helicopter.speed)
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
