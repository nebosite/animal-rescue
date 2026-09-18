import { clampAxis, noInput, type FlightInput } from './FlightInput'

/** The slice of the browser Gamepad API this class actually reads. */
export interface GamepadLike {
  readonly id?: string
  readonly connected: boolean
  readonly axes: ReadonlyArray<number>
  readonly buttons: ReadonlyArray<{ readonly value: number; readonly pressed: boolean }>
}

/** Where the pads come from — the browser by default, a fake in tests. */
export type GamepadSource = () => ReadonlyArray<GamepadLike | null>

/**
 * Reads the first connected controller as flight axes, using the W3C
 * "standard" layout that Xbox and PlayStation pads report in every browser,
 * as two sticks — the same scheme as the keyboard:
 *
 *   left stick     collective up and down, yaw left and right
 *   right stick    the cyclic: pitch forward and back, roll left and right
 *   triggers       collective too — right climbs, left descends
 *   bumpers        yaw too
 *
 * Polled once per frame; the Gamepad API has no events for stick movement.
 * Browsers only list a pad once a button on it has been pressed, so a pad
 * that "does not work" usually just has not been touched yet.
 */
export class GamepadInput {
  readonly input: FlightInput = noInput()
  private active: GamepadLike | null = null

  constructor(private readonly source: GamepadSource = browserGamepads) {}

  /** True while a controller is plugged in and reporting. */
  get connected(): boolean {
    return this.active !== null
  }

  /** What the browser calls the controller, for telling the player it is live. */
  get name(): string {
    return this.active?.id ?? ''
  }

  poll(): void {
    const pad = this.source().find((candidate) => candidate?.connected) ?? null
    this.active = pad
    if (!pad) {
      Object.assign(this.input, noInput())
      return
    }

    const leftX = deadZone(axis(pad, 0))
    const leftUp = deadZone(-axis(pad, 1)) // sticks report up as negative
    const rightX = deadZone(axis(pad, 2))
    const rightUp = deadZone(-axis(pad, 3))

    this.input.collective = clampAxis(leftUp + trigger(pad, RIGHT_TRIGGER) - trigger(pad, LEFT_TRIGGER))
    this.input.yaw = clampAxis(leftX + button(pad, RIGHT_BUMPER) - button(pad, LEFT_BUMPER))
    this.input.pitch = rightUp
    this.input.roll = rightX
  }
}

function axis(pad: GamepadLike, index: number): number {
  return pad.axes[index] ?? 0
}

function button(pad: GamepadLike, index: number): number {
  return pad.buttons[index]?.value ?? 0
}

/** Triggers report 0..1 as button values on standard pads; treat a bare press as full. */
function trigger(pad: GamepadLike, index: number): number {
  const entry = pad.buttons[index]
  if (!entry) return 0
  return entry.value > 0 ? entry.value : entry.pressed ? 1 : 0
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
