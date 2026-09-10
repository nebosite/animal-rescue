/**
 * Fires on a fixed period — immediately the first time, then every `period`
 * seconds. Resetting arms it to fire immediately again, so a sound that comes
 * back after a gap speaks straight away rather than waiting out a period.
 */
export class Cadence {
  private elapsed: number

  constructor(private readonly period: number) {
    this.elapsed = period
  }

  /** Advance by `dt` seconds; true when it is time to fire. */
  advance(dt: number): boolean {
    this.elapsed += dt
    if (this.elapsed < this.period) return false
    this.elapsed = 0
    return true
  }

  reset(): void {
    this.elapsed = this.period
  }
}
