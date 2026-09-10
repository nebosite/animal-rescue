/**
 * What the pilot is asking for, as four analog axes in the range -1..1.
 *
 * Keyboard and gamepad both produce this shape, so the flight model never
 * needs to know which one is in the pilot's hands.
 *
 *  pitch       +1 nose down, fly forward     -1 nose up, fly backward
 *  roll        +1 bank right, slide right    -1 bank left, slide left
 *  yaw         +1 turn right                 -1 turn left
 *  collective  +1 climb                      -1 descend
 */
export interface FlightInput {
  pitch: number
  roll: number
  yaw: number
  collective: number
}

export function noInput(): FlightInput {
  return { pitch: 0, roll: 0, yaw: 0, collective: 0 }
}

/** Add two inputs axis by axis, keeping every axis inside -1..1. */
export function combineInputs(a: FlightInput, b: FlightInput, into: FlightInput): FlightInput {
  into.pitch = clampAxis(a.pitch + b.pitch)
  into.roll = clampAxis(a.roll + b.roll)
  into.yaw = clampAxis(a.yaw + b.yaw)
  into.collective = clampAxis(a.collective + b.collective)
  return into
}

export function clampAxis(value: number): number {
  return Math.min(1, Math.max(-1, value))
}
