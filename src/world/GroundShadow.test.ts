import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { Terrain } from '../game/Terrain'
import { GroundShadow } from './GroundShadow'

const terrain = new Terrain(420)

/** The world height of every vertex in the shadow ring. */
function ring(shadow: GroundShadow): number[] {
  const position = shadow.mesh.geometry.attributes.position
  const out: number[] = []
  for (let i = 0; i < position.count; i++) out.push(position.getY(i))
  return out
}

describe('GroundShadow', () => {
  it('sits directly below the helicopter, because the sun is overhead', () => {
    const shadow = new GroundShadow(terrain)
    shadow.update(-120, 60, 10)
    expect(shadow.mesh.position.x).toBe(-120)
    expect(shadow.mesh.position.z).toBe(60)
  })

  it('lies on the ground, not at a fixed height', () => {
    const shadow = new GroundShadow(terrain)
    const low = { x: 40, z: -260 }
    const high = { x: -300, z: 120 }
    shadow.update(low.x, low.z, 5)
    const overLow = ring(shadow)[0]
    shadow.update(high.x, high.z, 5)
    const overHigh = ring(shadow)[0]

    expect(overLow).toBeCloseTo(terrain.heightAt(low.x, low.z), 0)
    expect(overHigh).toBeCloseTo(terrain.heightAt(high.x, high.z), 0)
  })

  it('follows a slope instead of slicing through it', () => {
    // A flat disc buries half of itself in any slope worth landing on, and
    // slopes are exactly where the interesting landings are.
    const shadow = new GroundShadow(terrain)
    let steepest = { x: 0, z: 0, slope: 0 }
    for (let x = -300; x <= 300; x += 20) {
      for (let z = -300; z <= 300; z += 20) {
        const slope = terrain.slopeAt(x, z)
        if (slope > steepest.slope) steepest = { x, z, slope }
      }
    }
    expect(steepest.slope).toBeGreaterThan(0.4)

    shadow.update(steepest.x, steepest.z, 4)
    const heights = ring(shadow)
    // The rim is at a spread of heights, because the ground is.
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(1)
    // And every vertex is just clear of the ground it is over, never through it.
    const position = shadow.mesh.geometry.attributes.position
    for (let i = 0; i < position.count; i++) {
      const under = terrain.heightAt(steepest.x + position.getX(i), steepest.z + position.getZ(i))
      const clearance = position.getY(i) - under
      expect(clearance).toBeGreaterThan(0)
      expect(clearance).toBeLessThan(0.5)
    }
  })

  it('spreads and fades as the helicopter climbs — which is the point of it', () => {
    const shadow = new GroundShadow(terrain)
    const measure = (altitude: number) => {
      shadow.update(0, 0, altitude)
      const position = shadow.mesh.geometry.attributes.position
      let widest = 0
      for (let i = 0; i < position.count; i++) {
        widest = Math.max(widest, Math.hypot(position.getX(i), position.getZ(i)))
      }
      return { width: widest, dark: (shadow.mesh.material as THREE.MeshBasicMaterial).opacity }
    }

    const skids = measure(0)
    const low = measure(20)
    const high = measure(60)
    expect(low.width).toBeGreaterThan(skids.width)
    expect(high.width).toBeGreaterThan(low.width)
    expect(low.dark).toBeLessThan(skids.dark)
    expect(high.dark).toBeLessThan(low.dark)
    expect(skids.dark).toBeGreaterThan(0.2)
  })

  it('goes away entirely once it would mean nothing', () => {
    const shadow = new GroundShadow(terrain)
    shadow.update(0, 0, 5)
    expect(shadow.mesh.visible).toBe(true)
    shadow.update(0, 0, 400)
    expect(shadow.mesh.visible).toBe(false)
  })

  it('copes with being under the ground, which a hard landing can manage', () => {
    const shadow = new GroundShadow(terrain)
    shadow.update(0, 0, -3)
    expect(shadow.mesh.visible).toBe(true)
    expect((shadow.mesh.material as THREE.MeshBasicMaterial).opacity).toBeGreaterThan(0)
  })
})
