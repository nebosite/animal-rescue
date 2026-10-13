import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { Debris } from './Debris'

/** The instanced mesh the splinters are drawn with. */
function meshOf(debris: Debris): THREE.InstancedMesh {
  return debris.group.children[0] as THREE.InstancedMesh
}

/** Where slot `i` is, which way its long axis points, and whether anything is drawn there. */
function slot(mesh: THREE.InstancedMesh, i: number) {
  const m = new THREE.Matrix4()
  mesh.getMatrixAt(i, m)
  const e = m.elements
  return {
    position: new THREE.Vector3(e[12], e[13], e[14]),
    long: new THREE.Vector3(e[0], e[1], e[2]),
    drawn: Math.abs(e[0]) + Math.abs(e[1]) + Math.abs(e[2]) > 1e-6,
  }
}

const STRIKE = new THREE.Vector3(0, 10, 0)

describe('Debris', () => {
  it('throws splinters, and nothing else is drawn', () => {
    const debris = new Debris()
    debris.burst(STRIKE.x, STRIKE.y, STRIKE.z, 0, 0)
    debris.update(0.02)
    const mesh = meshOf(debris)
    const drawn = Array.from({ length: mesh.count }, (_, i) => slot(mesh, i)).filter((s) => s.drawn)
    expect(drawn.length).toBeGreaterThan(8)
    expect(drawn.length).toBeLessThan(40)
  })

  it('is thin: long along one axis and a twelfth of that across', () => {
    const geometry = meshOf(new Debris()).geometry
    geometry.computeBoundingBox()
    const size = geometry.boundingBox!.getSize(new THREE.Vector3())
    expect(size.y).toBeLessThanOrEqual(size.x * 0.1)
    expect(size.z).toBeLessThanOrEqual(size.x * 0.1)
  })

  it('leaves the strike fast, not drifting off gently', () => {
    // The blocks it replaced moved about half a metre in the first fraction of a
    // second and then fell straight down.
    const debris = new Debris()
    debris.burst(STRIKE.x, STRIKE.y, STRIKE.z, 0, 0)
    debris.update(0.05)
    const mesh = meshOf(debris)
    const away = Array.from({ length: mesh.count }, (_, i) => slot(mesh, i))
      .filter((s) => s.drawn)
      .map((s) => s.position.distanceTo(STRIKE))
    expect(Math.min(...away)).toBeGreaterThan(1.2)
  })

  it('slows quickly in the air, so it arcs over instead of coasting away', () => {
    const debris = new Debris()
    debris.burst(STRIKE.x, STRIKE.y, STRIKE.z, 0, 0)
    const reach = (seconds: number) => {
      for (let t = 0; t < seconds; t += 0.02) debris.update(0.02)
      const mesh = meshOf(debris)
      return Math.max(...Array.from({ length: mesh.count }, (_, i) => slot(mesh, i))
        .filter((s) => s.drawn)
        .map((s) => Math.hypot(s.position.x - STRIKE.x, s.position.z - STRIKE.z)))
    }
    const early = reach(0.2)
    const late = reach(0.4) - early
    // It travelled a long way at first, and much less in the next stretch.
    expect(early).toBeGreaterThan(5)
    expect(late).toBeLessThan(early)
  })

  it('points each splinter the way it is flying', () => {
    // Close to the strike, the direction it has moved in is the direction it was
    // thrown, and the long axis should lie along it.
    const debris = new Debris()
    debris.burst(STRIKE.x, STRIKE.y, STRIKE.z, 0, 0)
    debris.update(0.02)
    const mesh = meshOf(debris)
    for (let i = 0; i < mesh.count; i++) {
      const s = slot(mesh, i)
      if (!s.drawn) continue
      const flown = s.position.clone().sub(STRIKE).normalize()
      expect(Math.abs(s.long.clone().normalize().dot(flown))).toBeGreaterThan(0.9)
    }
  })

  it('throws in every direction, not only along the flight path', () => {
    const debris = new Debris()
    debris.burst(STRIKE.x, STRIKE.y, STRIKE.z, 1, 0)
    debris.update(0.1)
    const mesh = meshOf(debris)
    const out = Array.from({ length: mesh.count }, (_, i) => slot(mesh, i))
      .filter((s) => s.drawn)
      .map((s) => s.position.clone().sub(STRIKE))
    expect(out.some((d) => d.z > 1)).toBe(true)
    expect(out.some((d) => d.z < -1)).toBe(true)
    expect(out.some((d) => d.y > 1)).toBe(true)
  })

  it('clears away entirely once they have fallen', () => {
    const debris = new Debris()
    debris.burst(STRIKE.x, STRIKE.y, STRIKE.z, 0, 0)
    for (let t = 0; t < 2; t += 0.05) debris.update(0.05)
    const mesh = meshOf(debris)
    expect(Array.from({ length: mesh.count }, (_, i) => slot(mesh, i)).some((s) => s.drawn)).toBe(false)
  })
})
