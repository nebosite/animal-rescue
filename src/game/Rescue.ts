import type { LandingPad } from './LandingPad'

/** What just happened, when landing changed the state of the rescue. */
export type RescueEvent = 'picked-up' | 'delivered'

/**
 * The rescue loop: an animal waits at the pickup pad, gets carried, and is
 * delivered to the rescue pad for a point.
 *
 * Knows nothing about meshes or input. Landing is reported to it, and it
 * decides whether anything happened — so the same call every frame while
 * parked on a pad is harmless, and no edge detection is needed.
 */
export class Rescue {
  score = 0
  carrying = false
  animalWaiting = true

  constructor(
    private readonly pickupPad: LandingPad,
    private readonly rescuePad: LandingPad,
  ) {}

  /** Report where the helicopter has landed. Returns an event, or null. */
  landedOn(pad: LandingPad | null): RescueEvent | null {
    if (pad === this.pickupPad && this.animalWaiting && !this.carrying) {
      this.animalWaiting = false
      this.carrying = true
      return 'picked-up'
    }

    if (pad === this.rescuePad && this.carrying) {
      this.carrying = false
      this.score += 1
      // Another animal is waiting, so the loop can be flown again.
      this.animalWaiting = true
      return 'delivered'
    }

    return null
  }
}
