import * as THREE from 'three'
import type { FlightInput } from './FlightInput'

/**
 * Where the helicopter is and how it moves.
 *
 * Deliberately free of the renderer: this is the flight model, and it can be
 * flown in a plain Node test with no browser and no GL context. The mesh reads
 * this position; it never decides it.
 */
export class Helicopter {
  readonly position = new THREE.Vector3(0, START_ALTITUDE, 0)

  update(input: FlightInput, dt: number): void {
    const right = axis(input.right, input.left)
    const back = axis(input.back, input.forward)
    const lift = axis(input.up, input.down)

    // Normalize the horizontal pair so flying diagonally isn't faster than
    // flying straight — otherwise the corners of the keyboard are the fast path.
    const horizontal = new THREE.Vector2(right, back)
    if (horizontal.lengthSq() > 1) horizontal.normalize()

    this.position.x += horizontal.x * HORIZONTAL_SPEED * dt
    this.position.z += horizontal.y * HORIZONTAL_SPEED * dt
    this.position.y += lift * VERTICAL_SPEED * dt

    this.position.x = clamp(this.position.x, -FIELD_LIMIT, FIELD_LIMIT)
    this.position.z = clamp(this.position.z, -FIELD_LIMIT, FIELD_LIMIT)
    this.position.y = clamp(this.position.y, MIN_ALTITUDE, MAX_ALTITUDE)
  }
}

function axis(positive: boolean, negative: boolean): number {
  return (positive ? 1 : 0) - (negative ? 1 : 0)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

const START_ALTITUDE = 8
const HORIZONTAL_SPEED = 24
const VERTICAL_SPEED = 14
const MIN_ALTITUDE = 2
const MAX_ALTITUDE = 90
const FIELD_LIMIT = 140
