import { describe, expect, it } from 'vitest'
import { COLUMN_HEIGHT, Fire, MAX_PATCHES } from './Fire'

const one = new Fire([{ x: 0, z: 0, radius: 40, age: 0 }])
/**
 * The same patch, long enough alight to have burned its middle out. Built with
 * the age set rather than by advancing, because advancing also spreads the
 * fire and a fresh patch growing over the origin would mask what is asked.
 */
const aged = () => new Fire([{ x: 0, z: 0, radius: 40, age: 200 }])

describe('Fire', () => {
  it('burns hottest at the heart and not at all outside the rim', () => {
    expect(one.intensityAt(0, 0)).toBeCloseTo(1)
    expect(one.intensityAt(20, 0)).toBeGreaterThan(0)
    expect(one.intensityAt(20, 0)).toBeLessThan(1)
    expect(one.intensityAt(40, 0)).toBe(0)
    expect(one.intensityAt(300, 300)).toBe(0)
  })

  it('eases off rather than stopping at a hard edge', () => {
    let biggestJump = 0
    for (let d = 0; d < 45; d += 0.5) {
      biggestJump = Math.max(biggestJump, Math.abs(one.intensityAt(d + 0.5, 0) - one.intensityAt(d, 0)))
    }
    expect(biggestJump).toBeLessThan(0.05)
  })

  it('never stacks past full intensity where patches overlap', () => {
    const overlapping = new Fire([
      { x: 0, z: 0, radius: 40, age: 0 },
      { x: 10, z: 0, radius: 40, age: 0 },
      { x: -10, z: 0, radius: 40, age: 0 },
    ])
    for (let x = -50; x <= 50; x += 2) expect(overlapping.intensityAt(x, 0)).toBeLessThanOrEqual(1)
  })

  it('burns hollow with age, so the flame becomes a front with black behind it', () => {
    const old = aged()
    const patch = old.patches[0]
    const hollow = old.hollowOf(patch)
    expect(hollow).toBeGreaterThan(0.5)

    // The middle is spent; the band out near the rim is where the fire is.
    const middle = old.intensityAt(0, 0)
    const front = old.intensityAt(patch.radius * (hollow + (1 - hollow) / 2), 0)
    expect(front).toBeGreaterThan(middle * 3)
    expect(middle).toBeGreaterThan(0)
    expect(middle).toBeLessThan(0.25)
  })

  it('a young patch burns right through, before it has eaten its fuel', () => {
    expect(one.hollowOf(one.patches[0])).toBe(0)
    expect(one.intensityAt(0, 0)).toBeCloseTo(1, 1)
  })

  it('knows where it has already passed, and that is nowhere on a fresh fire', () => {
    expect(one.isBurntOut(0, 0)).toBe(false)
    const old = aged()
    expect(old.isBurntOut(0, 0)).toBe(true)
    expect(old.isBurntOut(old.patches[0].radius * 0.95, 0)).toBe(false)
    expect(old.isBurntOut(500, 500)).toBe(false)
  })

  it('eases off rather than stopping at a hard edge, even once it is a ring', () => {
    const old = aged()
    let biggestJump = 0
    for (let d = 0; d < 45; d += 0.5) {
      biggestJump = Math.max(biggestJump, Math.abs(old.intensityAt(d + 0.5, 0) - old.intensityAt(d, 0)))
    }
    // The front is deliberately sharper than the middle of a young blaze: it
    // is an edge. It still must not be a step.
    expect(biggestJump).toBeLessThan(0.12)
  })

  it('thins with height, so climbing over the fire is possible', () => {
    const low = one.heatAt(0, 0, 5)
    const mid = one.heatAt(0, 0, 40)
    expect(low).toBeGreaterThan(mid)
    expect(mid).toBeGreaterThan(0)
    expect(one.heatAt(0, 0, COLUMN_HEIGHT + 1)).toBe(0)
  })

  it('lifts you over the flames, hardest low down and gone above the column', () => {
    expect(one.updraftAt(300, 300, 10)).toBe(0)
    const low = one.updraftAt(0, 0, 8)
    const middling = one.updraftAt(0, 0, 30)
    const high = one.updraftAt(0, 0, 80)
    expect(low).toBeGreaterThan(0)
    expect(middling).toBeGreaterThan(0)
    expect(high).toBeLessThan(middling)
    expect(one.updraftAt(0, 0, COLUMN_HEIGHT + 1)).toBe(0)
    // Strong enough to be felt, not strong enough to throw the helicopter.
    expect(Math.max(low, middling)).toBeLessThan(35)
  })

  it('is roughest right in the flames and smooth well away from them', () => {
    expect(one.roughnessAt(0, 0, 4)).toBeGreaterThan(0.8)
    expect(one.roughnessAt(0, 0, COLUMN_HEIGHT + 1)).toBe(0)
    expect(one.roughnessAt(300, 300, 4)).toBe(0)
    // Behind the front, over burnt ground, the air has calmed down.
    const old = aged()
    expect(old.roughnessAt(0, 0, 4)).toBeLessThan(old.roughnessAt(old.patches[0].radius * 0.8, 0, 4))
  })

  it('is only dangerous where there is actually fire below', () => {
    expect(one.isBurning(0, 0, 2)).toBe(true)
    expect(one.isBurning(300, 0, 2)).toBe(false)
    expect(one.isBurning(0, 0, COLUMN_HEIGHT + 10)).toBe(false)
  })

  it('measures the gap to the nearest flame, zero once inside', () => {
    expect(one.distanceToNearest(140, 0)).toBeCloseTo(100)
    expect(one.distanceToNearest(10, 0)).toBe(0)
  })
})

describe('Fire.douse', () => {
  const blaze = () => new Fire([{ x: 0, z: 0, radius: 50, age: 0 }])

  it('knocks the flames back where the water lands', () => {
    const fire = blaze()
    const before = fire.intensityAt(0, 0)
    const knocked = fire.douse(0, 0, 46)
    expect(knocked).toBeGreaterThan(0)
    expect(fire.patches[0].radius).toBeLessThan(50)
    expect(fire.intensityAt(0, 0)).toBeLessThan(before)
  })

  it('does nothing to fire the drop did not reach', () => {
    const fire = blaze()
    expect(fire.douse(400, 400, 46)).toBe(0)
    expect(fire.patches[0].radius).toBe(50)
  })

  it('never puts the fire out entirely, however much is dropped', () => {
    const fire = blaze()
    for (let i = 0; i < 40; i++) fire.douse(0, 0, 46)
    expect(fire.patches[0].radius).toBeGreaterThan(0)
    expect(fire.patches).toHaveLength(1)
  })

  it('buys room: the gap to the nearest flame grows', () => {
    const fire = blaze()
    const before = fire.distanceToNearest(80, 0)
    fire.douse(0, 0, 46)
    expect(fire.distanceToNearest(80, 0)).toBeGreaterThan(before)
  })
})

describe('Fire.frontBetween', () => {
  const from = { x: -316, z: 190 }
  const to = { x: 195, z: -203 }
  const fire = Fire.frontBetween(from, to)

  it('puts the fire between the two places, not on top of either', () => {
    expect(fire.intensityAt(from.x, from.z)).toBe(0)
    expect(fire.intensityAt(to.x, to.z)).toBe(0)
    expect(fire.distanceToNearest(from.x, from.z)).toBeGreaterThan(60)
    expect(fire.distanceToNearest(to.x, to.z)).toBeGreaterThan(60)
  })

  it('actually blocks the straight line between them', () => {
    let burningSteps = 0
    for (let t = 0; t <= 1; t += 0.01) {
      const x = from.x + (to.x - from.x) * t
      const z = from.z + (to.z - from.z) * t
      if (fire.intensityAt(x, z) > 0.2) burningSteps++
    }
    expect(burningSteps).toBeGreaterThan(5)
  })

  it('leaves a way round: the front does not span the whole map', () => {
    const clearFarToOneSide = fire.patches.every((patch) => Math.hypot(patch.x - 380, patch.z - 380) > patch.radius)
    expect(clearFarToOneSide).toBe(true)
  })

  it('is the same fire every time, so the map is learnable', () => {
    const again = Fire.frontBetween(from, to)
    expect(again.patches).toEqual(fire.patches)
  })
})

describe('Fire.advance', () => {
  const from = { x: -316, z: 190 }
  const to = { x: 195, z: -203 }
  const burnFor = (seconds: number) => {
    const fire = Fire.frontBetween(from, to)
    for (let i = 0; i < seconds * 10; i++) fire.advance(0.1)
    return fire
  }

  it('widens every patch over time, up to a limit', () => {
    const fresh = Fire.frontBetween(from, to)
    const later = burnFor(60)
    for (let i = 0; i < fresh.patches.length; i++) {
      expect(later.patches[i].radius).toBeGreaterThan(fresh.patches[i].radius)
    }
    const much = burnFor(600)
    for (const patch of much.patches) expect(patch.radius).toBeLessThanOrEqual(MAX_PATCHES > 0 ? 64 : 0)
  })

  it('catches new patches as it burns, but never more than the drawing can show', () => {
    const fresh = Fire.frontBetween(from, to)
    const later = burnFor(120)
    expect(later.patches.length).toBeGreaterThan(fresh.patches.length)
    const much = burnFor(3000)
    expect(much.patches.length).toBeLessThanOrEqual(MAX_PATCHES)
    expect(much.patches.length).toBe(MAX_PATCHES)
  })

  it('creeps downwind, toward the far end of the run', () => {
    const fresh = Fire.frontBetween(from, to)
    const later = burnFor(240)
    // Distance from the pickup end to the nearest flame should shrink.
    expect(later.distanceToNearest(to.x, to.z)).toBeLessThan(fresh.distanceToNearest(to.x, to.z))
    // And the fire should never have reached back over the base.
    expect(later.intensityAt(from.x, from.z)).toBe(0)
  })

  it('burns the same way every time', () => {
    const a = burnFor(200)
    const b = burnFor(200)
    expect(a.patches).toEqual(b.patches)
  })

  it('does not leap: each new patch touches the fire it caught from', () => {
    const fire = burnFor(300)
    const original = Fire.frontBetween(from, to).patches.length
    for (let i = original; i < fire.patches.length; i++) {
      const patch = fire.patches[i]
      const touching = fire.patches.some((other, j) =>
        j !== i && Math.hypot(other.x - patch.x, other.z - patch.z) < other.radius + patch.radius,
      )
      expect(touching).toBe(true)
    }
  })
})
