import { describe, expect, it } from 'vitest'
import { GamepadInput, type GamepadLike } from './GamepadInput'

function fakePad(overrides: { axes?: number[]; buttons?: Record<number, number>; connected?: boolean; id?: string } = {}): GamepadLike {
  const buttons = Array.from({ length: 17 }, (_, i) => {
    const value = overrides.buttons?.[i] ?? 0
    return { value, pressed: value > 0.5 }
  })
  return {
    id: overrides.id ?? 'Test Pad',
    connected: overrides.connected ?? true,
    axes: overrides.axes ?? [0, 0, 0, 0],
    buttons,
  }
}

const withPad = (pad: GamepadLike | null) => {
  const input = new GamepadInput(() => [null, pad])
  input.poll()
  return input
}

describe('GamepadInput', () => {
  it('reports nothing and no connection when no pad is present', () => {
    const input = withPad(null)
    expect(input.connected).toBe(false)
    expect(input.name).toBe('')
    expect(input.input).toEqual({ pitch: 0, roll: 0, yaw: 0, collective: 0 })
  })

  it('ignores a pad that reports itself disconnected', () => {
    expect(withPad(fakePad({ connected: false, axes: [1, 1, 1, 1] })).connected).toBe(false)
  })

  it('names the controller once it is live', () => {
    expect(withPad(fakePad({ id: 'Xbox Wireless Controller' })).name).toBe('Xbox Wireless Controller')
  })

  it('left stick is the collective and the pedals: up climbs, right turns right', () => {
    const input = withPad(fakePad({ axes: [1, -1, 0, 0] }))
    expect(input.connected).toBe(true)
    expect(input.input.collective).toBeCloseTo(1)
    expect(input.input.yaw).toBeCloseTo(1)
    expect(input.input.pitch).toBe(0)
    expect(input.input.roll).toBe(0)
  })

  it('right stick is the cyclic: up is nose forward, right is a slide right', () => {
    const input = withPad(fakePad({ axes: [0, 0, 1, -1] }))
    expect(input.input.pitch).toBeCloseTo(1)
    expect(input.input.roll).toBeCloseTo(1)
    expect(input.input.collective).toBe(0)
    expect(input.input.yaw).toBe(0)
  })

  it('still takes the triggers as collective and the bumpers as yaw', () => {
    expect(withPad(fakePad({ buttons: { 7: 1 } })).input.collective).toBe(1)
    expect(withPad(fakePad({ buttons: { 6: 1 } })).input.collective).toBe(-1)
    expect(withPad(fakePad({ buttons: { 5: 1 } })).input.yaw).toBe(1)
    expect(withPad(fakePad({ buttons: { 4: 1 } })).input.yaw).toBe(-1)
  })

  it('treats a trigger that only reports pressed, not a value, as fully pulled', () => {
    const pad = fakePad()
    ;(pad.buttons as Array<{ value: number; pressed: boolean }>)[7] = { value: 0, pressed: true }
    expect(withPad(pad).input.collective).toBe(1)
  })

  it('sums stick and trigger, clamped to full deflection', () => {
    expect(withPad(fakePad({ axes: [0, -1, 0, 0], buttons: { 7: 1 } })).input.collective).toBe(1)
    expect(withPad(fakePad({ axes: [0, -1, 0, 0], buttons: { 6: 1 } })).input.collective).toBeCloseTo(0)
  })

  it('applies a dead zone so a resting stick reads as exactly zero', () => {
    const input = withPad(fakePad({ axes: [0.1, -0.1, 0.05, -0.08] }))
    expect(input.input).toEqual({ pitch: 0, roll: 0, yaw: 0, collective: 0 })
  })

  it('rescales past the dead zone so full travel still reaches full deflection', () => {
    const input = withPad(fakePad({ axes: [0, 0, 0.5, 0] }))
    expect(input.input.roll).toBeGreaterThan(0.3)
    expect(input.input.roll).toBeLessThan(0.5)
    expect(withPad(fakePad({ axes: [0, 0, 1, 0] })).input.roll).toBe(1)
  })

  it('clears its axes when the pad goes away', () => {
    let pad: GamepadLike | null = fakePad({ axes: [0, 0, 1, 0] })
    const input = new GamepadInput(() => [pad])
    input.poll()
    expect(input.input.roll).toBe(1)
    pad = null
    input.poll()
    expect(input.input.roll).toBe(0)
    expect(input.connected).toBe(false)
  })
})
