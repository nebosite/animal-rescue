import { beforeEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { ROSTER } from './AnimalProfile'
import { LandingPad } from './LandingPad'
import { Rescue } from './Rescue'

const pickup = new LandingPad('Pickup pad', new THREE.Vector3(-18, 0, -55))
const rescuePad = new LandingPad('Rescue pad', new THREE.Vector3(24, 0, -48))

describe('Rescue', () => {
  let rescue: Rescue
  beforeEach(() => { rescue = new Rescue(pickup, rescuePad) })

  it('starts empty-handed with the first animal waiting and no score', () => {
    expect(rescue.carrying).toBe(false)
    expect(rescue.animalWaiting).toBe(true)
    expect(rescue.score).toBe(0)
    expect(rescue.animal).toBe(ROSTER[0])
  })

  it('picks the animal up on landing at the pickup', () => {
    expect(rescue.landedOn(pickup)).toBe('picked-up')
    expect(rescue.carrying).toBe(true)
    expect(rescue.animalWaiting).toBe(false)
    expect(rescue.score).toBe(0)
  })

  it('stays parked at the pickup without picking up twice', () => {
    rescue.landedOn(pickup)
    expect(rescue.landedOn(pickup)).toBeNull()
    expect(rescue.carrying).toBe(true)
  })

  it('scores the animal\'s value on a smooth delivery', () => {
    const first = rescue.animal
    rescue.landedOn(pickup)
    expect(rescue.landedOn(rescuePad)).toBe('delivered')
    expect(rescue.score).toBe(first.value)
    expect(rescue.rescued).toBe(1)
    expect(rescue.carrying).toBe(false)
    expect(rescue.lastDelivery).toEqual({ animal: first, credited: first.value })
  })

  it('docks a point of credit per scolding, but never the last one', () => {
    const duchess = ROSTER.find((animal) => animal.id === 'duchess')!
    const fussy = new Rescue(pickup, rescuePad, [duchess])
    fussy.landedOn(pickup)
    for (let i = 0; i < 10; i++) fussy.scold()
    expect(fussy.credit).toBe(1)
    fussy.landedOn(rescuePad)
    expect(fussy.score).toBe(1)
    expect(fussy.lastDelivery?.credited).toBe(1)
  })

  it('ignores a scolding when nobody is aboard', () => {
    rescue.scold()
    expect(rescue.credit).toBe(rescue.animal.value)
  })

  it('does not score for landing at the rescue pad empty-handed', () => {
    expect(rescue.landedOn(rescuePad)).toBeNull()
    expect(rescue.score).toBe(0)
  })

  it('does not score again for staying parked after a delivery', () => {
    rescue.landedOn(pickup)
    rescue.landedOn(rescuePad)
    expect(rescue.landedOn(rescuePad)).toBeNull()
    expect(rescue.rescued).toBe(1)
  })

  it('ignores landing away from any pad', () => {
    expect(rescue.landedOn(null)).toBeNull()
    expect(rescue.carrying).toBe(false)
  })

  it('brings the animals in roster order, with fresh credit each, and wraps around', () => {
    let total = 0
    for (let trip = 0; trip < ROSTER.length + 1; trip++) {
      const animal = rescue.animal
      expect(animal).toBe(ROSTER[trip % ROSTER.length])
      expect(rescue.credit).toBe(animal.value)
      expect(rescue.landedOn(pickup)).toBe('picked-up')
      expect(rescue.landedOn(rescuePad)).toBe('delivered')
      total += animal.value
      expect(rescue.score).toBe(total)
    }
  })
})
