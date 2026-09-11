import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { World } from './World'

describe('World', () => {
  it('puts the helicopter in the scene', () => {
    const world = new World()
    expect(world.scene.children).toContain(world.helicopter.group)
  })

  it('lights the scene, or the helicopter would render black', () => {
    const lights = new World().scene.children.filter((child) => child instanceof THREE.Light)
    expect(lights.length).toBeGreaterThan(0)
  })

  it('has both a pickup pad and a rescue pad', () => {
    const world = new World()
    expect(world.pads).toContain(world.pickupPad)
    expect(world.pads).toContain(world.rescuePad)
    expect(world.pads).toHaveLength(2)
  })

  it('sets the pads a long flight apart, for a real trip between them', () => {
    const { pickupPad, rescuePad } = new World()
    const gap = Math.hypot(
      pickupPad.position.x - rescuePad.position.x,
      pickupPad.position.z - rescuePad.position.z,
    )
    expect(gap).toBeGreaterThan(400)
  })

  it('puts both pads on level ground at the height the land actually is', () => {
    const world = new World()
    for (const pad of world.pads) {
      expect(world.terrain.heightAt(pad.position.x, pad.position.z)).toBeCloseTo(pad.position.y, 3)
      expect(world.terrain.isLandable(pad.position.x, pad.position.z)).toBe(true)
      // Level right across the deck, not just at the centre.
      expect(world.terrain.heightAt(pad.position.x + pad.radius - 1, pad.position.z)).toBeCloseTo(pad.position.y, 2)
    }
  })

  it('puts the pickup up in the hills and the base down low', () => {
    const world = new World()
    expect(world.pickupPad.position.y).toBeGreaterThan(world.rescuePad.position.y + 20)
  })

  it('keeps both pads inside the flyable field', () => {
    const world = new World()
    for (const pad of world.pads) {
      expect(Math.abs(pad.position.x)).toBeLessThan(world.terrain.halfSize)
      expect(Math.abs(pad.position.z)).toBeLessThan(world.terrain.halfSize)
    }
  })

  it('matches the camera aspect to the viewport', () => {
    const world = new World()
    world.resize(1600, 900)
    expect(world.camera.aspect).toBeCloseTo(16 / 9)
  })

  it('ignores a zero-height viewport rather than going NaN', () => {
    const world = new World()
    world.resize(1600, 900)
    world.resize(1600, 0)
    expect(world.camera.aspect).toBeCloseTo(16 / 9)
  })

  it('places the camera behind and above the helicopter on the first frame, with no fly-in', () => {
    const world = new World()
    const target = new THREE.Vector3(10, 120, -30)
    world.follow(target, 0, 1 / 60)
    expect(world.camera.position.y).toBeGreaterThan(target.y + 5)
    expect(world.camera.position.z).toBeGreaterThan(target.z + 20)
  })

  it('never lets the land get in front of the lens', () => {
    const world = new World()
    // Fly low along the ground all over the map; the camera must stay above it.
    for (let x = -300; x <= 300; x += 60) {
      for (let z = -300; z <= 300; z += 60) {
        const ground = world.terrain.heightAt(x, z)
        for (let i = 0; i < 12; i++) world.follow(new THREE.Vector3(x, ground + 3, z), 0.7, 1 / 60)
        const under = world.terrain.heightAt(world.camera.position.x, world.camera.position.z)
        expect(world.camera.position.y).toBeGreaterThan(under)
      }
    }
  })

  it('swings round behind the tail as the heading changes', () => {
    const world = new World()
    const target = new THREE.Vector3(0, 10, 0)
    world.follow(target, 0, 1 / 60)
    // Facing +Z instead: the tail, and so the camera, is now on the -Z side.
    for (let i = 0; i < 600; i++) world.follow(target, Math.PI, 1 / 60)
    expect(world.camera.position.z).toBeLessThan(-20)
  })

  it('eases toward the new camera spot rather than jumping there', () => {
    const world = new World()
    const target = new THREE.Vector3(0, 10, 0)
    world.follow(target, 0, 1 / 60)
    world.follow(target, Math.PI, 1 / 60)
    // One frame later it has barely begun to swing round.
    expect(world.camera.position.z).toBeGreaterThan(20)
  })
})
