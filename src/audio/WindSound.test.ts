import { describe, expect, it } from 'vitest'
import { windTargets } from './WindSound'

describe('windTargets', () => {
  it('is silent parked on the ground, wherever the ground is', () => {
    // The argument is height above the ground, so a parked helicopter reads
    // zero on a hilltop exactly as it does in the valley.
    expect(windTargets(0, 0).gain).toBe(0)
  })

  it('grows with height above the ground while hovering', () => {
    const low = windTargets(6, 0)
    const high = windTargets(40, 0)
    expect(low.gain).toBeGreaterThan(0)
    expect(high.gain).toBeGreaterThan(low.gain)
    expect(high.centerHz).toBeGreaterThan(low.centerHz)
  })

  it('grows and rises in pitch with speed at a fixed height', () => {
    const slow = windTargets(6, 0)
    const fast = windTargets(6, 31)
    expect(fast.gain).toBeGreaterThan(slow.gain)
    expect(fast.centerHz).toBeGreaterThan(slow.centerHz)
  })

  it('caps at the top of the range rather than growing forever', () => {
    expect(windTargets(90, 100)).toEqual(windTargets(40, 31))
    expect(windTargets(90, 100).gain).toBeLessThanOrEqual(1)
  })

  it('never out-shouts the rotor: full cruise wind stays under a working rotor', () => {
    // Regression for "the sound cuts in and out": the loudest bed must not be
    // the one that swells. Rotor gain at full effort is 0.32 + 0.38 + 0.08.
    expect(windTargets(40, 31).gain).toBeLessThan(0.7)
  })
})
