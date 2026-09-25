import type { GamepadLike, GamepadSource } from './GamepadInput'

/** What the second player is asking for. */
export interface CopilotCommand {
  winch: boolean
  water: boolean
}

/**
 * The second seat's controls.
 *
 * A second gamepad is the way this is meant to be played — the pilot needs
 * both hands, so there is no comfortable half of a keyboard left. Space and F
 * are there so the seat can be taken without hunting for a second controller.
 *
 * The seat counts as taken the moment anyone touches it, and stays taken; a
 * player who puts the winch down and waits has not handed the job back.
 */
export class CopilotInput {
  readonly command: CopilotCommand = { winch: false, water: false }
  private readonly held = new Set<string>()
  private everUsed = false

  constructor(private readonly pads: GamepadSource = browserGamepads) {}

  /** True once a person has taken the seat. */
  get taken(): boolean {
    return this.everUsed
  }

  attach(target: Window): void {
    target.addEventListener('keydown', (event) => {
      if (this.press(event.code, true)) event.preventDefault()
    })
    target.addEventListener('keyup', (event) => this.press(event.code, false))
    target.addEventListener('blur', () => this.held.clear())
  }

  /** Record a key going down or up. Returns true if it is one of ours. */
  press(code: string, held: boolean): boolean {
    if (code !== WINCH_KEY && code !== WATER_KEY) return false
    if (held) { this.held.add(code); this.everUsed = true } else this.held.delete(code)
    return true
  }

  /** Read the keys and the second pad. Call once a frame. */
  poll(): CopilotCommand {
    const pad = this.secondPad()
    const padWinch = pad ? button(pad, WINCH_BUTTON) > 0.4 || button(pad, WINCH_TRIGGER) > 0.4 : false
    const padWater = pad ? button(pad, WATER_BUTTON) > 0.4 || button(pad, WATER_TRIGGER) > 0.4 : false
    if (pad) this.everUsed = true

    this.command.winch = this.held.has(WINCH_KEY) || padWinch
    this.command.water = this.held.has(WATER_KEY) || padWater
    return this.command
  }

  /** The second controller, if there is one. The first belongs to the pilot. */
  private secondPad(): GamepadLike | null {
    const connected = this.pads().filter((pad): pad is GamepadLike => !!pad?.connected)
    return connected[1] ?? null
  }
}

function button(pad: GamepadLike, index: number): number {
  const entry = pad.buttons[index]
  if (!entry) return 0
  return entry.value > 0 ? entry.value : entry.pressed ? 1 : 0
}

function browserGamepads(): ReadonlyArray<GamepadLike | null> {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return []
  return Array.from(navigator.getGamepads())
}

export const WINCH_KEY = 'Space'
export const WATER_KEY = 'KeyF'
/** Standard layout: A and B, or the two triggers. */
const WINCH_BUTTON = 0
const WATER_BUTTON = 1
const WINCH_TRIGGER = 7
const WATER_TRIGGER = 6
