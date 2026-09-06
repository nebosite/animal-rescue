/** Which directions the pilot is asking for right now. */
export interface FlightInput {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
  up: boolean
  down: boolean
}

export function noInput(): FlightInput {
  return { forward: false, back: false, left: false, right: false, up: false, down: false }
}
