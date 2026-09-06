import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { LandingPad } from './LandingPad'
import { Helicopter } from './Helicopter'
import { noInput } from './FlightInput'

const pad = () => new LandingPad('Pickup', new THREE.Vector3(-30, 0, -45), 9)

describe('LandingPad', () => {
  it('covers its own centre', () => {
    expect(pad().covers(new THREE.Vector3(-30, 0, -45))).toBe(true)
  })

  it('covers a point just inside the radius, not one just outside', () => {
    expect(pad().covers(new THREE.Vector3(-30 + 8, 0, -45))).toBe(true)
    expect(pad().covers(new THREE.Vector3(-30 + 10, 0, -45))).toBe(false)
  })

  it('ignores altitude, so a helicopter overhead still counts as over it', () => {
    expect(pad().covers(new THREE.Vector3(-30, 80, -45))).toBe(true)
  })
})

describe('landing on a pad', () => {
  it('needs the helicopter both over the pad and on the ground', () => {
    const helicopter = new Helicopter()
    const target = pad()

    // Hovering at the start position: neither over the pad nor landed.
    expect(target.covers(helicopter.position) && helicopter.isOnGround).toBe(false)

    // Over the pad but still airborne.
    helicopter.position.set(-30, 8, -45)
    expect(helicopter.isOnGround).toBe(false)
    expect(target.covers(helicopter.position) && helicopter.isOnGround).toBe(false)

    // Settled onto the pad.
    for (let i = 0; i < 20; i++) helicopter.update({ ...noInput(), down: true }, 1)
    expect(helicopter.isOnGround).toBe(true)
    expect(target.covers(helicopter.position) && helicopter.isOnGround).toBe(true)
  })

  it('does not count landing on open ground away from the pad', () => {
    const helicopter = new Helicopter()
    for (let i = 0; i < 20; i++) helicopter.update({ ...noInput(), down: true }, 1)
    expect(helicopter.isOnGround).toBe(true)
    expect(pad().covers(helicopter.position)).toBe(false)
  })
})

describe('LandingPad.landedOn', () => {
  const pickup = new LandingPad('Pickup pad', new THREE.Vector3(-18, 0, -55))
  const rescue = new LandingPad('Rescue pad', new THREE.Vector3(28, 0, -38))
  const pads = [pickup, rescue]

  it('picks out the pad the helicopter is standing on', () => {
    expect(LandingPad.landedOn(pads, new THREE.Vector3(-18, 2, -55), true)).toBe(pickup)
    expect(LandingPad.landedOn(pads, new THREE.Vector3(28, 2, -38), true)).toBe(rescue)
  })

  it('returns nothing while airborne over a pad', () => {
    expect(LandingPad.landedOn(pads, new THREE.Vector3(28, 40, -38), false)).toBeNull()
  })

  it('returns nothing when landed on open ground', () => {
    expect(LandingPad.landedOn(pads, new THREE.Vector3(0, 2, 0), true)).toBeNull()
  })
})
