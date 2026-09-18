import { describe, expect, it } from 'vitest'
import { Controls } from './Controls'
import { GamepadInput, type GamepadLike } from './GamepadInput'

const pad = (axes: number[]): GamepadLike => ({
  connected: true,
  axes,
  buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })),
})

describe('Controls', () => {
  it('passes keyboard input through when no controller is present', () => {
    const controls = new Controls(new GamepadInput(() => []))
    controls.keyboard.press('ArrowUp', true)
    expect(controls.poll().pitch).toBe(1)
    expect(controls.usingGamepad).toBe(false)
    expect(controls.controllerName).toBe('')
  })

  it('merges the collective from the keyboard with the controller triggers', () => {
    const controls = new Controls(new GamepadInput(() => []))
    controls.keyboard.press('KeyW', true)
    expect(controls.poll().collective).toBe(1)
    controls.keyboard.press('KeyS', true)
    expect(controls.poll().collective).toBe(0)
  })

  it('merges keyboard and controller, clamped to full deflection', () => {
    // Right stick forward on the pad, up arrow on the keyboard: still just 1.
    const controls = new Controls(new GamepadInput(() => [pad([0, 0, 0, -1])]))
    controls.keyboard.press('ArrowUp', true)
    const input = controls.poll()
    expect(input.pitch).toBe(1)
    expect(controls.usingGamepad).toBe(true)
  })

  it('lets one device cancel the other', () => {
    const controls = new Controls(new GamepadInput(() => [pad([0, 0, 0, 1])])) // right stick pulled back
    controls.keyboard.press('ArrowUp', true)
    expect(controls.poll().pitch).toBe(0)
  })
})
