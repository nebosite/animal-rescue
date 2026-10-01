import { beforeEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { ROSTER } from './AnimalProfile'
import { Fire } from './Fire'
import { LandingPad } from './LandingPad'
import { PICKUP_RADIUS, Rescue } from './Rescue'
import { SiteFinder } from './SiteFinder'
import { Terrain } from './Terrain'
import { TreeCover } from './TreeCover'

/** The fire comes in off the +x edge and blows west, as it does in the game. */
const WEST = { x: -1, z: 0 }
const terrain = new Terrain(420)
const baseAt = { x: -316, z: 190 }
const baseHeight = terrain.levelAt(baseAt.x, baseAt.z, 17)
const base = new LandingPad('Rescue base', new THREE.Vector3(baseAt.x, baseHeight, baseAt.z), 11)
const trees = new TreeCover(terrain, [{ x: baseAt.x, z: baseAt.z, radius: 40 }])
const finder = new SiteFinder(terrain, trees, baseAt)

const at = (site: { x: number; y: number; z: number }) => ({ x: site.x, y: site.y + 2, z: site.z })
const onBase = { x: base.position.x, y: base.position.y + 2, z: base.position.z }

describe('Rescue', () => {
  let fire: Fire
  let rescue: Rescue
  beforeEach(() => {
    fire = Fire.sweepingIn(WEST, 420)
    rescue = new Rescue(base, finder, fire)
  })

  it('starts with three animals waiting at three different places', () => {
    expect(rescue.waiting).toHaveLength(3)
    expect(rescue.carrying).toBeNull()
    const names = new Set(rescue.waiting.map((w) => w.animal.name))
    expect(names.size).toBe(3)
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        const a = rescue.waiting[i].site
        const b = rescue.waiting[j].site
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(70)
      }
    }
  })

  it('credits value plus the difficulty of the place, from the start', () => {
    for (const w of rescue.waiting) expect(w.credit).toBe(w.animal.value + w.site.difficulty - 1)
  })

  it('picks up whichever animal you land beside', () => {
    const target = rescue.waiting[1]
    expect(rescue.landedOn(null, at(target.site), true)).toBe('picked-up')
    expect(rescue.carrying).toBe(target)
    expect(rescue.waiting).toHaveLength(2)
    expect(rescue.waiting).not.toContain(target)
  })

  it('does not pick up from the air, or from too far away', () => {
    const target = rescue.waiting[0]
    expect(rescue.landedOn(null, at(target.site), false)).toBeNull()
    const off = { x: target.site.x + PICKUP_RADIUS + 3, y: target.site.y + 2, z: target.site.z }
    expect(rescue.landedOn(null, off, true)).toBeNull()
    expect(rescue.carrying).toBeNull()
  })

  it('delivers at the base, scores, and restocks so there are always three out there', () => {
    const target = rescue.waiting[0]
    rescue.landedOn(null, at(target.site), true)
    expect(rescue.landedOn(base, onBase, true)).toBe('delivered')
    expect(rescue.carrying).toBeNull()
    expect(rescue.rescued).toBe(1)
    expect(rescue.score).toBeGreaterThanOrEqual(target.credit)
    expect(rescue.lastDelivery?.animal).toBe(target.animal)
    expect(rescue.waiting).toHaveLength(3)
  })

  it('does not deliver at the base with nobody aboard, or on a pad that is not the base', () => {
    expect(rescue.landedOn(base, onBase, true)).toBeNull()
    const target = rescue.waiting[0]
    rescue.landedOn(null, at(target.site), true)
    const elsewhere = new LandingPad('Somewhere', new THREE.Vector3(0, 0, 0), 11)
    expect(rescue.landedOn(elsewhere, onBase, true)).toBeNull()
    expect(rescue.carrying).toBe(target)
  })

  it('takes an animal up on the winch without landing, and pays for it', () => {
    const target = rescue.waiting[0]
    const over = { x: target.site.x + 3, z: target.site.z - 2 }
    // Hook right down by its feet, hovering steady.
    expect(rescue.winchUp(over, target.site.y + 1, 2)).toBe('picked-up')
    expect(rescue.carrying).toBe(target)

    rescue.advance(1)
    rescue.landedOn(base, onBase, true, 1)
    expect(rescue.lastDelivery?.bonuses).toContain('winched +3')
  })

  it('will not winch from too high, too fast, or with nobody below', () => {
    const target = rescue.waiting[0]
    const over = { x: target.site.x, z: target.site.z }
    // Hook still dangling well above the ground.
    expect(rescue.winchUp(over, target.site.y + 30, 1)).toBeNull()
    // Hook down, but the helicopter is flying past.
    expect(rescue.winchUp(over, target.site.y + 1, 25)).toBeNull()
    // Hook down and steady, but over empty forest.
    expect(rescue.winchUp({ x: 0, z: 0 }, 0, 1)).toBeNull()
    expect(rescue.carrying).toBeNull()
  })

  it('will not winch a second animal while one is aboard', () => {
    const first = rescue.waiting[0]
    rescue.winchUp({ x: first.site.x, z: first.site.z }, first.site.y + 1, 1)
    const second = rescue.waiting[0]
    expect(rescue.winchUp({ x: second.site.x, z: second.site.z }, second.site.y + 1, 1)).toBeNull()
    expect(rescue.carrying).toBe(first)
  })

  it('pays no winch bonus for an animal that was simply landed beside', () => {
    const target = rescue.waiting[0]
    rescue.landedOn(null, at(target.site), true)
    rescue.advance(1)
    rescue.landedOn(base, onBase, true, 1)
    expect(rescue.lastDelivery?.bonuses).not.toContain('winched +3')
  })

  it('pays a bonus for a quick trip and a gentle touchdown, and says why', () => {
    const target = rescue.waiting[0]
    rescue.landedOn(null, at(target.site), true)
    rescue.advance(1) // a second later: far inside par
    rescue.landedOn(base, onBase, true, 1)
    expect(rescue.lastDelivery?.bonuses).toEqual(['quick +2', 'gentle +1'])
    expect(rescue.lastDelivery?.credited).toBe(target.credit + 3)
  })

  it('pays no bonus for dawdling and slamming down', () => {
    const target = rescue.waiting[0]
    rescue.landedOn(null, at(target.site), true)
    for (let i = 0; i < 600; i++) rescue.advance(0.5) // five minutes
    const credit = rescue.credit
    rescue.landedOn(base, onBase, true, 9)
    expect(rescue.lastDelivery?.bonuses).toEqual([])
    expect(rescue.lastDelivery?.credited).toBe(credit)
  })

  it('docks a point per scolding, never below one, and only while aboard', () => {
    rescue.scold()
    expect(rescue.waiting[0].credit).toBe(rescue.waiting[0].animal.value + rescue.waiting[0].site.difficulty - 1)
    const target = rescue.waiting[0]
    rescue.landedOn(null, at(target.site), true)
    for (let i = 0; i < 12; i++) rescue.scold()
    expect(rescue.credit).toBe(1)
  })

  it('sends an animal running when the fire reaches it, at a cost, and tells you who', () => {
    const victim = rescue.waiting[0]
    const before = { ...victim.site }
    const creditBefore = victim.credit
    // The constructor avoids fire when placing, so plant a blaze on a site afterwards.
    const blaze = Fire.sweepingIn(WEST, 420)
    const hot = new Rescue(base, finder, blaze, ROSTER)
    const w = hot.waiting[0]
    blaze.addPatch({ x: w.site.x, z: w.site.z, radius: 30 })
    const bolted = hot.advance(1 / 60)
    expect(bolted).toBe(w)
    expect(hot.lastBolted).toBe(w)
    expect(Math.hypot(w.site.x - before.x, w.site.z - before.z)).toBeGreaterThan(0)
    expect(blaze.intensityAt(w.site.x, w.site.z)).toBe(0)
    expect(w.credit).toBeLessThanOrEqual(creditBefore)
    void creditBefore
  })

  it('always has somebody with the fire at their heels, and sends you there first', () => {
    // Every animal now waits in the fire's path, and the nearest band is
    // deliberately inside worrying range — so from the first second there is
    // someone the Chief should be shouting about.
    const threatened = rescue.mostThreatened()
    expect(threatened).not.toBeNull()
    expect(rescue.threatTo(threatened!)).toBeLessThanOrEqual(70)

    // Standing right on top of somebody else does not change the advice.
    const other = rescue.waiting.find((w) => w !== threatened)!
    expect(rescue.recommended({ x: other.site.x, z: other.site.z })).toBe(threatened)
  })

  it('falls back to the nearest animal when nobody is in immediate danger', () => {
    // Right off the map: the bands are measured from the flames, so a fire
    // anywhere on it would have somebody standing the near band away from it.
    const faraway = new Fire([{ x: 4000, z: 4000, radius: 10, age: 0 }])
    const quiet = new Rescue(base, finder, faraway, ROSTER)
    expect(quiet.mostThreatened()).toBeNull()
    const target = quiet.waiting[2]
    expect(quiet.recommended({ x: target.site.x, z: target.site.z })).toBe(target)
  })

  it('works through the roster in order and wraps around', () => {
    const seen: string[] = []
    for (let trip = 0; trip < ROSTER.length + 2; trip++) {
      const target = rescue.waiting[0]
      seen.push(target.animal.id)
      rescue.landedOn(null, at(target.site), true)
      rescue.landedOn(base, onBase, true)
    }
    expect(seen.slice(0, ROSTER.length)).toEqual(ROSTER.map((a) => a.id))
    expect(seen[ROSTER.length]).toBe(ROSTER[0].id)
  })

  it('reports the same layout every time, so the map is learnable', () => {
    const again = new Rescue(base, finder, Fire.sweepingIn(WEST, 420))
    expect(again.waiting.map((w) => [w.animal.id, w.site.x, w.site.z]))
      .toEqual(rescue.waiting.map((w) => [w.animal.id, w.site.x, w.site.z]))
  })
})
