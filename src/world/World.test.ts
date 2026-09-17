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

  it('has the rescue base as its only pad, and a body and a flare per animal slot', () => {
    const world = new World(3)
    expect(world.pads).toEqual([world.rescuePad])
    expect(world.waitingAnimals).toHaveLength(3)
    expect(world.flares).toHaveLength(3)
    for (const model of world.waitingAnimals) expect(world.scene.children).toContain(model.group)
  })

  it('puts the base on level ground at the height the land actually is', () => {
    const world = new World()
    const pad = world.rescuePad
    expect(world.terrain.heightAt(pad.position.x, pad.position.z)).toBeCloseTo(pad.position.y, 3)
    expect(world.terrain.isLandable(pad.position.x, pad.position.z)).toBe(true)
    // Level right across the deck, not just at the centre.
    expect(world.terrain.heightAt(pad.position.x + pad.radius - 1, pad.position.z)).toBeCloseTo(pad.position.y, 2)
  })

  it('keeps the base inside the flyable field and clear of the fire', () => {
    const world = new World()
    const pad = world.rescuePad
    expect(Math.abs(pad.position.x)).toBeLessThan(world.terrain.halfSize)
    expect(Math.abs(pad.position.z)).toBeLessThan(world.terrain.halfSize)
    expect(world.fire.intensityAt(pad.position.x, pad.position.z)).toBe(0)
    expect(world.fire.distanceToNearest(pad.position.x, pad.position.z)).toBeGreaterThan(60)
  })

  it('has somewhere for animals to wait: plenty of landable sites of every kind', () => {
    const world = new World()
    expect(world.sites.landable).toBeGreaterThan(200)
    for (const kind of ['clearing', 'hilltop', 'canyon', 'ridge', 'fireline'] as const) {
      expect(world.sites.find(kind, world.fire, 1), kind).not.toBeNull()
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
