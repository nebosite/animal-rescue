import * as THREE from 'three'
import type { FlightInput } from './FlightInput'

/**
 * The flight model: where the helicopter is, how it is moving, and which way
 * it is leaning.
 *
 * Arcade rather than simulation. The pilot's input sets a target attitude, the
 * attitude eases toward it, and thrust comes from the attitude — so the
 * helicopter visibly leans before it goes, drifts when the stick is released,
 * and has to be flown into a stop. Yaw turns the nose; forward is wherever the
 * nose points.
 *
 * Deliberately free of the renderer, so the whole thing can be flown in a plain
 * Node test with no browser and no GL context.
 */
export class Helicopter {
  readonly position = new THREE.Vector3(0, START_ALTITUDE, 0)
  readonly velocity = new THREE.Vector3()

  /** Direction the nose points, radians about +Y. Zero faces -Z. */
  heading = 0
  /** Current lean, radians. Positive pitch is nose down; positive roll is right side down. */
  pitch = 0
  roll = 0
  /**
   * Rocking from rough air, radians, on top of the flown attitude. Kept apart
   * from `pitch`/`roll` so the lean easing cannot quietly undo it — the drawing
   * adds the two together.
   */
  shakePitch = 0
  shakeRoll = 0
  /**
   * Judder from a battered machine, radians, kept apart from both the flown
   * attitude and the air for the same reason `shakePitch` is: rough air
   * *assigns* the shake angles every frame it is felt, so a damage wobble
   * folded into those would vanish the moment you crossed a thermal.
   */
  rattlePitch = 0
  rattleRoll = 0

  /**
   * How much helicopter is left, 0..1, as `Airframe` sees it. A wreck still
   * flies — that is the point, nothing is ever taken away from the pilot — but
   * it is slower off the mark, slower to climb, and it never stops shaking.
   */
  condition = 1

  /** Bought power: a multiple of stock thrust and climb, on top of whatever damage leaves. */
  enginePower = 1

  /** True on the one update in which the skids touched down. */
  justLanded = false
  /** How fast it was descending when the skids touched, units per second. Set with justLanded. */
  impactSpeed = 0
  /** True on any update in which the helicopter was pushed back by a limit. */
  justBumped = false
  /** True while the helicopter is dragging through something solid. */
  justStruck = false
  /**
   * Multiplies thrust and collective. The autopilot winds this up to ferry a
   * wreck home quickly; a pilot always flies at 1.
   */
  boost = 1

  private yawRate = 0
  private rattlePhase = 0
  /** The stick-driven part of the roll, before the cosmetic turn-bank is added. */
  private leanRoll = 0
  private wasOnGround = false
  /** Terrain height under the helicopter, as told to the last update. */
  private ground = 0
  private readonly steer = new THREE.Vector2()
  private readonly thrust = new THREE.Vector3()

  /** The lowest the helicopter can be here: skids resting on the ground. */
  get restingAltitude(): number {
    return this.ground + SKID_HEIGHT
  }

  /** Height of the skids above the ground below. */
  get altitudeAboveGround(): number {
    return this.position.y - this.restingAltitude
  }

  /** True when the helicopter is resting on the ground rather than flying. */
  get isOnGround(): boolean {
    return this.position.y <= this.restingAltitude + GROUND_TOLERANCE
  }

  /** Ground speed in units per second. */
  get speed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z)
  }

  /**
   * How hard the machine is working, 0..1. Climbing, leaning hard and turning
   * all cost effort; hovering level costs none. Meant for driving sound.
   */
  get effort(): number {
    const lean = Math.hypot(this.pitch / MAX_PITCH, this.roll / MAX_ROLL)
    const climb = Math.max(0, this.velocity.y / VERTICAL_TERMINAL_SPEED)
    const turn = Math.abs(this.yawRate / YAW_RATE)
    return Math.min(1, 0.55 * lean + 0.45 * climb + 0.3 * turn)
  }

  /**
   * Step the flight model. `groundHeight` is the terrain under the helicopter
   * right now — the model clamps to it rather than to a fixed floor, so the
   * skids settle on a hilltop as readily as on the valley floor.
   */
  update(input: FlightInput, dt: number, groundHeight = 0): void {
    this.ground = groundHeight
    this.justLanded = false
    this.justBumped = false
    this.justStruck = false
    const onGround = this.isOnGround

    // Rough air has to keep telling the machine to rock; left alone it settles.
    this.shakePitch = approach(this.shakePitch, 0, SHAKE_SETTLES, dt)
    this.shakeRoll = approach(this.shakeRoll, 0, SHAKE_SETTLES, dt)

    this.rattle(dt)
    this.turn(input.yaw, dt)
    this.lean(input, onGround, dt)
    this.applyThrust(onGround, dt)
    this.applyCollective(input.collective, dt)
    // Remembered before the ground clamp zeroes it, so a landing knows how hard it was.
    const descentRate = -this.velocity.y
    this.integrate(dt)
    this.stayInBounds()

    if (this.isOnGround && !this.wasOnGround) {
      this.justLanded = true
      this.impactSpeed = Math.max(0, descentRate)
    }
    this.wasOnGround = this.isOnGround
  }

  /**
   * Clip something solid — a treetop, say. Scrubs off speed rather than
   * stopping dead, so ploughing through a canopy drags you down and slows you
   * without the helicopter ever being destroyed by scenery.
   */
  strikeObstacle(dt: number): void {
    const drag = Math.exp(-STRIKE_DRAG * dt)
    this.velocity.x *= drag
    this.velocity.z *= drag
    // Branches snatch downward; they never throw you upward.
    if (this.velocity.y > 0) this.velocity.y *= drag
    this.justStruck = true
  }

  /**
   * What damage feels like through the airframe: a shake that is always there
   * and gets worse as the machine does. Squared, so a scuff is nothing and a
   * wreck is unmistakable — a linear ramp made a lightly scratched helicopter
   * feel broken, which spent the signal long before it was needed.
   */
  private rattle(dt: number): void {
    const hurt = 1 - clamp(this.condition, 0, 1)
    if (hurt <= 0) {
      this.rattlePitch = 0
      this.rattleRoll = 0
      return
    }
    this.rattlePhase += dt
    // Two rates that do not divide into each other, so the wobble never falls
    // into a rhythm and never reads as something the pilot did.
    const depth = MAX_RATTLE * hurt * hurt
    this.rattlePitch = depth * Math.sin(this.rattlePhase * 13.7)
    this.rattleRoll = depth * Math.sin(this.rattlePhase * 9.1 + 1.7)
  }

  /**
   * Thrust and climb still available. A wreck keeps better than half of it:
   * the pilot always has enough to get home and land, which is what makes
   * "fly it home or press on" a decision rather than a sentence.
   */
  private get power(): number {
    return (WRECKED_POWER + (1 - WRECKED_POWER) * clamp(this.condition, 0, 1)) * this.enginePower
  }

  private turn(yawInput: number, dt: number): void {
    // Yaw rate eases toward the request, so a turn winds up rather than snapping.
    this.yawRate = approach(this.yawRate, -yawInput * YAW_RATE, YAW_RESPONSE, dt)
    this.heading += this.yawRate * dt
  }

  private lean(input: FlightInput, onGround: boolean, dt: number): void {
    // Clamp the two horizontal axes as one vector so pushing diagonally cannot
    // lean, and therefore accelerate, harder than pushing straight.
    this.steer.set(input.roll, input.pitch)
    if (this.steer.lengthSq() > 1) this.steer.normalize()
    if (onGround) this.steer.set(0, 0)

    this.pitch = approach(this.pitch, this.steer.y * MAX_PITCH, TILT_RESPONSE, dt)
    this.leanRoll = approach(this.leanRoll, this.steer.x * MAX_ROLL, TILT_RESPONSE, dt)

    // Banking into a turn is cosmetic and drives no thrust, but it is most of
    // what makes a turn look like a helicopter turning. It rides on top of the
    // stick-driven lean, and is kept out of it so turning never slides you.
    const turnBank = onGround ? 0 : (-this.yawRate / YAW_RATE) * TURN_BANK
    this.roll = this.leanRoll + turnBank
  }

  private applyThrust(onGround: boolean, dt: number): void {
    if (onGround) {
      // Skids grip: whatever ground speed is left bleeds off fast.
      const grip = Math.exp(-GROUND_FRICTION * dt)
      this.velocity.x *= grip
      this.velocity.z *= grip
      return
    }

    // Thrust follows the actual lean, not the raw input — that is the lag that
    // makes it feel like a machine rather than a cursor.
    const pull = THRUST_ACCEL * this.boost * this.power
    const forward = (this.pitch / MAX_PITCH) * pull
    const sideways = (this.leanRoll / MAX_ROLL) * pull

    const sinH = Math.sin(this.heading)
    const cosH = Math.cos(this.heading)
    // Nose points (-sin h, -cos h); the right side points (cos h, -sin h).
    this.thrust.set(
      -sinH * forward + cosH * sideways,
      0,
      -cosH * forward - sinH * sideways,
    )
    this.velocity.x += this.thrust.x * dt
    this.velocity.z += this.thrust.z * dt

    const drag = Math.exp(-DRAG * dt)
    this.velocity.x *= drag
    this.velocity.z *= drag
  }

  private applyCollective(collective: number, dt: number): void {
    this.velocity.y += collective * COLLECTIVE_ACCEL * this.boost * this.power * dt
    this.velocity.y *= Math.exp(-VERTICAL_DRAG * dt)
  }

  /**
   * Air that is doing something of its own: a thermal lifting the machine and
   * buffeting shoving it about. Called after the update that moved it, so the
   * rising air is felt on top of whatever the pilot asked for.
   *
   * The shove goes into the velocity, where it is felt; the rocking goes into
   * separate shake angles, where it is *seen*. Adding it to the flown attitude
   * instead was the mistake first time round — the lean easing pulled it
   * straight back out again, so rough air moved the helicopter without ever
   * looking like it.
   */
  applyAirCurrent(lift: number, buffetX: number, buffetZ: number, dt: number): void {
    this.velocity.y += lift * dt
    this.velocity.x += buffetX * dt
    this.velocity.z += buffetZ * dt

    this.shakeRoll = clamp(buffetX * SHAKE_PER_FORCE, -MAX_SHAKE, MAX_SHAKE)
    this.shakePitch = clamp(buffetZ * SHAKE_PER_FORCE, -MAX_SHAKE, MAX_SHAKE)
  }

  private integrate(dt: number): void {
    this.position.addScaledVector(this.velocity, dt)
  }

  private stayInBounds(): void {
    const p = this.position
    const v = this.velocity

    if (p.y < this.restingAltitude) {
      p.y = this.restingAltitude
      if (v.y < 0) v.y = 0
    } else if (p.y > MAX_ALTITUDE) {
      p.y = MAX_ALTITUDE
      if (v.y > 0) { v.y = 0; this.justBumped = true }
    }

    for (const axis of ['x', 'z'] as const) {
      if (p[axis] > FIELD_LIMIT) {
        p[axis] = FIELD_LIMIT
        if (v[axis] > 0) { v[axis] = 0; this.justBumped = true }
      } else if (p[axis] < -FIELD_LIMIT) {
        p[axis] = -FIELD_LIMIT
        if (v[axis] < 0) { v[axis] = 0; this.justBumped = true }
      }
    }
  }
}

/** Move `value` toward `target` with exponential ease; `rate` is per second. */
function approach(value: number, target: number, rate: number, dt: number): number {
  return target + (value - target) * Math.exp(-rate * dt)
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

const START_ALTITUDE = 8
/** How far the skids hold the hull above whatever is underneath. */
const SKID_HEIGHT = 2
const MAX_ALTITUDE = 220
/** Half the width of the playable map. */
export const FIELD_LIMIT = 420
const GROUND_TOLERANCE = 0.05

/** Full-stick lean, radians. About 22° nose-down and 24° of bank. */
const MAX_PITCH = 0.38
const MAX_ROLL = 0.42
/** Extra bank added while turning, at full yaw rate. */
const TURN_BANK = 0.3
/** How quickly the lean follows the stick, per second. */
const TILT_RESPONSE = 6

/**
 * Horizontal acceleration at full lean, and the drag that caps top speed. Both
 * thrust figures are half again what they were (51 and 39): the map is big and
 * the pilot was spending too much of the round just getting there.
 */
const THRUST_ACCEL = 76.5
const DRAG = 1.1
/** Top speed works out to THRUST_ACCEL / DRAG, about 69 units per second. */
export const TOP_SPEED = THRUST_ACCEL / DRAG

const YAW_RATE = 1.9
const YAW_RESPONSE = 8

/** Climb and descent: about 27 units per second flat out. */
const COLLECTIVE_ACCEL = 58.5
const VERTICAL_DRAG = 2.2
const VERTICAL_TERMINAL_SPEED = COLLECTIVE_ACCEL / VERTICAL_DRAG

const GROUND_FRICTION = 10
/** How hard foliage drags: heavy enough to feel, light enough to fly out of. */
const STRIKE_DRAG = 5.5
/** Radians of rocking per unit of buffeting force, and the limit of it. */
const SHAKE_PER_FORCE = 0.011
/** About twenty-five degrees: unmistakable, still short of a barrel roll. */
const MAX_SHAKE = 0.44
/** How fast the rocking dies away once the air smooths out. */
const SHAKE_SETTLES = 3.5
/** How far a completely wrecked machine judders, radians — about seven degrees. */
const MAX_RATTLE = 0.12
/**
 * Thrust and climb left in a wreck. High enough that a ruined helicopter can
 * always still be flown home and landed: the damage is a worsening handicap,
 * never a loss of control.
 */
const WRECKED_POWER = 0.55
