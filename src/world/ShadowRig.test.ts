import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { ShadowRig } from './ShadowRig'

function rig(): { sun: THREE.DirectionalLight; rig: ShadowRig } {
  const sun = new THREE.DirectionalLight(0xffffff, 1)
  sun.position.set(180, 420, 120)
  return { sun, rig: new ShadowRig(sun, 100, 1024) }
}

describe('ShadowRig', () => {
  it('turns the sun into a shadow caster covering a box around the player', () => {
    const { sun } = rig()
    expect(sun.castShadow).toBe(true)
    expect(sun.shadow.camera.right).toBe(100)
    expect(sun.shadow.mapSize.x).toBe(1024)
  })

  it('moves the sun with the focus, keeping it the same distance and direction away', () => {
    const { sun, rig: shadows } = rig()
    const dir = shadows.direction.clone()
    shadows.follow(50, 10, -30)
    const offset = sun.position.clone().sub(sun.target.position)
    expect(offset.length()).toBeCloseTo(400, 3)
    expect(offset.clone().normalize().distanceTo(dir)).toBeLessThan(1e-6)
    expect(sun.target.position.distanceTo(new THREE.Vector3(50, 10, -30))).toBeLessThan(0.25)
  })

  it('moves in whole texels, so shadow edges do not crawl', () => {
    const { sun, rig: shadows } = rig()
    const texel = 200 / 1024
    const across = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), shadows.direction).normalize()
    shadows.follow(12.3456, 7, 3.21)
    const a = sun.target.position.dot(across)
    shadows.follow(12.3456 + 0.01, 7, 3.21)
    const b = sun.target.position.dot(across)
    expect(b).toBeCloseTo(a, 6) // a hundredth of a unit is not a texel
    expect(Math.abs(a / texel - Math.round(a / texel))).toBeLessThan(1e-6)
  })

  it('can be aimed somewhere else as the day goes on', () => {
    const { sun, rig: shadows } = rig()
    shadows.setDirection(new THREE.Vector3(1, 0.3, 0))
    shadows.follow(0, 0, 0)
    expect(sun.position.y).toBeCloseTo(400 * (0.3 / Math.hypot(1, 0.3)), 3)
  })
})
