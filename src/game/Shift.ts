/**
 * One shift on the fire: a fixed stretch of time to rescue as many as you can.
 * Gives a run a beginning and an end, a score to beat, and a reason to hurry
 * that the fire alone does not quite supply.
 */
export class Shift {
  elapsed = 0
  private ended = false

  constructor(readonly seconds = SHIFT_SECONDS) {}

  /** Time passes. True on the one frame the shift ends. */
  advance(dt: number): boolean {
    if (this.ended) return false
    this.elapsed = Math.min(this.seconds, this.elapsed + dt)
    if (this.elapsed >= this.seconds) {
      this.ended = true
      return true
    }
    return false
  }

  get remaining(): number {
    return Math.max(0, this.seconds - this.elapsed)
  }

  get over(): boolean {
    return this.ended
  }

  /** The last stretch, when the HUD should start counting out loud. */
  get closing(): boolean {
    return !this.ended && this.remaining <= CLOSING_SECONDS
  }

  /** "4:07" */
  get clock(): string {
    const whole = Math.ceil(this.remaining)
    const minutes = Math.floor(whole / 60)
    const seconds = whole % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
}

const SHIFT_SECONDS = 300
const CLOSING_SECONDS = 30
