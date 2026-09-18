import { combineInputs, noInput, type FlightInput } from './FlightInput'
import { GamepadInput } from './GamepadInput'
import { KeyboardInput } from './KeyboardInput'

/**
 * Every input device merged into one FlightInput. Keyboard and controller are
 * both live at once, so a player can pick up either without choosing.
 */
export class Controls {
  readonly keyboard = new KeyboardInput()
  readonly gamepad: GamepadInput
  private readonly merged: FlightInput = noInput()

  constructor(gamepad: GamepadInput = new GamepadInput()) {
    this.gamepad = gamepad
  }

  attach(target: Window): void {
    this.keyboard.attach(target)
  }

  /** True while a controller is plugged in — used to switch the on-screen hints. */
  get usingGamepad(): boolean {
    return this.gamepad.connected
  }

  /** What the controller calls itself, or empty. */
  get controllerName(): string {
    return this.gamepad.name
  }

  /** Read every device once and return the combined request. Call once per frame. */
  poll(): FlightInput {
    this.gamepad.poll()
    return combineInputs(this.keyboard.input, this.gamepad.input, this.merged)
  }
}
