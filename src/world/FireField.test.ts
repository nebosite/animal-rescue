import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { FireField } from './FireField'
import { Fire, MAX_PATCHES } from '../game/Fire'
import { Terrain } from '../game/Terrain'

const terrain = new Terrain(420)

/**
 * Where every flame slot is actually drawn, skipping the ones put away.
 *
 * The size is read from the matrix itself rather than through `decompose`,
 * which reports a scale of (1,1,1) for a degenerate matrix — so a slot scaled
 * to nothing comes back through it looking like a full-sized flame at the
 * origin.
 */
function shown(field: FireField): THREE.Vector3[] {
  const mesh = field.group.children.find(
    (child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh && child.count > MAX_PATCHES * 20,
  )!
  const out: THREE.Vector3[] = []
  const matrix = new THREE.Matrix4()
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix)
    const te = matrix.elements
    const sizeSq = te[0] ** 2 + te[1] ** 2 + te[2] ** 2 + te[4] ** 2 + te[5] ** 2 + te[6] ** 2
    if (sizeSq < 1e-6) continue
    out.push(new THREE.Vector3(te[12], te[13], te[14]))
  }
  return out
}

describe('FireField', () => {
  it('draws no flame at all for a slot with no patch behind it', () => {
    // One patch, so all but the first slot-full of flames have nothing to draw.
    const fire = new Fire([{ x: 0, z: 0, radius: 30, age: 0 }])
    const field = new FireField(fire, terrain)
    field.update(1)

    // Sharing the scratch transform with the "hide it" matrix meant the first
    // flame placed each frame became the hidden matrix, so every unused slot
    // drew a copy of it stacked on one spot — a bright knot in the fire that
    // never moved and belonged to no patch.
    const lit = shown(field)
    expect(lit).toHaveLength(46)
    for (const flame of lit) {
      expect(Math.hypot(flame.x, flame.z)).toBeLessThanOrEqual(35)
    }
  })

  it('never stacks flames on one spot', () => {
    const fire = new Fire([{ x: 0, z: 0, radius: 30, age: 0 }])
    const field = new FireField(fire, terrain)
    field.update(1)

    const places = new Map<string, number>()
    for (const flame of shown(field)) {
      const key = `${flame.x.toFixed(1)},${flame.z.toFixed(1)}`
      places.set(key, (places.get(key) ?? 0) + 1)
    }
    expect(Math.max(...places.values())).toBeLessThan(4)
  })

  it('puts no flame on ground the fire has already burnt through', () => {
    // Two heavily overlapping patches, the first old enough to be hollow: the
    // younger one's ring runs straight across the older one's dead middle.
    const fire = new Fire([
      { x: 0, z: 0, radius: 60, age: 400 },
      { x: 20, z: 0, radius: 60, age: 0 },
    ])
    const field = new FireField(fire, terrain)
    field.update(1)

    const lit = shown(field)
    expect(lit.length).toBeGreaterThan(10)
    for (const flame of lit) expect(fire.isBurntOut(flame.x, flame.z)).toBe(false)
  })

  it('still shows a young patch burning right through its middle', () => {
    const fire = new Fire([{ x: 0, z: 0, radius: 40, age: 0 }])
    const field = new FireField(fire, terrain)
    field.update(1)

    const lit = shown(field)
    expect(lit.length).toBeGreaterThan(20)
    expect(lit.some((flame) => Math.hypot(flame.x, flame.z) < 12)).toBe(true)
  })

  it('keeps the flames of an old patch out in a ring at its edge', () => {
    const fire = new Fire([{ x: 0, z: 0, radius: 60, age: 400 }])
    const field = new FireField(fire, terrain)
    field.update(1)

    const lit = shown(field)
    expect(lit.length).toBeGreaterThan(20)
    for (const flame of lit) {
      // Inside the hollow there should be nothing; sway moves a flame a little.
      expect(Math.hypot(flame.x, flame.z)).toBeGreaterThan(30)
    }
  })
})
