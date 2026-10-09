import { describe, expect, it } from 'vitest'
import { TOP_SPEED } from '../game/Helicopter'
import { decibels, TRIM } from './Mix'
import { fireOutput } from './FireSound'
import { rotorOutput, rotorTargets } from './RotorSound'
import { windOutput, windTargets } from './WindSound'

describe('decibels', () => {
  it('turns decibels into a gain factor', () => {
    expect(decibels(0)).toBe(1)
    expect(decibels(-10)).toBeCloseTo(0.316, 3)
    expect(decibels(-5)).toBeCloseTo(0.562, 3)
  })
})

describe('the trims reach the sounds', () => {
  it('takes 10 dB off the fire at every level', () => {
    expect(fireOutput(0.75)).toBeCloseTo(0.75 * decibels(TRIM.fire), 6)
    expect(fireOutput(0)).toBe(0)
  })

  it('takes 5 dB off the wind at every level', () => {
    const wind = windTargets(40, TOP_SPEED).gain
    expect(windOutput(wind)).toBeCloseTo(wind * decibels(TRIM.wind), 6)
  })

  it('takes 5 dB off the rotor when it is working', () => {
    const idle = rotorTargets(0, 0).gain
    const full = rotorTargets(1, TOP_SPEED).gain
    expect(rotorOutput(full) - idle).toBeCloseTo((full - idle) * decibels(TRIM.rotor), 6)
  })

  it('leaves the parked rotor exactly where it was', () => {
    // Regression: parked after a pickup the rotor is the whole mix, and an idle
    // under about 0.3 read as "the sound cut out". The trim is for the part of
    // the sound that comes from working, not the floor.
    const idle = rotorTargets(0, 0).gain
    expect(rotorOutput(idle)).toBe(idle)
    expect(rotorOutput(idle)).toBeGreaterThanOrEqual(0.3)
  })
})

describe('the balance after the trims', () => {
  it('keeps full-cruise wind under a working rotor', () => {
    // The old invariant, restated against what actually reaches the speaker.
    const wind = windOutput(windTargets(40, TOP_SPEED).gain)
    const rotor = rotorOutput(rotorTargets(1, TOP_SPEED).gain)
    expect(wind).toBeLessThan(rotor)
  })

  it('keeps the fire from ever exceeding the idle rotor', () => {
    expect(fireOutput(0.75)).toBeLessThan(rotorOutput(rotorTargets(0, 0).gain))
  })
})
