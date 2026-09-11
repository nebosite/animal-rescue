import { describe, expect, it } from 'vitest'
import { KeyboardInput } from './KeyboardInput'

describe('KeyboardInput', () => {
  it('maps W/S to pitch, Q/E to yaw, arrows to the cyclic, A/Z to collective', () => {
    const keys = new KeyboardInput()
    keys.press('KeyW', true)
    keys.press('KeyE', true)
    keys.press('ArrowRight', true)
    keys.press('KeyA', true)
    expect(keys.input).toEqual({ pitch: 1, yaw: 1, roll: 1, collective: 1 })

    keys.releaseAll()
    keys.press('KeyS', true)
    keys.press('KeyQ', true)
    keys.press('ArrowLeft', true)
    keys.press('KeyZ', true)
    expect(keys.input).toEqual({ pitch: -1, yaw: -1, roll: -1, collective: -1 })
  })

  it('accepts CapsLock and Shift as the other collective pair', () => {
    const up = new KeyboardInput()
    up.press('CapsLock', true)
    expect(up.input.collective).toBe(1)

    const down = new KeyboardInput()
    down.press('ShiftLeft', true)
    expect(down.input.collective).toBe(-1)
  })

  it('treats the up and down arrows as aliases for W and S', () => {
    const keys = new KeyboardInput()
    keys.press('ArrowUp', true)
    expect(keys.input.pitch).toBe(1)
    keys.releaseAll()
    keys.press('ArrowDown', true)
    expect(keys.input.pitch).toBe(-1)
  })

  it('no longer flies on the old Space and D bindings', () => {
    const keys = new KeyboardInput()
    expect(keys.press('Space', true)).toBe(false)
    expect(keys.press('KeyD', true)).toBe(false)
    expect(keys.input).toEqual({ pitch: 0, roll: 0, yaw: 0, collective: 0 })
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

    const lift = new KeyboardInput()
    lift.press('KeyA', true)
    lift.press('CapsLock', true)
    expect(lift.input.collective).toBe(1)
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
