import { describe, expect, it } from 'vitest'
import { windTargets } from './WindSound'

describe('windTargets', () => {
  it('is silent parked on the ground', () => {
    expect(windTargets(2, 0).gain).toBe(0)
  })

  it('grows with altitude while hovering', () => {
    const low = windTargets(8, 0)
    const high = windTargets(42, 0)
    expect(low.gain).toBeGreaterThan(0)
    expect(high.gain).toBeGreaterThan(low.gain)
    expect(high.centerHz).toBeGreaterThan(low.centerHz)
  })

  it('grows and rises in pitch with speed at a fixed height', () => {
    const slow = windTargets(8, 0)
    const fast = windTargets(8, 31)
    expect(fast.gain).toBeGreaterThan(slow.gain)
    expect(fast.centerHz).toBeGreaterThan(slow.centerHz)
  })

  it('caps at the top of the range rather than growing forever', () => {
    expect(windTargets(90, 100)).toEqual(windTargets(42, 31))
    expect(windTargets(90, 100).gain).toBeLessThanOrEqual(1)
  })
})
