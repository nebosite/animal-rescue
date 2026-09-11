import { Cooldown } from './Cooldown'
import type { Helicopter } from './Helicopter'

export type RoughHandling = 'hard-landing' | 'steep-bank' | 'bump'

/**
 * Notices when the helicopter is being flown roughly: a hard touchdown, a
 * sustained steep bank, or a knock against the edge of the field. How much it
 * takes is set by `fussiness` — the passenger's, or the Chief's — so the same
 * flying can be fine for Gus and an outrage for Duchess.
 *
 * Reads the flight model; decides nothing about it. Complaints are rate
 * limited so one bad turn does not produce a tirade.
 */
export class Handling {
  private bankSeconds = 0
  private readonly cooldown = new Cooldown(COMPLAINT_COOLDOWN)

  constructor(private fussiness = 0.5) {}

  setFussiness(fussiness: number): void {
    this.fussiness = Math.min(1, Math.max(0, fussiness))
  }

  /** Call every frame. Returns what just went wrong, if anything, at most every few seconds. */
  update(helicopter: Helicopter, dt: number): RoughHandling | null {
    this.cooldown.advance(dt)

    let rough: RoughHandling | null = null
    if (helicopter.justLanded && helicopter.impactSpeed > hardLandingThreshold(this.fussiness)) {
      rough = 'hard-landing'
    } else if (helicopter.justBumped) {
      rough = 'bump'
    } else if (Math.abs(helicopter.roll) > bankThreshold(this.fussiness)) {
      // A steep bank has to be held; a flick through it is not rough.
      this.bankSeconds += dt
      if (this.bankSeconds > BANK_HOLD_SECONDS) {
        rough = 'steep-bank'
        this.bankSeconds = 0
      }
    } else {
      this.bankSeconds = 0
    }

    if (rough && this.cooldown.tryFire()) return rough
    return null
  }
}

/** Descent rate at touchdown that counts as hard, units per second. */
export function hardLandingThreshold(fussiness: number): number {
  return 8 - 4 * fussiness
}

/** Bank angle that counts as steep, radians. Full stick alone is 0.42; a banked turn reaches 0.72. */
export function bankThreshold(fussiness: number): number {
  return 0.55 - 0.25 * fussiness
}

const BANK_HOLD_SECONDS = 0.45
const COMPLAINT_COOLDOWN = 2.5
