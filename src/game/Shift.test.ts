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

describe('Shift.end', () => {
  it('finishes a shift that still had time on it', () => {
    // Bringing a write-off home ends the shift early. Showing the card without
    // this left the clock running behind it, the controls live, and no way to
    // ask for another shift — all of which are gated on the shift being over.
    const shift = new Shift(300)
    shift.advance(60)
    expect(shift.over).toBe(false)

    shift.end()
    expect(shift.over).toBe(true)
    expect(shift.remaining).toBe(0)
    // And the clock cannot then end it a second time.
    expect(shift.advance(1)).toBe(false)
  })

  it('does not mind being told twice', () => {
    const shift = new Shift(10)
    shift.advance(10)
    shift.end()
    expect(shift.over).toBe(true)
  })
})

describe('Shift.restart', () => {
  it('gives back a whole shift, from a finished one', () => {
    const shift = new Shift(10)
    for (let i = 0; i < 200; i++) shift.advance(0.1)
    expect(shift.over).toBe(true)

    shift.restart()
    expect(shift.over).toBe(false)
    expect(shift.remaining).toBe(10)
    // And it can end again: the one-shot flag has to be cleared, not just the clock.
    expect(shift.advance(10)).toBe(true)
  })

  it('stops the clock blinking, which it was doing when time ran out', () => {
    const shift = new Shift()
    shift.advance(shift.seconds)
    shift.restart()
    expect(shift.closing).toBe(false)
    expect(shift.clock).toBe('5:00')
  })
})
