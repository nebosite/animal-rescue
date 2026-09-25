/**
 * Lets something happen on demand, but no more often than every `seconds`.
 * Used to stop a sound that is triggered every frame — a bump against a wall
 * you keep pushing into — from firing sixty times a second.
 */
export class Cooldown {
  private remaining = 0

  constructor(private readonly seconds: number) {}

  advance(dt: number): void {
    this.remaining = Math.max(0, this.remaining - dt)
  }

  /** True if allowed now — and if so, starts the cooldown. */
  tryFire(): boolean {
    if (this.remaining > 0) return false
    this.remaining = this.seconds
    return true
  }

  /**
   * Advance and fire in one call, for the common "do this every so often"
   * case. `advance` returns nothing, so using it directly as a condition
   * silently never fires — which is precisely how the forest came to never
   * catch alight. This is the shape that cannot be got wrong.
   */
  due(dt: number): boolean {
    this.advance(dt)
    return this.tryFire()
  }
}
