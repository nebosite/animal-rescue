/**
 * Rough air: a smooth, wandering shove that never repeats on a beat.
 *
 * Deterministic from the clock rather than Math.random, so a test can run it
 * forward and check the shape of it — that it stays bounded, that it is not
 * periodic enough to feel like a machine, and that it averages out rather than
 * pushing the helicopter steadily one way.
 */
export class Turbulence {
  private t = 0

  advance(dt: number): void {
    this.t += dt
  }

  /** Sideways shove at the given strength, 0..1. */
  buffetX(strength: number): number {
    return strength * FORCE * wander(this.t, 0)
  }

  /** Fore-and-aft shove at the given strength, 0..1. */
  buffetZ(strength: number): number {
    return strength * FORCE * wander(this.t, 7.3)
  }
}

/**
 * Three sine waves at frequencies with no common multiple, so the sum never
 * comes back round to where it started at any period a player would notice.
 */
function wander(t: number, phase: number): number {
  return (
    0.55 * Math.sin(t * 1.7 + phase) +
    0.30 * Math.sin(t * 4.3 + phase * 1.9) +
    0.15 * Math.sin(t * 9.1 + phase * 0.6)
  )
}

/** Acceleration, in units per second squared, at full strength. */
const FORCE = 26
