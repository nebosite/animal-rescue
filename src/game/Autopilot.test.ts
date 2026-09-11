import { describe, expect, it } from 'vitest'
import { Autopilot } from './Autopilot'
import { Helicopter } from './Helicopter'

const BASE = { x: -316, y: 21, z: 190 }

/** Let the autopilot fly from a starting point, and report where it got to. */
function flyHome(start: { x: number; y: number; z: number }, heading = 0, seconds = 120) {
  const helicopter = new Helicopter()
  helicopter.position.set(start.x, start.y, start.z)
  helicopter.heading = heading

  const autopilot = new Autopilot()
  const phases = new Set<string>()
  let landedAt: number | null = null

  for (let step = 0; step < seconds * 60; step++) {
    // Flat ground at the base's height keeps the test about the autopilot.
    const input = autopilot.update(helicopter, BASE, BASE.y)
    phases.add(autopilot.phase)
    helicopter.update(input, 1 / 60, BASE.y)
    if (helicopter.isOnGround && landedAt === null && step > 60) landedAt = step / 60
  }

  return {
    helicopter,
    phases,
    landedAt,
    range: Math.hypot(helicopter.position.x - BASE.x, helicopter.position.z - BASE.z),
  }
}

describe('Autopilot', () => {
  it('flies home from across the map and lands on the pad', () => {
    const result = flyHome({ x: 195, y: 64, z: -203 })
    expect(result.range).toBeLessThan(11)
    expect(result.helicopter.isOnGround).toBe(true)
    expect(result.landedAt).not.toBeNull()
  })

  it('gets there from any direction, however it was pointed when it gave up', () => {
    for (const start of [
      { x: 380, y: 40, z: 380 },
      { x: -380, y: 10, z: -380 },
      { x: 0, y: 200, z: 0 },
      { x: -300, y: 30, z: 190 },
    ]) {
      for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const result = flyHome(start, heading)
        expect(result.range).toBeLessThan(12)
        expect(result.helicopter.isOnGround).toBe(true)
      }
    }
  })

  it('climbs before it runs for home, so it does not fly into the hills', () => {
    const helicopter = new Helicopter()
    helicopter.position.set(195, 64, -203)
    const autopilot = new Autopilot()

    let lowest = Infinity
    for (let step = 0; step < 60 * 60; step++) {
      const input = autopilot.update(helicopter, BASE, 64)
      helicopter.update(input, 1 / 60, 64)
      // Once it is properly under way, it should be up out of the trees.
      if (step > 60 * 8 && autopilot.phase === 'cruising') lowest = Math.min(lowest, helicopter.position.y)
    }
    expect(lowest).toBeGreaterThan(120)
  })

  it('goes through climbing, cruising and landing in that order', () => {
    const result = flyHome({ x: 195, y: 64, z: -203 })
    expect(result.phases.has('climbing')).toBe(true)
    expect(result.phases.has('cruising')).toBe(true)
    expect(result.phases.has('landing')).toBe(true)
  })

  it('settles rather than slamming down', () => {
    const result = flyHome({ x: 195, y: 64, z: -203 })
    expect(result.helicopter.impactSpeed).toBeLessThan(8)
  })

  it('stays put once it is home', () => {
    const result = flyHome({ x: 195, y: 64, z: -203 }, 0, 200)
    expect(result.range).toBeLessThan(11)
    expect(result.helicopter.speed).toBeLessThan(1)
  })

  it('just lands when it is already over the pad', () => {
    const result = flyHome({ x: BASE.x + 3, y: BASE.y + 40, z: BASE.z + 3 }, 0, 40)
    expect(result.helicopter.isOnGround).toBe(true)
    expect(result.range).toBeLessThan(11)
  })
})
