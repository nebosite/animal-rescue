import { describe, expect, it } from 'vitest'
import { Fire } from './Fire'
import { SiteFinder, type SiteKind } from './SiteFinder'
import { Terrain } from './Terrain'
import { TreeCover } from './TreeCover'

const terrain = new Terrain(420)
const base = { x: -316, z: 190 }
const pickupEnd = { x: 195, z: -203 }
terrain.levelAt(base.x, base.z, 17)
const trees = new TreeCover(terrain, [{ x: base.x, z: base.z, radius: 40 }])
const fire = Fire.frontBetween(base, pickupEnd)
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
    const grown = Fire.frontBetween(base, pickupEnd)
    for (let i = 0; i < 1800; i++) grown.advance(0.1)
    const start = finder.find('clearing', grown, 1)!
    expect(finder.fleeFrom(start, grown, 2)).not.toBeNull()
  })
})
