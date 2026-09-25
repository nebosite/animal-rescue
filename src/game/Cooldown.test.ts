import { describe, expect, it } from 'vitest'
import { Cooldown } from './Cooldown'

describe('Cooldown', () => {
  it('allows the first fire immediately', () => {
    expect(new Cooldown(0.5).tryFire()).toBe(true)
  })

  it('refuses to fire again until the time has passed', () => {
    const cooldown = new Cooldown(0.5)
    cooldown.tryFire()
    expect(cooldown.tryFire()).toBe(false)
    cooldown.advance(0.4)
    expect(cooldown.tryFire()).toBe(false)
    cooldown.advance(0.1)
    expect(cooldown.tryFire()).toBe(true)
  })

  it('due() advances and fires together, ticking on a steady period', () => {
    const cooldown = new Cooldown(0.5)
    let fired = 0
    for (let i = 0; i < 120; i++) if (cooldown.due(1 / 60)) fired++
    // Ticks at frames 0, 30, 60 and 90; frame 120 is past the end.
    expect(fired).toBe(4)
  })

  it('due() actually returns a boolean, unlike advance()', () => {
    // Regression: `if (cooldown.advance(dt))` is always false, and that is how
    // the forest came to never catch alight.
    const cooldown = new Cooldown(1)
    expect(typeof cooldown.due(1 / 60)).toBe('boolean')
    expect(cooldown.advance(1 / 60)).toBeUndefined()
  })

  it('fires at most once per cooldown when asked every frame', () => {
    const cooldown = new Cooldown(0.35)
    let fired = 0
    for (let i = 0; i < 60; i++) {
      cooldown.advance(1 / 60)
      if (cooldown.tryFire()) fired++
    }
    expect(fired).toBe(3)
  })
})
