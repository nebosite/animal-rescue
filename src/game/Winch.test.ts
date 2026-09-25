import { describe, expect, it } from 'vitest'
import { MAX_LENGTH, Winch } from './Winch'

/** Hold the lower key (or not) for a while. */
function run(winch: Winch, lowering: boolean, seconds: number): Winch {
  for (let i = 0; i < seconds * 60; i++) winch.update(lowering, 1 / 60)
  return winch
}

describe('Winch', () => {
  it('starts stowed', () => {
    const winch = new Winch()
    expect(winch.isStowed).toBe(true)
    expect(winch.length).toBe(0)
    expect(winch.extended).toBe(0)
  })

  it('pays out while held and winds back in when released', () => {
    const winch = run(new Winch(), true, 1)
    expect(winch.length).toBeGreaterThan(10)
    expect(winch.paying).toBe(true)

    const out = winch.length
    run(winch, false, 0.3)
    expect(winch.length).toBeLessThan(out)
    expect(winch.paying).toBe(false)
  })

  it('winds in faster than it pays out, because a fire is coming', () => {
    const down = run(new Winch(), true, 1).length
    const winch = new Winch()
    winch.length = MAX_LENGTH
    run(winch, false, 1)
    expect(MAX_LENGTH - winch.length).toBeGreaterThan(down)
  })

  it('stops at the end of the line rather than paying out for ever', () => {
    const winch = run(new Winch(), true, 30)
    expect(winch.length).toBe(MAX_LENGTH)
    expect(winch.extended).toBe(1)
  })

  it('comes to a stop stowed, not at a negative length', () => {
    const winch = run(new Winch(), false, 10)
    expect(winch.length).toBe(0)
    expect(winch.isStowed).toBe(true)
  })

  it('hangs the hook below the helicopter', () => {
    const winch = run(new Winch(), true, 1)
    expect(winch.hookHeight(100)).toBeCloseTo(100 - winch.length)
  })

  it('reaches an animal only when the hook is actually down by it', () => {
    const winch = new Winch()
    winch.length = 20
    // Helicopter at 40 puts the hook at 20: right on ground at 20.
    expect(winch.canReach(40, 20)).toBe(true)
    // Same line, helicopter much higher: the hook dangles far above.
    expect(winch.canReach(70, 20)).toBe(false)
    // Line still stowed while hovering low: no reach at all.
    expect(new Winch().canReach(30, 20)).toBe(false)
  })

  it('tolerates a little slack piled on the ground', () => {
    const winch = new Winch()
    winch.length = 24
    expect(winch.canReach(40, 20)).toBe(true)
  })

  it('stows on command, whatever it was doing', () => {
    const winch = run(new Winch(), true, 2)
    winch.stow()
    expect(winch.isStowed).toBe(true)
    expect(winch.paying).toBe(false)
  })
})
