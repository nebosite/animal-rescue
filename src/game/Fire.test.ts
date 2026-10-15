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

  it('lifts you over the fire, hardest low down and gone above the column', () => {
    expect(one.updraftAt(300, 300, 10)).toBe(0)
    const low = one.updraftAt(0, 0, 8)
    const middling = one.updraftAt(0, 0, 30)
    const high = one.updraftAt(0, 0, 80)
    expect(low).toBeGreaterThan(0)
    expect(middling).toBeGreaterThan(0)
    expect(high).toBeLessThan(middling)
    expect(one.updraftAt(0, 0, COLUMN_HEIGHT + 1)).toBe(0)
    // Strong enough to beat full collective, which is what makes it a hazard
    // rather than a texture, and still a shove rather than a launch.
    // Comparable to full collective (about 39 when this was set; 58 since the
    // helicopter was sped up by half), so over the hottest ground the pilot
    // can barely hold altitude. Worth a play-test whether it still bites.
    expect(Math.max(low, middling)).toBeGreaterThan(35)
    expect(Math.max(low, middling)).toBeLessThan(70)
  })

  it('lifts and shakes over the whole burn, not only along the flame front', () => {
    // The middle of a mature patch is black, spent ground — and still a
    // chimney. This is the thing that made the weather impossible to feel.
    const old = aged()
    const patch = old.patches[0]
    expect(old.intensityAt(0, 0)).toBeLessThan(0.3)
    expect(old.updraftAt(0, 0, 20)).toBeGreaterThan(35)
    expect(old.roughnessAt(0, 0, 20)).toBeGreaterThan(0.7)
    // And it spills a little past the rim, so the ride roughens on approach.
    expect(old.roughnessAt(patch.radius + 12, 0, 20)).toBeGreaterThan(0)
    expect(old.roughnessAt(patch.radius + 90, 0, 20)).toBe(0)
  })

  it('stays rough right up the column, where calm air would be a relief', () => {
    expect(one.roughnessAt(0, 0, 4)).toBeGreaterThan(0.8)
    expect(one.roughnessAt(0, 0, COLUMN_HEIGHT - 5)).toBeGreaterThan(0.35)
    expect(one.roughnessAt(0, 0, COLUMN_HEIGHT + 1)).toBe(0)
    expect(one.roughnessAt(300, 300, 4)).toBe(0)
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

const FIELD = 420
const WEST = { x: -1, z: 0 }
/** Where the base sits: low in the -x half, a long way downwind of the front. */
const base = { x: -316, z: 190 }
const sweeping = () => Fire.sweepingIn(WEST, FIELD)

describe('Fire.sweepingIn', () => {
  const fire = sweeping()

  it('starts burning along the upwind edge and nowhere near the base', () => {
    expect(fire.intensityAt(FIELD - 40, 0)).toBeGreaterThan(0)
    expect(fire.intensityAt(base.x, base.z)).toBe(0)
    expect(fire.distanceToNearest(base.x, base.z)).toBeGreaterThan(400)
  })

  it('spans the whole width, so there is no slipping round the end of it', () => {
    for (let z = -FIELD + 60; z <= FIELD - 60; z += 20) {
      // Somewhere along the upwind edge at this z, something is alight.
      let hottest = 0
      for (let x = FIELD - 120; x <= FIELD - 10; x += 6) hottest = Math.max(hottest, fire.intensityAt(x, z))
      expect(hottest, `z=${z}`).toBeGreaterThan(0)
    }
  })

  it('puts the whole rest of the map in its path', () => {
    expect(fire.aheadOfFront(base.x, base.z)).toBeGreaterThan(400)
    expect(fire.aheadOfFront(0, 0)).toBeGreaterThan(0)
    // Behind the leading edge is not in the path, however unburnt it is.
    expect(fire.aheadOfFront(FIELD, 0)).toBeLessThan(0)
  })

  it('keeps every patch on the map', () => {
    for (const patch of fire.patches) {
      expect(Math.abs(patch.x)).toBeLessThanOrEqual(FIELD)
      expect(Math.abs(patch.z)).toBeLessThanOrEqual(FIELD)
    }
  })

  it('gives every patch its own identity, so the drawing can follow one', () => {
    const ids = new Set(fire.patches.map((patch) => patch.id))
    expect(ids.size).toBe(fire.patches.length)
  })

  it('is the same fire every time, so the map is learnable', () => {
    expect(sweeping().patches).toEqual(fire.patches)
  })
})

describe('Fire.advance', () => {
  const burnFor = (seconds: number) => {
    const fire = sweeping()
    for (let i = 0; i < seconds * 10; i++) fire.advance(0.1)
    return fire
  }

  it('widens the patches it already has, up to a limit', () => {
    const fresh = sweeping()
    const later = sweeping()
    for (let i = 0; i < 300; i++) later.advance(0.1)
    for (let i = 0; i < fresh.patches.length; i++) {
      expect(later.patches[i].radius).toBeGreaterThan(fresh.patches[i].radius)
    }
    for (const patch of burnFor(600).patches) expect(patch.radius).toBeLessThanOrEqual(64)
  })

  it('never shows the drawing more patches than it allocated for', () => {
    for (const seconds of [60, 120, 300, 3000]) {
      expect(burnFor(seconds).patches.length, `${seconds}s`).toBeLessThanOrEqual(MAX_PATCHES)
    }
  })

  it('travels: inside one shift the front crosses a good part of the map', () => {
    const fresh = sweeping()
    const shift = burnFor(300)
    const crossed = fresh.aheadOfFront(base.x, base.z) - shift.aheadOfFront(base.x, base.z)
    expect(crossed).toBeGreaterThan(300)
    // And it has not swallowed the base: there is still somewhere to land.
    expect(shift.aheadOfFront(base.x, base.z)).toBeGreaterThan(0)
    expect(shift.intensityAt(base.x, base.z)).toBe(0)
  })

  it('goes out behind itself, so the burn is a front and not a growing stain', () => {
    const where = { x: FIELD - 40, z: 0 }
    expect(sweeping().intensityAt(where.x, where.z)).toBeGreaterThan(0)
    // The ground it started on is dead long before the shift is over. The
    // black land and the dead trees stay; they belong to the terrain and the
    // forest, not to the patch.
    expect(burnFor(150).intensityAt(where.x, where.z)).toBe(0)
  })

  it('creeps rather than leaping: the front never jumps further than a patch can throw', () => {
    const fire = sweeping()
    let previous = fire.aheadOfFront(base.x, base.z)
    for (let i = 0; i < 3000; i++) {
      fire.advance(0.1)
      const now = fire.aheadOfFront(base.x, base.z)
      expect(previous - now).toBeLessThan(120)
      previous = now
    }
  })


  it('advances as a line, not a tendril', () => {
    // The first try let any leading patch throw embers, so one lucky patch
    // spawned a child that immediately became the new leader and spawned
    // again: the fire crossed the map as a single finger with the rest of the
    // front still sitting on the edge. Embers now go to whichever leading
    // patch has thrown fewest, so the whole width steps forward together.
    const fire = sweeping()
    for (let i = 0; i < 1500; i++) fire.advance(0.1)

    let covered = 0
    let lanes = 0
    for (let z = -FIELD + 20; z <= FIELD - 20; z += 20) {
      lanes++
      for (let x = -FIELD; x <= FIELD; x += 6) {
        if (fire.intensityAt(x, z) > 0.05) { covered++; break }
      }
    }
    expect(covered / lanes).toBeGreaterThan(0.5)
  })

  it('burns the same way every time', () => {
    expect(burnFor(200).patches).toEqual(burnFor(200).patches)
  })
})

describe('Fire.relight', () => {
  it('puts the front back on the edge it started from', () => {
    const fire = sweeping()
    const opening = sweeping().patches
    for (let i = 0; i < 2000; i++) fire.advance(0.1)
    expect(fire.patches).not.toEqual(opening)

    fire.relight()
    expect(fire.patches).toEqual(opening)
    expect(fire.age).toBe(0)
  })

  it('burns the second shift exactly like the first, so a map stays learnable', () => {
    const once = sweeping()
    for (let i = 0; i < 1200; i++) once.advance(0.1)
    const after = once.patches.map((patch) => ({ x: patch.x, z: patch.z, radius: patch.radius, age: patch.age }))

    once.relight()
    for (let i = 0; i < 1200; i++) once.advance(0.1)
    expect(once.patches.map((patch) => ({ x: patch.x, z: patch.z, radius: patch.radius, age: patch.age }))).toEqual(after)
  })
})

describe('Fire.pace', () => {
  it('runs the front faster when the pace is up, and relight keeps it', () => {
    const lead = (pace: number) => {
      const fire = Fire.sweepingIn({ x: -1, z: 0 }, 420)
      fire.pace = pace
      for (let i = 0; i < 600; i++) fire.advance(0.1)
      return fire.age
    }
    expect(lead(1.5)).toBeCloseTo(lead(1) * 1.5, 5)
  })
})
