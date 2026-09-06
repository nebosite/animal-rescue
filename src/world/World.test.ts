import { describe, expect, it } from 'vitest'
import { World } from './World'

describe('World', () => {
  it('starts with a ground grid in the scene', () => {
    expect(new World().scene.children).toHaveLength(1)
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
})
