import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { ROSTER } from './AnimalProfile'
import { Campaign } from './Campaign'
import { Fire } from './Fire'
import { LandingPad } from './LandingPad'
import { Rescue } from './Rescue'
import { rosterBoard } from './RosterBoard'
import { SiteFinder } from './SiteFinder'
import { Terrain } from './Terrain'
import { TreeCover } from './TreeCover'

const terrain = new Terrain(420)
const baseAt = { x: -316, z: 190 }
const base = new LandingPad('Rescue base', new THREE.Vector3(baseAt.x, terrain.levelAt(baseAt.x, baseAt.z, 17), baseAt.z), 11)
const finder = new SiteFinder(terrain, new TreeCover(terrain, [{ x: baseAt.x, z: baseAt.z, radius: 40 }]), baseAt)
const statuses = (rescue: Rescue, campaign: Campaign) => rosterBoard(ROSTER, rescue, campaign).map((e) => e.status)
const WEST = { x: -1, z: 0 }

describe('rosterBoard', () => {
  it('shows only the first animal as waiting on level one', () => {
    const campaign = new Campaign()
    const rescue = new Rescue(base, finder, Fire.sweepingIn(WEST, 420), campaign.party)
    expect(statuses(rescue, campaign)).toEqual(['waiting', 'unmet', 'unmet', 'unmet', 'unmet'])
  })

  it('follows an animal from aboard to saved, and marks the fire casualties lost', () => {
    const campaign = new Campaign()
    const fire = Fire.sweepingIn(WEST, 420)
    const rescue = new Rescue(base, finder, fire, ROSTER.slice(0, 2))
    const first = rescue.waiting[0]
    rescue.landedOn(null, { x: first.site.x, y: first.site.y + 2, z: first.site.z }, true)
    expect(statuses(rescue, campaign).slice(0, 2)).toEqual(['aboard', 'waiting'])

    rescue.landedOn(base, { x: base.position.x, y: base.position.y + 2, z: base.position.z }, true)
    const second = rescue.waiting[0]
    fire.addPatch({ x: second.site.x, z: second.site.z, radius: 30 })
    rescue.advance(1 / 60)
    expect(statuses(rescue, campaign).slice(0, 2)).toEqual(['saved', 'lost'])
  })

  it('remembers who was lost on an earlier level', () => {
    const campaign = new Campaign()
    campaign.finishLevel([ROSTER[0]], [ROSTER[1]])
    const rescue = new Rescue(base, finder, Fire.sweepingIn(WEST, 420), campaign.party)
    expect(statuses(rescue, campaign)[1]).toBe('lost')
  })

  it('shows everybody aboard when the hold holds more than one', () => {
    const campaign = new Campaign()
    const rescue = new Rescue(base, finder, Fire.sweepingIn(WEST, 420), ROSTER.slice(0, 2))
    rescue.slots = 2
    for (const w of [...rescue.waiting]) rescue.landedOn(null, { x: w.site.x, y: w.site.y + 2, z: w.site.z }, true)
    expect(statuses(rescue, campaign).slice(0, 2)).toEqual(['aboard', 'aboard'])
  })
})
