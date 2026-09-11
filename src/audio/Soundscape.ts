import type { Helicopter } from '../game/Helicopter'
import { AnimalBeacon } from './AnimalBeacon'
import type { AudioEngine } from './AudioEngine'
import { Reverb } from './Reverb'
import { RotorSound } from './RotorSound'
import { SoundEffects } from './SoundEffects'
import { VoiceBlips } from './VoiceBlips'
import { WindSound } from './WindSound'

/**
 * Everything the game sounds like, driven from the game state once per frame.
 * Reads the flight model; never decides anything about it.
 */
export class Soundscape {
  readonly reverb: Reverb
  readonly rotor: RotorSound
  readonly wind: WindSound
  readonly beacon: AnimalBeacon
  readonly effects: SoundEffects
  readonly voice: VoiceBlips

  constructor(private readonly engine: AudioEngine) {
    this.reverb = new Reverb(engine)
    this.rotor = new RotorSound(engine, this.reverb)
    this.wind = new WindSound(engine)
    this.beacon = new AnimalBeacon(engine, this.reverb)
    this.effects = new SoundEffects(engine, this.reverb)
    this.voice = new VoiceBlips(engine, this.reverb)
  }

  /** Call every frame. `animalPosition` is where a waiting animal is, or null. */
  frame(helicopter: Helicopter, animalPosition: { x: number; y: number; z: number } | null, dt: number): void {
    this.engine.setListener(helicopter.position, helicopter.heading)
    this.rotor.update(helicopter.effort, helicopter.speed)
    this.wind.update(helicopter.position.y, helicopter.speed)
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
