/**
 * The belly tank. The copilot's other job: knock the front back, open a way
 * through, buy a frightened animal another minute.
 *
 * It is deliberately not a fire extinguisher. There is enough water to slow
 * one stretch of the fire, not to put it out, so the choice of *where* is the
 * interesting part.
 */
export class WaterTank {
  private capacity = CAPACITY
  private level = CAPACITY

  /** A bigger (or smaller) tank, in whole loads. Fill it afterwards. */
  setLoads(loads: number): void {
    this.capacity = loads * LOAD
    this.level = Math.min(this.level, this.capacity)
  }

  /** How full it is, 0..1. */
  get fraction(): number {
    return this.level / this.capacity
  }

  get loads(): number {
    return Math.floor(this.level / LOAD)
  }

  get hasWater(): boolean {
    return this.level >= LOAD
  }

  /** Any water at all, even less than a full load — enough to spray. */
  get hasSpray(): boolean {
    return this.level > 0
  }

  /** Drop a load. Returns false, and drops nothing, when the tank is dry. */
  drop(): boolean {
    if (!this.hasWater) return false
    this.level -= LOAD
    return true
  }

  /** Draw off part of a load for a spray. Returns false once there is nothing left to draw. */
  spray(loads: number): boolean {
    if (this.level <= 0) return false
    this.level = Math.max(0, this.level - loads)
    return true
  }

  /** Sitting on the base pad fills it back up. */
  refill(dt: number): void {
    this.level = Math.min(this.capacity, this.level + (this.capacity / REFILL_SECONDS) * dt)
  }

  fill(): void {
    this.level = this.capacity
  }
}

/** Enough for this many drops on a full tank. */
export const LOADS = 4
const LOAD = 1
const CAPACITY = LOADS * LOAD
/** A full tank in about eight seconds on the pad, however big. */
const REFILL_SECONDS = 8
/** How wide a drop falls, and how much fire it takes out of the front. */
export const DROP_RADIUS = 46
