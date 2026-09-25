import { describe, expect, it } from 'vitest'
import { Turbulence } from './Turbulence'

/** Walk the air forward and collect one axis. */
function sample(seconds: number, strength = 1): number[] {
  const air = new Turbulence()
  const out: number[] = []
  for (let i = 0; i < seconds * 60; i++) {
    air.advance(1 / 60)
    out.push(air.buffetX(strength))
  }
  return out
}

describe('Turbulence', () => {
  it('is still air at zero strength', () => {
    const air = new Turbulence()
    air.advance(1)
    expect(air.buffetX(0)).toBe(0)
    expect(air.buffetZ(0)).toBe(0)
  })

  it('shoves harder the rougher the air', () => {
    const gentle = sample(6, 0.2).map(Math.abs)
    const rough = sample(6, 1).map(Math.abs)
    expect(Math.max(...rough)).toBeGreaterThan(Math.max(...gentle) * 3)
  })

  it('stays bounded — it never becomes a launch', () => {
    for (const value of sample(60)) expect(Math.abs(value)).toBeLessThan(50)
  })

  it('pushes both ways, averaging out rather than blowing you off the map', () => {
    const values = sample(60)
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length
    expect(Math.abs(mean)).toBeLessThan(2)
    expect(Math.max(...values)).toBeGreaterThan(12)
    expect(Math.min(...values)).toBeLessThan(-12)
  })

  it('shoves the two axes differently, so it is not a straight line', () => {
    const air = new Turbulence()
    let sameSign = 0
    for (let i = 0; i < 600; i++) {
      air.advance(1 / 60)
      if (Math.sign(air.buffetX(1)) === Math.sign(air.buffetZ(1))) sameSign++
    }
    expect(sameSign).toBeGreaterThan(100)
    expect(sameSign).toBeLessThan(500)
  })

  it('does not repeat on a beat a player would learn', () => {
    const values = sample(20)
    // Compare the run against itself shifted by a second: a simple loop would match.
    for (const shift of [60, 120, 180]) {
      let worst = 0
      for (let i = 0; i + shift < values.length; i++) {
        worst = Math.max(worst, Math.abs(values[i] - values[i + shift]))
      }
      expect(worst).toBeGreaterThan(3)
    }
  })

  it('is the same air every run, so a rough patch can be learned', () => {
    expect(sample(3)).toEqual(sample(3))
  })
})
