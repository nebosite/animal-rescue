import { describe, expect, it } from 'vitest'
import { KeyboardInput } from './KeyboardInput'

describe('KeyboardInput', () => {
  it('is two sticks: W/S collective, A/D yaw on the left; arrows as the cyclic on the right', () => {
    const keys = new KeyboardInput()
    keys.press('KeyW', true)
    keys.press('KeyD', true)
    keys.press('ArrowUp', true)
    keys.press('ArrowRight', true)
    expect(keys.input).toEqual({ collective: 1, yaw: 1, pitch: 1, roll: 1 })

    keys.releaseAll()
    keys.press('KeyS', true)
    keys.press('KeyA', true)
    keys.press('ArrowDown', true)
    keys.press('ArrowLeft', true)
    expect(keys.input).toEqual({ collective: -1, yaw: -1, pitch: -1, roll: -1 })
  })

  it('cancels out opposing keys held together', () => {
    const keys = new KeyboardInput()
    keys.press('KeyW', true)
    keys.press('KeyS', true)
    expect(keys.input.collective).toBe(0)
    keys.press('ArrowLeft', true)
    keys.press('ArrowRight', true)
    expect(keys.input.roll).toBe(0)
  })

  it('releases an axis when its key comes up', () => {
    const keys = new KeyboardInput()
    keys.press('KeyW', true)
    keys.press('KeyW', false)
    expect(keys.input.collective).toBe(0)
  })

  it('ignores keys it does not use, and says so', () => {
    const keys = new KeyboardInput()
    expect(keys.press('KeyX', true)).toBe(false)
    expect(keys.press('KeyW', true)).toBe(true)
  })

  it('no longer flies on the old bindings: Q, E, Z, Space, Shift, CapsLock', () => {
    const keys = new KeyboardInput()
    for (const code of ['KeyQ', 'KeyE', 'KeyZ', 'Space', 'ShiftLeft', 'CapsLock']) {
      expect(keys.press(code, true), code).toBe(false)
    }
    expect(keys.input).toEqual({ pitch: 0, roll: 0, yaw: 0, collective: 0 })
  })

  it('drops everything on releaseAll, as on window blur', () => {
    const keys = new KeyboardInput()
    keys.press('KeyW', true)
    keys.press('ArrowUp', true)
    keys.releaseAll()
    expect(keys.input).toEqual({ pitch: 0, roll: 0, yaw: 0, collective: 0 })
  })
})
