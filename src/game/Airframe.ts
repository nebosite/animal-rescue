/**
 * How battered the helicopter is, from pristine paint to barely flyable.
 *
 * Fire is the only thing that does serious harm, and it harms the machine and
 * never anything alive. Below the critical mark the pilot loses the controls
 * and the autopilot takes it home, which is the game's way of saying "that is
 * enough" without anything being destroyed.
 */
export class Airframe {
  /** 1 is factory fresh, 0 is a wreck. */
  integrity = 1
  /** True once it has gone critical, until it is repaired at base. */
  private grounded = false

  /** Take `seconds` of fire at the given heat, 0..1. */
  scorch(heat: number, seconds: number): void {
    if (heat <= 0) return
    this.integrity = Math.max(0, this.integrity - heat * BURN_RATE * seconds)
    if (this.integrity <= CRITICAL) this.grounded = true
  }

  /** Small knocks — a hard landing, clipping the edge — cost a little paint. */
  scuff(amount = SCUFF): void {
    this.integrity = Math.max(0, this.integrity - amount)
    if (this.integrity <= CRITICAL) this.grounded = true
  }

  /** True while the autopilot should be flying it home for repairs. */
  get needsRepair(): boolean {
    return this.grounded
  }

  /** Is it hurt enough to be worth warning about? */
  get isDamaged(): boolean {
    return this.integrity < WARNING
  }

  /** Put it right. Only happens on the base pad. */
  repair(): void {
    this.integrity = 1
    this.grounded = false
  }
}

/** Integrity lost per second at full heat: about three seconds in the flames. */
const BURN_RATE = 0.3
/** Below this the pilot loses the controls and is flown home. */
const CRITICAL = 0.25
const WARNING = 0.6
const SCUFF = 0.04
