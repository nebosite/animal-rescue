import { clampAxis, noInput, type FlightInput } from './FlightInput'

/** The slice of the browser Gamepad API this class actually reads. */
export interface GamepadLike {
  readonly connected: boolean
  readonly axes: ReadonlyArray<number>
  readonly buttons: ReadonlyArray<{ readonly value: number; readonly pressed: boolean }>
}

/** Where the pads come from — the browser by default, a fake in tests. */
export type GamepadSource = () => ReadonlyArray<GamepadLike | null>

/**
 * Reads the first connected controller as flight axes, using the W3C
 * "standard" layout that Xbox and PlayStation pads report in every browser:
 *
 *   left stick    pitch (up is forward) and roll
 *   right stick   yaw, with the bumpers as an alternative
 *   triggers      collective — right climbs, left descends
 *
 * Polled once per frame; the Gamepad API has no events for stick movement.
 */
export class GamepadInput {
  readonly input: FlightInput = noInput()
  private active = false

  constructor(private readonly source: GamepadSource = browserGamepads) {}

  /** True while a controller is plugged in and reporting. */
  get connected(): boolean {
    return this.active
  }

  poll(): void {
    const pad = this.source().find((candidate) => candidate?.connected) ?? null
    this.active = pad !== null
    if (!pad) {
      Object.assign(this.input, noInput())
      return
    }

    const leftX = deadZone(axis(pad, 0))
    const forward = deadZone(-axis(pad, 1)) // sticks report up as negative
    const rightX = deadZone(axis(pad, 2))

    this.input.pitch = forward
    this.input.roll = leftX
    this.input.yaw = clampAxis(rightX + button(pad, RIGHT_BUMPER) - button(pad, LEFT_BUMPER))
    this.input.collective = clampAxis(button(pad, RIGHT_TRIGGER) - button(pad, LEFT_TRIGGER))
  }
}

function axis(pad: GamepadLike, index: number): number {
  return pad.axes[index] ?? 0
}

function button(pad: GamepadLike, index: number): number {
  return pad.buttons[index]?.value ?? 0
}

/** Ignore stick noise near centre, and rescale so full travel still reaches 1. */
function deadZone(value: number): number {
  const magnitude = Math.abs(value)
  if (magnitude < DEAD_ZONE) return 0
  return Math.sign(value) * Math.min(1, (magnitude - DEAD_ZONE) / (1 - DEAD_ZONE))
}

function browserGamepads(): ReadonlyArray<GamepadLike | null> {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return []
  return Array.from(navigator.getGamepads())
}

const DEAD_ZONE = 0.15
const LEFT_BUMPER = 4
const RIGHT_BUMPER = 5
const LEFT_TRIGGER = 6
const RIGHT_TRIGGER = 7
