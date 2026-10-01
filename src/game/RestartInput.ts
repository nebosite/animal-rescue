import type { GamepadLike, GamepadSource } from './GamepadInput'

/**
 * "Go again": the R key, or Start — or A — on any controller that is plugged in.
 *
 * A controller-only player had no way to begin another shift at all: the
 * end-of-shift card said "press R" and the pad they were holding did nothing,
 * which is a dead end rather than a difficulty.
 *
 * It reports a rising edge rather than a held state, so holding the button down
 * restarts once instead of restarting on every frame — and so a button still
 * held from the last shift cannot immediately end the next one. Any pad counts,
 * not just the pilot's: either seat should be able to call for another go.
 */
export class RestartInput {
  private keyHeld = false
  private wasAsking = false

  constructor(private readonly pads: GamepadSource = browserGamepads) {}

  attach(target: Window): void {
    target.addEventListener('keydown', (event) => this.press(event.code, true))
    target.addEventListener('keyup', (event) => this.press(event.code, false))
    target.addEventListener('blur', () => { this.keyHeld = false })
  }

  /** Record a key going down or up. Returns true if it is ours. */
  press(code: string, held: boolean): boolean {
    if (code !== RESTART_KEY) return false
    this.keyHeld = held
    return true
  }

  /** True on the one poll in which the player asked for another shift. */
  poll(): boolean {
    const asking = this.keyHeld || this.padAsking()
    const edge = asking && !this.wasAsking
    this.wasAsking = asking
    return edge
  }

  private padAsking(): boolean {
    for (const pad of this.pads()) {
      if (!pad?.connected) continue
      if (button(pad, START) > 0.4 || button(pad, FACE_A) > 0.4) return true
    }
    return false
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

export const RESTART_KEY = 'KeyR'
/** Standard layout: Start, or the A button for anyone who has not found Start. */
const START = 9
const FACE_A = 0
