import { describe, expect, it } from 'vitest'
import { LANDABLE_SLOPE, Terrain } from './Terrain'

const FIELD = 420

/** Walk a grid over the whole map, calling back with each point's height. */
function sweep(terrain: Terrain, step = 20): Array<{ x: number; z: number; height: number }> {
  const points = []
  for (let x = -FIELD; x <= FIELD; x += step) {
    for (let z = -FIELD; z <= FIELD; z += step) {
      points.push({ x, z, height: terrain.heightAt(x, z) })
    }
  }
  return points
}

describe('Terrain', () => {
  it('gives the same height for the same point every time', () => {
    const terrain = new Terrain(FIELD)
    expect(terrain.heightAt(123, -456)).toBe(terrain.heightAt(123, -456))
    expect(new Terrain(FIELD).heightAt(123, -456)).toBe(terrain.heightAt(123, -456))
  })

  it('is continuous: neighbouring points never jump like a cliff', () => {
    const terrain = new Terrain(FIELD)
    let biggestJump = 0
    for (let x = -FIELD; x < FIELD; x += 7) {
      for (let z = -FIELD; z < FIELD; z += 53) {
        biggestJump = Math.max(biggestJump, Math.abs(terrain.heightAt(x + 1, z) - terrain.heightAt(x, z)))
      }
    }
    expect(biggestJump).toBeLessThan(5)
  })

  it('is hilly: a good spread of heights across the map, not a plain', () => {
    const heights = sweep(new Terrain(FIELD)).map((point) => point.height)
    const low = Math.min(...heights)
    const high = Math.max(...heights)
    expect(high - low).toBeGreaterThan(60)
  })

  it('is rockiest in the canyon and gentlest on the hills', () => {
    const terrain = new Terrain(FIELD)
    const points = sweep(terrain, 10)
    const inCanyon = points.filter((p) => terrain.canyonDepthAt(p.x, p.z) > 0.8)
    const onHills = points.filter((p) => terrain.canyonDepthAt(p.x, p.z) < 0.05)

    const meanRock = (list: typeof points) =>
      list.reduce((sum, p) => sum + terrain.rockinessAt(p.x, p.z), 0) / list.length
    expect(meanRock(inCanyon)).toBeGreaterThan(meanRock(onHills) * 3)

    // Broken ground means steeper ground: the canyon is harder to put down in.
    const meanSlope = (list: typeof points) =>
      list.reduce((sum, p) => sum + terrain.slopeAt(p.x, p.z), 0) / list.length
    expect(meanSlope(inCanyon)).toBeGreaterThan(meanSlope(onHills))
  })

  it('has a canyon wide enough to fly down', () => {
    const terrain = new Terrain(FIELD)
    // Walk a line across the map and measure the longest unbroken run of canyon.
    let longest = 0
    let run = 0
    for (let x = -FIELD; x <= FIELD; x += 2) {
      if (terrain.canyonDepthAt(x, 0) > 0.5) { run += 2; longest = Math.max(longest, run) } else run = 0
    }
    expect(longest).toBeGreaterThan(60)
  })

  it('has canyon floors well below the surrounding hills', () => {
    const terrain = new Terrain(FIELD)
    const points = sweep(terrain, 10)
    const inCanyon = points.filter((p) => terrain.canyonDepthAt(p.x, p.z) > 0.8)
    const onHills = points.filter((p) => terrain.canyonDepthAt(p.x, p.z) < 0.05)
    expect(inCanyon.length).toBeGreaterThan(20)

    const meanCanyon = inCanyon.reduce((sum, p) => sum + p.height, 0) / inCanyon.length
    const meanHills = onHills.reduce((sum, p) => sum + p.height, 0) / onHills.length
    expect(meanHills - meanCanyon).toBeGreaterThan(25)
  })

  it('offers both flat ground and slopes too steep to land on', () => {
    const terrain = new Terrain(FIELD)
    const points = sweep(terrain, 15)
    const landable = points.filter((p) => terrain.isLandable(p.x, p.z))
    expect(landable.length).toBeGreaterThan(points.length * 0.25)
    expect(landable.length).toBeLessThan(points.length * 0.95)
  })

  it('levels a pad flat, and reports the height it levelled to', () => {
    const terrain = new Terrain(FIELD)
    const level = terrain.levelAt(120, -260, 12)
    for (const [dx, dz] of [[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8], [6, 6]]) {
      expect(terrain.heightAt(120 + dx, -260 + dz)).toBeCloseTo(level, 4)
    }
    expect(terrain.isLandable(120, -260)).toBe(true)
  })

  it('blends a levelled pad back into the hills rather than leaving a wall', () => {
    const terrain = new Terrain(FIELD)
    const level = terrain.levelAt(0, 0, 12)
    let biggestJump = 0
    for (let d = 0; d < 60; d += 0.5) {
      biggestJump = Math.max(biggestJump, Math.abs(terrain.heightAt(d + 0.5, 0) - terrain.heightAt(d, 0)))
    }
    expect(biggestJump).toBeLessThan(2)
    // Far from the pad the hills are untouched.
    expect(terrain.heightAt(200, 0)).not.toBeCloseTo(level, 1)
  })

  it('keeps levelled pads independent of each other', () => {
    const terrain = new Terrain(FIELD)
    const base = terrain.levelAt(-300, 300, 14)
    const far = terrain.levelAt(320, -280, 14)
    expect(terrain.heightAt(-300, 300)).toBeCloseTo(base, 3)
    expect(terrain.heightAt(320, -280)).toBeCloseTo(far, 3)
  })

  it('measures slope as rise over run, so a level pad reads zero', () => {
    const terrain = new Terrain(FIELD)
    terrain.levelAt(50, 50, 20)
    expect(terrain.slopeAt(50, 50)).toBeCloseTo(0, 5)
    expect(LANDABLE_SLOPE).toBeGreaterThan(0)
  })
})
