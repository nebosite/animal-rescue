/**
 * The belly tank. The copilot's other job: knock the front back, open a way
 * through, buy a frightened animal another minute.
 *
 * It is deliberately not a fire extinguisher. There is enough water to slow
 * one stretch of the fire, not to put it out, so the choice of *where* is the
 * interesting part.
 */
export class WaterTank {
  private level = CAPACITY

  /** How full it is, 0..1. */
  get fraction(): number {
    return this.level / CAPACITY
  }

  get loads(): number {
    return Math.floor(this.level / LOAD)
  }

  get hasWater(): boolean {
    return this.level >= LOAD
  }

  /** Drop a load. Returns false, and drops nothing, when the tank is dry. */
  drop(): boolean {
    if (!this.hasWater) return false
    this.level -= LOAD
    return true
  }

  /** Sitting on the base pad fills it back up. */
  refill(dt: number): void {
    this.level = Math.min(CAPACITY, this.level + REFILL_PER_SECOND * dt)
  }

  fill(): void {
    this.level = CAPACITY
  }
}

/** Enough for this many drops on a full tank. */
export const LOADS = 4
const LOAD = 1
const CAPACITY = LOADS * LOAD
/** A full tank in about eight seconds on the pad. */
const REFILL_PER_SECOND = CAPACITY / 8
/** How wide a drop falls, and how much fire it takes out of the front. */
export const DROP_RADIUS = 46
