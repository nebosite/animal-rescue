/**
 * How battered the helicopter is, from pristine paint to barely flyable.
 *
 * Fire is the only thing that does serious harm, and it harms the machine and
 * never anything alive. Nothing takes the controls away and nothing repairs
 * itself mid-shift: damage accumulates for the whole round, and what it buys
 * you is a worse helicopter — slower, shakier, and sounding wrong — right up
 * to the point where there is nothing left of it. A wreck still flies. It just
 * flies like a wreck, and when you put it down on the pad that is the end of
 * the shift.
 *
 * That is the honest version of the pressure: every detour through the flames
 * is a withdrawal from a balance you cannot top up, and you decide when to
 * cash in what is left.
 */
export class Airframe {
  /** 1 is factory fresh, 0 is a wreck. */
  integrity = 1

  /** Take `seconds` of fire at the given heat, 0..1. */
  scorch(heat: number, seconds: number): void {
    if (heat <= 0) return
    this.integrity = Math.max(0, this.integrity - heat * BURN_RATE * seconds)
  }

  /** Small knocks — a hard landing, clipping the trees — cost a little paint. */
  scuff(amount = SCUFF): void {
    this.integrity = Math.max(0, this.integrity - amount)
  }

  /**
   * Nothing left to lose. It still flies; landing it at base ends the shift.
   */
  get isWrecked(): boolean {
    return this.integrity <= 0
  }

  /** Is it hurt enough to be worth warning about? */
  get isDamaged(): boolean {
    return this.integrity < WARNING
  }

  /** Bad enough that the Chief wants it on the pad before it falls apart. */
  get isFailing(): boolean {
    return this.integrity <= FAILING
  }

  /**
   * How well the machine still works, 0..1 — the same number as `integrity`,
   * named for what the flight model and the engine note do with it.
   */
  get condition(): number {
    return this.integrity
  }

  /** Put it right. Only happens between shifts. */
  repair(): void {
    this.integrity = 1
  }
}

/** Integrity lost per second at full heat: about three seconds in the flames. */
const BURN_RATE = 0.3
/** Below this the pilot should be thinking about going home. */
export const FAILING = 0.2
const WARNING = 0.6
const SCUFF = 0.04
