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

  it('keeps the real pads far enough apart that they cannot both be landed on', () => {
    const { pickupPad, rescuePad } = new World()
    const gap = Math.hypot(
      pickupPad.position.x - rescuePad.position.x,
      pickupPad.position.z - rescuePad.position.z,
    )
    expect(gap).toBeGreaterThan(pickupPad.radius + rescuePad.radius)
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
    const target = new THREE.Vector3(10, 20, -30)
    world.follow(target, 0, 1 / 60)
    expect(world.camera.position.y).toBeGreaterThan(target.y + 5)
    expect(world.camera.position.z).toBeGreaterThan(target.z + 20)
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
