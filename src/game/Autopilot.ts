import { clampAxis, noInput, type FlightInput } from './FlightInput'
import { TOP_SPEED, type Helicopter } from './Helicopter'

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
 * simply letting it fly and seeing where it ends up. The one liberty it takes
 * is winding up the machine's boost: a wreck gets ferried home hard.
 *
 * Three phases, in order: climb to a height that clears the hills and the
 * smoke, run for home, then stop over the pad and settle. The run home is
 * flown to a target speed rather than at full tilt, because a helicopter
 * doing 230 units a second cannot stop inside a landing pad.
 */
export class Autopilot {
  /** What it is doing right now, for the HUD. */
  phase: 'climbing' | 'cruising' | 'landing' = 'climbing'

  private readonly input: FlightInput = noInput()

  update(helicopter: Helicopter, target: Waypoint, groundBelow: number): FlightInput {
    const dx = target.x - helicopter.position.x
    const dz = target.z - helicopter.position.z
    const range = Math.hypot(dx, dz)

    // Hard while there is distance or height left to lose, easing back to an
    // ordinary helicopter for the last of it, so the landing is a landing
    // rather than an arrival. Height counts: most of a trip home from cruise
    // is the descent, and creeping down from 150 metres is what made the old
    // autopilot feel interminable.
    const height = helicopter.position.y - target.y
    const toGo = Math.max(range, height * HEIGHT_COUNTS_AS)
    const haul = clamp01((toGo - SLOW_FROM) / (FULL_BOOST_FROM - SLOW_FROM))
    helicopter.boost = 1 + (FERRY_BOOST - 1) * haul

    // Positive means the target is to the left of the nose.
    const bearing = wrap(Math.atan2(-dx, -dz) - helicopter.heading)
    // Heading grows turning left, and positive yaw input turns right.
    this.input.yaw = clampAxis(-bearing * YAW_GAIN)

    const closing = projectedSpeed(helicopter, dx, dz, range)
    const overhead = range < ARRIVE_RADIUS
    // Fly a glideslope rather than a plateau: high while there is distance to
    // run, coming down in step with the approach. Flying the whole way at
    // cruise and then descending vertically is what made this take forever.
    // Never below a safe height over whatever is actually underneath.
    const glide = clamp(range * GLIDE_SLOPE, ARRIVE_HEIGHT, CRUISE_HEIGHT)
    const cruise = Math.max(groundBelow + TERRAIN_CLEARANCE, target.y + glide)

    if (overhead) {
      this.phase = 'landing'
      // Creep the last few metres onto the middle of the pad rather than
      // settling wherever the run home happened to end.
      const creep = Math.min(CREEP_SPEED, range * CREEP_GAIN)
      this.input.pitch = clampAxis((creep - closing) * BRAKE_GAIN)
      this.input.roll = 0
      // Come down fast while high and feather out near the ground, so it is
      // quick and still lands softly enough not to count as a hard landing.
      const wantDown = clamp(height * DESCENT_GAIN, GENTLE_DESCENT, FAST_DESCENT)
      this.input.collective = helicopter.isOnGround
        ? 0
        : clampAxis((-wantDown - helicopter.velocity.y) * VERTICAL_GAIN)
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
    // Fly at a speed it can still stop from: fast while there is room, easing
    // down in proportion to what is left.
    const ceiling = TOP_SPEED * helicopter.boost
    const wanted = Math.min(ceiling, Math.max(ARRIVAL_SPEED, range * CLOSE_GAIN))
    // Only pull for home once roughly pointed at it, so it turns rather than arcs.
    const aimed = Math.max(0, 1 - Math.abs(bearing) / AIM_TOLERANCE)
    this.input.pitch = clampAxis((wanted - closing) * SPEED_GAIN * aimed)
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

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

/** Within this of the pad, stop flying and start landing. */
const ARRIVE_RADIUS = 14
/** How much harder than a pilot the Chief flies a wreck home. */
const FERRY_BOOST = 5
/** Boost is full beyond the first figure and gone by the second. */
const FULL_BOOST_FROM = 220
const SLOW_FROM = 55
/** A metre of height left to lose is worth this much of a metre of distance. */
const HEIGHT_COUNTS_AS = 0.8
/** How high above the pad it rides when there is a long way to go. */
const CRUISE_HEIGHT = 95
/** The glideslope: this many metres of height per metre of distance left. */
const GLIDE_SLOPE = 0.45
/** Height above the pad when it reaches the pad's edge and starts landing. */
const ARRIVE_HEIGHT = 9
/** Always this far above whatever is directly underneath — trees reach ~21. */
const TERRAIN_CLEARANCE = 34
/** How far below the glideslope it will tolerate before it stops pressing on. */
const CLEARANCE_SLACK = 25
const YAW_GAIN = 1.6
const CLIMB_GAIN = 0.06
/**
 * Target speed falls off this steeply with the distance left to run. It can
 * afford to be near 1: with the ferry boost there is far more braking
 * available than the old unboosted machine had.
 */
const CLOSE_GAIN = 0.95
/** Still moving this fast when it reaches the pad's edge, ready to stop. */
const ARRIVAL_SPEED = 9
const SPEED_GAIN = 0.2
const BRAKE_GAIN = 0.35
/** How briskly it slides the last few metres onto the middle of the pad. */
const CREEP_SPEED = 6
const CREEP_GAIN = 0.5
/** Descent profile: proportional to height, between these two rates. */
const DESCENT_GAIN = 0.95
const FAST_DESCENT = 45
const GENTLE_DESCENT = 3.4
const VERTICAL_GAIN = 0.25
/** Beyond this many radians off the nose, it turns instead of flying. */
const AIM_TOLERANCE = 0.9
