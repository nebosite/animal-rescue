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

  it('keeps the camera behind and above whatever it follows', () => {
    const world = new World()
    const target = new THREE.Vector3(10, 20, -30)
    world.follow(target)
    expect(world.camera.position.y).toBeGreaterThan(target.y)
    expect(world.camera.position.z).toBeGreaterThan(target.z)
  })
})
