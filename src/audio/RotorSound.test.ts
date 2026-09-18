import { describe, expect, it } from 'vitest'
import { rotorTargets } from './RotorSound'

describe('rotorTargets', () => {
  it('runs higher, faster, brighter and louder as effort rises', () => {
    const idle = rotorTargets(0, 0)
    const half = rotorTargets(0.5, 0)
    const full = rotorTargets(1, 0)
    for (const key of ['droneHz', 'chopHz', 'cutoffHz', 'whineHz', 'gain'] as const) {
      expect(half[key]).toBeGreaterThan(idle[key])
      expect(full[key]).toBeGreaterThan(half[key])
    }
  })

  it('adds a little pitch and volume with ground speed', () => {
    const hover = rotorTargets(0.3, 0)
    const cruise = rotorTargets(0.3, 46)
    expect(cruise.droneHz).toBeGreaterThan(hover.droneHz)
    expect(cruise.gain).toBeGreaterThan(hover.gain)
  })

  it('stays clearly audible at idle, and never exceeds unity gain', () => {
    // Regression: parked after a pickup the rotor is the whole mix, and an idle
    // below this read as "the sound cut out" in play-testing.
    expect(rotorTargets(0, 0).gain).toBeGreaterThanOrEqual(0.3)
    expect(rotorTargets(1, 100).gain).toBeLessThanOrEqual(1)
  })

  it('clamps out-of-range effort rather than extrapolating', () => {
    expect(rotorTargets(5, 0)).toEqual(rotorTargets(1, 0))
    expect(rotorTargets(-1, 0)).toEqual(rotorTargets(0, 0))
  })

  it('keeps the chop in the range a rotor actually thumps at', () => {
    expect(rotorTargets(0, 0).chopHz).toBeGreaterThanOrEqual(8)
    expect(rotorTargets(1, 46).chopHz).toBeLessThanOrEqual(24)
  })
})
