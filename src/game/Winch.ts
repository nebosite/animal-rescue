/**
 * The rescue winch: a line the copilot pays out of the door.
 *
 * It is the alternative to putting the skids down. Hovering steady and low
 * while someone else works the line is harder than landing, and it is the one
 * job in the helicopter that a second pair of hands can do without taking the
 * controls away from the pilot.
 */
export class Winch {
  /** How far the hook hangs below the helicopter. */
  length = 0
  /** True while the line is being paid out rather than wound in. */
  paying = false

  /** Hold to lower, release to wind back in. */
  update(lowering: boolean, dt: number): void {
    this.paying = lowering
    const rate = lowering ? PAY_OUT_RATE : -WIND_IN_RATE
    this.length = clamp(this.length + rate * dt, 0, MAX_LENGTH)
  }

  /** Wind it straight in — after a pickup, or when the shift ends. */
  stow(): void {
    this.length = 0
    this.paying = false
  }

  get isStowed(): boolean {
    return this.length <= 0.01
  }

  /** How far out it is, 0..1, for the gauge. */
  get extended(): number {
    return this.length / MAX_LENGTH
  }

  /** Where the hook is, given where the helicopter is. */
  hookHeight(helicopterY: number): number {
    return helicopterY - this.length
  }

  /**
   * Can the hook reach an animal standing on ground of this height?
   * The line has to be near it — dangling the hook a storey up catches nothing.
   */
  canReach(helicopterY: number, groundY: number): boolean {
    const gap = this.hookHeight(helicopterY) - groundY
    return gap <= GRAB_HEIGHT && gap >= -DIG_IN
  }
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

/** How long the line can get. Longer than the tallest tree, deliberately. */
export const MAX_LENGTH = 34
const PAY_OUT_RATE = 14
/** Winds in faster than it goes out: nobody wants to wait with a fire coming. */
const WIND_IN_RATE = 20
/** The hook catches an animal within this of the ground. */
const GRAB_HEIGHT = 3.5
/** And tolerates this much slack piled on the ground. */
const DIG_IN = 6
