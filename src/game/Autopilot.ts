import { clampAxis, noInput, type FlightInput } from './FlightInput'
import type { Helicopter } from './Helicopter'

/** Somewhere the autopilot can be told to go. */
export interface Waypoint {
  x: number
  y: number
  z: number
}

/**
 * Flies the helicopter home and puts it down, when the pilot has wrecked it
 * badly enough to lose the controls.
 *
 * It produces exactly the same FlightInput a human would, so it flies through
 * the ordinary flight model with no special cases — and can be tested by
 * simply letting it fly and seeing where it ends up.
 *
 * Three phases, in order: climb to a height that clears the hills and the
 * smoke, turn and run for home, then stop over the pad and settle.
 */
export class Autopilot {
  /** What it is doing right now, for the HUD. */
  phase: 'climbing' | 'cruising' | 'landing' = 'climbing'

  private readonly input: FlightInput = noInput()

  update(helicopter: Helicopter, target: Waypoint, groundBelow: number): FlightInput {
    const dx = target.x - helicopter.position.x
    const dz = target.z - helicopter.position.z
    const range = Math.hypot(dx, dz)

    // Positive means the target is to the left of the nose.
    const bearing = wrap(Math.atan2(-dx, -dz) - helicopter.heading)
    // Heading grows turning left, and positive yaw input turns right.
    this.input.yaw = clampAxis(-bearing * YAW_GAIN)

    const overhead = range < ARRIVE_RADIUS
    const cruise = Math.max(MIN_CRUISE, groundBelow + CLEARANCE, target.y + CLEARANCE)

    if (overhead) {
      this.phase = 'landing'
      // Sit down on the pad: no lean, and hold the descent until the skids touch.
      this.input.pitch = clampAxis(-projectedSpeed(helicopter, dx, dz, range) * BRAKE_GAIN)
      this.input.roll = 0
      this.input.collective = helicopter.isOnGround ? 0 : -DESCENT
      return this.input
    }

    const wantsHeight = cruise - helicopter.position.y
    this.input.collective = clampAxis(wantsHeight * CLIMB_GAIN)

    if (helicopter.position.y < cruise - CLEARANCE_SLACK) {
      // Get up first. Running for home through a hillside is not a plan.
      this.phase = 'climbing'
      this.input.pitch = 0
      this.input.roll = 0
      return this.input
    }

    this.phase = 'cruising'
    // Only pull for home once roughly pointed at it, so it turns rather than arcs.
    const aimed = Math.max(0, 1 - Math.abs(bearing) / AIM_TOLERANCE)
    this.input.pitch = clampAxis(aimed)
    this.input.roll = 0
    return this.input
  }
}

/** How fast the helicopter is closing on the target, in units per second. */
function projectedSpeed(helicopter: Helicopter, dx: number, dz: number, range: number): number {
  if (range < 1e-3) return 0
  return (helicopter.velocity.x * dx + helicopter.velocity.z * dz) / range
}

function wrap(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

/** Within this of the pad, stop flying and start landing. */
const ARRIVE_RADIUS = 14
/** Height to clear the hills and the top of the smoke. */
const MIN_CRUISE = 150
const CLEARANCE = 95
/** How far below cruise it will tolerate before it stops pressing on. */
const CLEARANCE_SLACK = 25
const YAW_GAIN = 1.6
const CLIMB_GAIN = 0.06
const BRAKE_GAIN = 0.35
const DESCENT = 0.55
/** Beyond this many radians off the nose, it turns instead of flying. */
const AIM_TOLERANCE = 0.9
