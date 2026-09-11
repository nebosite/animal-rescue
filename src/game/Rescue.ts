import { ROSTER, type AnimalProfile } from './AnimalProfile'
import type { LandingPad } from './LandingPad'

/** What just happened, when landing changed the state of the rescue. */
export type RescueEvent = 'picked-up' | 'delivered'

/**
 * The rescue loop: an animal waits at the pickup, gets carried, and is
 * delivered to the rescue pad for its value in points — less a point for
 * every scolding it gave on the way, though never less than one.
 *
 * Knows nothing about meshes or input. Landing is reported to it, and it
 * decides whether anything happened — so the same call every frame while
 * parked on a pad is harmless, and no edge detection is needed.
 */
export class Rescue {
  score = 0
  rescued = 0
  carrying = false
  animalWaiting = true
  /** The animal and credit of the most recent delivery, for the thank-you. */
  lastDelivery: { animal: AnimalProfile; credited: number } | null = null

  private index = 0
  private creditLeft: number

  constructor(
    private readonly pickupPad: LandingPad,
    private readonly rescuePad: LandingPad,
    private readonly roster: readonly AnimalProfile[] = ROSTER,
  ) {
    this.creditLeft = roster[0].value
  }

  /** Whoever is waiting, or aboard. */
  get animal(): AnimalProfile {
    return this.roster[this.index]
  }

  /** Points this animal will credit if delivered now. */
  get credit(): number {
    return this.creditLeft
  }

  /** Report where the helicopter has landed. Returns an event, or null. */
  landedOn(pad: LandingPad | null): RescueEvent | null {
    if (pad === this.pickupPad && this.animalWaiting && !this.carrying) {
      this.animalWaiting = false
      this.carrying = true
      return 'picked-up'
    }

    if (pad === this.rescuePad && this.carrying) {
      this.lastDelivery = { animal: this.animal, credited: this.creditLeft }
      this.score += this.creditLeft
      this.rescued += 1
      this.carrying = false
      // The next animal is waiting, so the loop can be flown again.
      this.index = (this.index + 1) % this.roster.length
      this.creditLeft = this.animal.value
      this.animalWaiting = true
      return 'delivered'
    }

    return null
  }

  /** Rough handling while aboard costs a point of credit — but never the last one. */
  scold(): void {
    if (this.carrying && this.creditLeft > 1) this.creditLeft -= 1
  }
}
