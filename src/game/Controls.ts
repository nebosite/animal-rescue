import { noInput, type FlightInput } from './FlightInput'

/**
 * Translates held keys into flight input. Thin on purpose: it owns no flight
 * behavior, only the keyboard mapping.
 */
export class Controls {
  readonly input: FlightInput = noInput()

  private readonly onKeyDown = (event: KeyboardEvent) => this.set(event.code, true)
  private readonly onKeyUp = (event: KeyboardEvent) => this.set(event.code, false)

  attach(target: Window): void {
    target.addEventListener('keydown', this.onKeyDown)
    target.addEventListener('keyup', this.onKeyUp)
    // Releasing a key while the tab is unfocused is never delivered, which would
    // otherwise leave the helicopter flying off on its own.
    target.addEventListener('blur', () => Object.assign(this.input, noInput()))
  }

  private set(code: string, held: boolean): void {
    const direction = KEY_MAP[code]
    if (direction) this.input[direction] = held
  }
}

const KEY_MAP: Record<string, keyof FlightInput | undefined> = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'up',
  ShiftLeft: 'down', ShiftRight: 'down',
}
