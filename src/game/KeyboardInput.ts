import { clampAxis, noInput, type FlightInput } from './FlightInput'

/**
 * Turns held keys into flight axes. Thin on purpose: it owns the key map and
 * nothing about how the helicopter responds.
 *
 * `press` is the whole behavior; the DOM listeners only forward to it, so the
 * mapping is testable without a browser.
 */
export class KeyboardInput {
  readonly input: FlightInput = noInput()
  private readonly held = new Set<string>()

  attach(target: Window): void {
    target.addEventListener('keydown', (event) => {
      // Stop Space and the arrows from scrolling the page while flying.
      if (this.press(event.code, true)) event.preventDefault()
    })
    target.addEventListener('keyup', (event) => this.press(event.code, false))
    // A key released while the tab is unfocused is never delivered, which
    // would otherwise leave the helicopter flying off on its own.
    target.addEventListener('blur', () => this.releaseAll())
  }

  /** Record a key going down or up. Returns true if the key means anything. */
  press(code: string, held: boolean): boolean {
    if (!KEY_AXES.has(code)) return false
    if (held) this.held.add(code)
    else this.held.delete(code)
    this.recompute()
    return true
  }

  releaseAll(): void {
    this.held.clear()
    this.recompute()
  }

  private recompute(): void {
    const sum = noInput()
    for (const code of this.held) {
      const [axis, direction] = KEY_AXES.get(code)!
      sum[axis] += direction
    }
    this.input.pitch = clampAxis(sum.pitch)
    this.input.roll = clampAxis(sum.roll)
    this.input.yaw = clampAxis(sum.yaw)
    this.input.collective = clampAxis(sum.collective)
  }
}

/**
 * Laid out like a real helicopter's three controls: the arrows (and W/S) are
 * the cyclic — tip the machine and it goes that way; Q/E are the anti-torque
 * pedals that swing the nose; A/Z (or CapsLock/Shift) are the collective, two
 * vertically stacked keys under the left hand for up and down.
 */
const KEY_AXES = new Map<string, [keyof FlightInput, 1 | -1]>([
  ['KeyW', ['pitch', 1]], ['ArrowUp', ['pitch', 1]],
  ['KeyS', ['pitch', -1]], ['ArrowDown', ['pitch', -1]],
  ['ArrowLeft', ['roll', -1]],
  ['ArrowRight', ['roll', 1]],
  ['KeyQ', ['yaw', -1]],
  ['KeyE', ['yaw', 1]],
  ['KeyA', ['collective', 1]], ['CapsLock', ['collective', 1]],
  ['KeyZ', ['collective', -1]], ['ShiftLeft', ['collective', -1]], ['ShiftRight', ['collective', -1]],
])
