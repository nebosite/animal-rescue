import { describe, expect, it } from 'vitest'
import { Fire } from './Fire'
import { SiteFinder, type SiteKind } from './SiteFinder'
import { Terrain } from './Terrain'
import { TreeCover } from './TreeCover'

/** The fire comes in off the +x edge and blows west, as it does in the game. */
const WEST = { x: -1, z: 0 }
const terrain = new Terrain(420)
const base = { x: -316, z: 190 }
terrain.levelAt(base.x, base.z, 17)
const trees = new TreeCover(terrain, [{ x: base.x, z: base.z, radius: 40 }])
const fire = Fire.sweepingIn(WEST, 420)
const finder = new SiteFinder(terrain, trees, base)
const kinds: SiteKind[] = ['clearing', 'hilltop', 'canyon', 'ridge', 'fireline']

describe('SiteFinder', () => {
  it('finds plenty of places the skids can go down', () => {
    expect(finder.landable).toBeGreaterThan(200)
  })

  it('can find every kind of site on this map', () => {
    for (const kind of kinds) {
      const site = finder.find(kind, fire, 1)
      expect(site, kind).not.toBeNull()
      expect(site!.kind).toBe(kind)
      expect(site!.label.length).toBeGreaterThan(0)
    }
  })

  it('only offers ground a helicopter can actually land on, clear of trees', () => {
    for (const kind of kinds) {
      for (let seed = 0; seed < 6; seed++) {
        const site = finder.find(kind, fire, seed)!
        expect(terrain.isLandable(site.x, site.z), kind).toBe(true)
        expect(trees.nearestTrunk(site.x, site.z, 32), kind).toBeGreaterThanOrEqual(7.5)
        expect(terrain.heightAt(site.x, site.z)).toBeCloseTo(site.y, 5)
      }
    }
  })

  it('keeps sites off the fire and well away from base', () => {
    for (const kind of kinds) {
      const site = finder.find(kind, fire, 2)!
      expect(fire.intensityAt(site.x, site.z)).toBe(0)
      expect(Math.hypot(site.x - base.x, site.z - base.z)).toBeGreaterThanOrEqual(220)
    }
  })

  it('makes each kind mean what it says', () => {
    const hilltop = finder.find('hilltop', fire, 1)!
    const canyon = finder.find('canyon', fire, 1)!
    const fireline = finder.find('fireline', fire, 1)!
    expect(hilltop.y).toBeGreaterThan(canyon.y + 30)
    expect(terrain.canyonDepthAt(canyon.x, canyon.z)).toBeGreaterThanOrEqual(0.6)
    const gap = fire.distanceToNearest(fireline.x, fireline.z)
    expect(gap).toBeGreaterThanOrEqual(36)
    expect(gap).toBeLessThanOrEqual(95)
    expect(fireline.difficulty).toBeGreaterThan(hilltop.difficulty)
  })

  it('gives the same place for the same seed, and different places for different seeds', () => {
    const a = finder.find('clearing', fire, 3)!
    const b = finder.find('clearing', fire, 3)!
    expect(a).toEqual(b)
    const others = new Set([0, 1, 2, 4, 5, 6, 7].map((seed) => `${finder.find('clearing', fire, seed)!.x},${finder.find('clearing', fire, seed)!.z}`))
    expect(others.size).toBeGreaterThan(2)
  })

  it('spaces sites out when told what to avoid', () => {
    const first = finder.find('clearing', fire, 1)!
    const second = finder.find('clearing', fire, 1, [first])!
    expect(Math.hypot(first.x - second.x, first.z - second.z)).toBeGreaterThanOrEqual(70)
  })

  it('sends a frightened animal away from the fire, but not across the map', () => {
    const start = finder.find('fireline', fire, 1)!
    const refuge = finder.fleeFrom(start, fire, 1)!
    const run = Math.hypot(refuge.x - start.x, refuge.z - start.z)
    expect(run).toBeGreaterThanOrEqual(55)
    expect(run).toBeLessThanOrEqual(170)
    expect(fire.distanceToNearest(refuge.x, refuge.z)).toBeGreaterThan(fire.distanceToNearest(start.x, start.z))
    expect(terrain.isLandable(refuge.x, refuge.z)).toBe(true)
  })

  it('still finds a refuge once the fire has grown for a while', () => {
    const grown = Fire.sweepingIn(WEST, 420)
    for (let i = 0; i < 1800; i++) grown.advance(0.1)
    const start = finder.find('clearing', grown, 1)!
    expect(finder.fleeFrom(start, grown, 2)).not.toBeNull()
  })
})

describe('SiteFinder.findAhead', () => {
  it('puts an animal in the path of the fire, at about the distance asked for', () => {
    for (const wanted of [55, 150, 300]) {
      const site = finder.findAhead(fire, wanted, 1)
      expect(site, `${wanted}m`).not.toBeNull()
      const gap = fire.distanceToNearest(site!.x, site!.z)
      // Downwind of the leading edge: the front really is coming for it.
      expect(fire.aheadOfFront(site!.x, site!.z), `${wanted}m`).toBeGreaterThan(0)
      expect(Math.abs(gap - wanted), `${wanted}m wanted, got ${gap}`).toBeLessThan(60)
    }
  })

  it('never stands an animal in the flames, or close enough to be in them', () => {
    for (let seed = 0; seed < 8; seed++) {
      for (const wanted of [20, 55, 150, 300]) {
        const site = finder.findAhead(fire, wanted, seed)!
        expect(fire.intensityAt(site.x, site.z)).toBe(0)
        expect(fire.distanceToNearest(site.x, site.z)).toBeGreaterThanOrEqual(34)
      }
    }
  })

  it('gives ground the skids can actually go down on', () => {
    for (let seed = 0; seed < 6; seed++) {
      const site = finder.findAhead(fire, 150, seed)!
      expect(terrain.isLandable(site.x, site.z)).toBe(true)
      expect(trees.nearestTrunk(site.x, site.z, 32)).toBeGreaterThanOrEqual(7.5)
      expect(terrain.heightAt(site.x, site.z)).toBeCloseTo(site.y, 5)
    }
  })

  it('names the spot after whatever the terrain there happens to be', () => {
    const site = finder.findAhead(fire, 150, 1)!
    expect(site.label.length).toBeGreaterThan(0)
    expect(site.difficulty).toBeGreaterThanOrEqual(1)
  })

  it('spaces animals out, so three of them are three trips', () => {
    const first = finder.findAhead(fire, 150, 1)!
    const second = finder.findAhead(fire, 150, 1, [first])!
    expect(Math.hypot(first.x - second.x, first.z - second.z)).toBeGreaterThanOrEqual(70)
  })

  it('still finds somewhere once the front has crossed most of the map', () => {
    // The band of ground that qualifies travels with the fire and shrinks, so
    // late in a shift this is the request most likely to come back empty.
    const grown = Fire.sweepingIn(WEST, 420)
    for (let i = 0; i < 2400; i++) grown.advance(0.1)
    expect(finder.findAhead(grown, 55, 3)).not.toBeNull()
    expect(finder.findAhead(grown, 150, 4)).not.toBeNull()
  })
})
