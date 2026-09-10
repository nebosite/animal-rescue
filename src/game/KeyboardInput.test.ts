import { describe, expect, it } from 'vitest'
import { KeyboardInput } from './KeyboardInput'

describe('KeyboardInput', () => {
  it('maps W/S to pitch, A/D to yaw, Q/E to roll, Space/Shift to collective', () => {
    const keys = new KeyboardInput()
    keys.press('KeyW', true)
    keys.press('KeyD', true)
    keys.press('KeyE', true)
    keys.press('Space', true)
    expect(keys.input).toEqual({ pitch: 1, yaw: 1, roll: 1, collective: 1 })

    keys.releaseAll()
    keys.press('KeyS', true)
    keys.press('KeyA', true)
    keys.press('KeyQ', true)
    keys.press('ShiftLeft', true)
    expect(keys.input).toEqual({ pitch: -1, yaw: -1, roll: -1, collective: -1 })
  })

  it('treats the arrow keys as aliases for W A S D', () => {
    const keys = new KeyboardInput()
    keys.press('ArrowUp', true)
    keys.press('ArrowRight', true)
    expect(keys.input.pitch).toBe(1)
    expect(keys.input.yaw).toBe(1)
  })

  it('cancels out opposing keys held together', () => {
    const keys = new KeyboardInput()
    keys.press('KeyW', true)
    keys.press('KeyS', true)
    expect(keys.input.pitch).toBe(0)
  })

  it('never exceeds full deflection when an alias is held with its key', () => {
    const keys = new KeyboardInput()
    keys.press('KeyW', true)
    keys.press('ArrowUp', true)
    expect(keys.input.pitch).toBe(1)
  })

  it('releases an axis when its key comes up', () => {
    const keys = new KeyboardInput()
    keys.press('KeyW', true)
    keys.press('KeyW', false)
    expect(keys.input.pitch).toBe(0)
  })

  it('ignores keys it does not use, and says so', () => {
    const keys = new KeyboardInput()
    expect(keys.press('KeyX', true)).toBe(false)
    expect(keys.press('KeyW', true)).toBe(true)
  })

  it('drops everything on releaseAll, as on window blur', () => {
    const keys = new KeyboardInput()
    keys.press('KeyW', true)
    keys.press('Space', true)
    keys.releaseAll()
    expect(keys.input).toEqual({ pitch: 0, roll: 0, yaw: 0, collective: 0 })
  })
})
