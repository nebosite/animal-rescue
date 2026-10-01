import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { FireField } from './FireField'
import { Fire } from '../game/Fire'
import { Terrain } from '../game/Terrain'

const terrain = new Terrain(420)

/**
 * Where every smoke puff is actually drawn, skipping the ones put away.
 *
 * The size is read from the matrix itself rather than through `decompose`,
 * which reports a scale of (1,1,1) for a degenerate matrix — so a slot scaled
 * to nothing comes back through it looking like a full-sized puff at the
 * origin.
 */
function shown(field: FireField): THREE.Vector3[] {
  const mesh = field.group.children.find(
    (child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh,
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
  it('draws nothing at all for a slot with no patch behind it', () => {
    // Sharing the scratch transform with the "hide it" matrix meant the first
    // puff placed each frame became the hidden matrix, so every unused slot
    // drew a copy of it stacked on one spot.
    const fire = new Fire([{ x: 0, z: 0, radius: 30, age: 0 }])
    const field = new FireField(fire, terrain)
    field.update(1)

    const lit = shown(field)
    expect(lit).toHaveLength(18)
    for (const puff of lit) expect(Math.hypot(puff.x, puff.z)).toBeLessThan(90)
  })

  it('stands a column over every patch that is burning', () => {
    const fire = new Fire([
      { x: -120, z: 0, radius: 30, age: 0 },
      { x: 120, z: 0, radius: 30, age: 0 },
    ])
    const field = new FireField(fire, terrain)
    field.update(1)
    const lit = shown(field)
    expect(lit.some((puff) => puff.x < -60)).toBe(true)
    expect(lit.some((puff) => puff.x > 60)).toBe(true)
  })

  it('rolls the smoke upward over time rather than leaving it hanging', () => {
    const fire = new Fire([{ x: 0, z: 0, radius: 30, age: 0 }])
    const field = new FireField(fire, terrain)
    field.update(0)
    const low = Math.max(...shown(field).map((puff) => puff.y))
    field.update(4)
    expect(Math.max(...shown(field).map((puff) => puff.y))).not.toBe(low)
  })

  it('keeps a patch with its own smoke when the fire retires one from the middle', () => {
    // Patches are dropped from the middle of the list as the front moves on,
    // so a slot found by array position belongs to a different patch on the
    // next frame, and the whole plume jumps sideways on the frame it happens.
    const fire = new Fire([
      { x: -200, z: -150, radius: 40, age: 59 },
      { x: 200, z: 150, radius: 40, age: 0 },
    ])
    const field = new FireField(fire, terrain)
    field.update(1)
    for (let i = 0; i < 20; i++) fire.advance(0.1)
    expect(fire.patches).toHaveLength(1)
    field.update(2)

    const lit = shown(field)
    expect(lit).toHaveLength(18)
    for (const puff of lit) {
      expect(Math.hypot(puff.x - 200, puff.z - 150)).toBeLessThan(140)
    }
  })

  it('lights the hills near the biggest fires', () => {
    const fire = new Fire([{ x: 40, z: -60, radius: 50, age: 0 }])
    const field = new FireField(fire, terrain)
    field.update(1)
    const lights = field.group.children.filter((child): child is THREE.PointLight => child instanceof THREE.PointLight)
    expect(lights.length).toBeGreaterThan(0)
    const lit = lights.filter((light) => light.visible)
    expect(lit).toHaveLength(1)
    expect(Math.hypot(lit[0].position.x - 40, lit[0].position.z + 60)).toBeLessThan(1)
  })
})
