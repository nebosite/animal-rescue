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

describe('rotorTargets on a damaged machine', () => {
  const fresh = rotorTargets(0.5, 20, 1)
  const hurt = rotorTargets(0.5, 20, 0.5)
  const wreck = rotorTargets(0.5, 20, 0)

  it('sounds lower and slower the worse the machine gets', () => {
    expect(hurt.droneHz).toBeLessThan(fresh.droneHz)
    expect(wreck.droneHz).toBeLessThan(hurt.droneHz)
    expect(wreck.chopHz).toBeLessThan(fresh.chopHz)
    expect(wreck.whineHz).toBeLessThan(fresh.whineHz)
  })

  it('surges and grinds, and does neither at all when it is whole', () => {
    expect(fresh.surgeDepthHz).toBe(0)
    expect(fresh.rasp).toBe(0)
    expect(wreck.surgeDepthHz).toBeGreaterThan(10)
    expect(wreck.rasp).toBeGreaterThan(0.5)
  })

  it('barely mentions a scratch, so the cue is spent where it matters', () => {
    const scratched = rotorTargets(0.5, 20, 0.95)
    expect(scratched.surgeDepthHz).toBeLessThan(0.2)
    expect(scratched.rasp).toBeLessThan(0.01)
  })

  it('still keeps the chop in the range a rotor thumps at, wrecked or not', () => {
    expect(rotorTargets(0, 0, 0).chopHz).toBeGreaterThanOrEqual(8)
    expect(rotorTargets(1, 46, 0).chopHz).toBeLessThanOrEqual(24)
  })

  it('never goes silent as it breaks: a dying engine changes note, not volume', () => {
    expect(wreck.gain).toBeCloseTo(fresh.gain, 5)
  })
})
