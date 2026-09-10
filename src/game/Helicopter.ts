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

  /** True on the one update in which the skids touched down. */
  justLanded = false
  /** True on any update in which the helicopter was pushed back by a limit. */
  justBumped = false

  private yawRate = 0
  /** The stick-driven part of the roll, before the cosmetic turn-bank is added. */
  private leanRoll = 0
  private wasOnGround = false
  private readonly steer = new THREE.Vector2()
  private readonly thrust = new THREE.Vector3()

  /** True when the helicopter is resting on the ground rather than flying. */
  get isOnGround(): boolean {
    return this.position.y <= MIN_ALTITUDE + GROUND_TOLERANCE
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

  update(input: FlightInput, dt: number): void {
    this.justLanded = false
    this.justBumped = false
    const onGround = this.isOnGround

    this.turn(input.yaw, dt)
    this.lean(input, onGround, dt)
    this.applyThrust(onGround, dt)
    this.applyCollective(input.collective, dt)
    this.integrate(dt)
    this.stayInBounds()

    if (this.isOnGround && !this.wasOnGround) this.justLanded = true
    this.wasOnGround = this.isOnGround
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
    const forward = (this.pitch / MAX_PITCH) * THRUST_ACCEL
    const sideways = (this.leanRoll / MAX_ROLL) * THRUST_ACCEL

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
    this.velocity.y += collective * COLLECTIVE_ACCEL * dt
    this.velocity.y *= Math.exp(-VERTICAL_DRAG * dt)
  }

  private integrate(dt: number): void {
    this.position.addScaledVector(this.velocity, dt)
  }

  private stayInBounds(): void {
    const p = this.position
    const v = this.velocity

    if (p.y < MIN_ALTITUDE) {
      p.y = MIN_ALTITUDE
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

const START_ALTITUDE = 8
const MIN_ALTITUDE = 2
const MAX_ALTITUDE = 90
const FIELD_LIMIT = 140
const GROUND_TOLERANCE = 0.05

/** Full-stick lean, radians. About 22° nose-down and 24° of bank. */
const MAX_PITCH = 0.38
const MAX_ROLL = 0.42
/** Extra bank added while turning, at full yaw rate. */
const TURN_BANK = 0.3
/** How quickly the lean follows the stick, per second. */
const TILT_RESPONSE = 6

/** Horizontal acceleration at full lean, and the drag that caps top speed. */
const THRUST_ACCEL = 34
const DRAG = 1.1
/** Top speed works out to THRUST_ACCEL / DRAG, about 31 units per second. */

const YAW_RATE = 1.9
const YAW_RESPONSE = 8

const COLLECTIVE_ACCEL = 26
const VERTICAL_DRAG = 2.2
const VERTICAL_TERMINAL_SPEED = COLLECTIVE_ACCEL / VERTICAL_DRAG

const GROUND_FRICTION = 10
