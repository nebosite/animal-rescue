import { describe, expect, it } from 'vitest'
import { Shift } from './Shift'

describe('Shift', () => {
  it('counts down from its length', () => {
    const shift = new Shift(300)
    expect(shift.remaining).toBe(300)
    shift.advance(12.5)
    expect(shift.remaining).toBeCloseTo(287.5)
    expect(shift.over).toBe(false)
  })

  it('ends exactly once, and reports the frame it happened', () => {
    const shift = new Shift(10)
    let endings = 0
    for (let i = 0; i < 1200; i++) if (shift.advance(1 / 60)) endings++
    expect(endings).toBe(1)
    expect(shift.over).toBe(true)
    expect(shift.remaining).toBe(0)
  })

  it('shows a clock a player can read', () => {
    const shift = new Shift(300)
    expect(shift.clock).toBe('5:00')
    shift.advance(53)
    expect(shift.clock).toBe('4:07')
    shift.advance(240)
    expect(shift.clock).toBe('0:07')
  })

  it('knows when it is closing, so the HUD can count out loud', () => {
    const shift = new Shift(100)
    expect(shift.closing).toBe(false)
    shift.advance(75)
    expect(shift.closing).toBe(true)
    shift.advance(30)
    expect(shift.closing).toBe(false)
  })
})
