import * as THREE from 'three'
import type { Terrain } from '../game/Terrain'

/** Somewhere trees must not grow — a pad, a clearing. */
export interface Clearing {
  x: number
  z: number
  radius: number
}

/**
 * The forest: thousands of conifers as two instanced meshes, one for trunks and
 * one for canopies, so the whole wood costs two draw calls.
 *
 * Trees are scattered deterministically and rejected where they should not
 * grow — on ground too steep, above the treeline, on the canyon floor, or
 * inside a clearing — which is what leaves the map with natural landing spots
 * rather than a uniform carpet.
 */
export class Forest {
  readonly group = new THREE.Group()
  readonly count: number
  /** Where every tree ended up, for anything that needs to avoid them. */
  readonly positions: ReadonlyArray<{ x: number; z: number; radius: number }>

  constructor(terrain: Terrain, clearings: readonly Clearing[] = [], attempts = ATTEMPTS) {
    const placed: Array<{ x: number; z: number; radius: number; height: number; scale: number }> = []
    const edge = terrain.halfSize - MARGIN

    // A deterministic scatter: the same map every time, no seed to store.
    for (let i = 0; i < attempts; i++) {
      const x = (fraction(i, 1) * 2 - 1) * edge
      const z = (fraction(i, 2) * 2 - 1) * edge
      const height = terrain.heightAt(x, z)

      if (height > TREELINE) continue
      if (terrain.canyonDepthAt(x, z) > 0.55) continue
      if (terrain.slopeAt(x, z) > MAX_SLOPE) continue
      if (clearings.some((c) => Math.hypot(x - c.x, z - c.z) < c.radius)) continue

      const scale = 0.7 + fraction(i, 3) * 0.8
      placed.push({ x, z, height, scale, radius: TRUNK_RADIUS * scale * 2.2 })
    }

    this.count = placed.length
    this.positions = placed.map(({ x, z, radius }) => ({ x, z, radius }))

    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(TRUNK_RADIUS * 0.7, TRUNK_RADIUS, TRUNK_HEIGHT, 5),
      new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.95 }),
      Math.max(1, this.count),
    )
    const canopies = new THREE.InstancedMesh(
      new THREE.ConeGeometry(CANOPY_RADIUS, CANOPY_HEIGHT, 7),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
      Math.max(1, this.count),
    )

    const transform = new THREE.Object3D()
    const tint = new THREE.Color()
    placed.forEach((tree, index) => {
      transform.position.set(tree.x, tree.height + (TRUNK_HEIGHT / 2) * tree.scale, tree.z)
      transform.scale.setScalar(tree.scale)
      transform.rotation.y = fraction(index, 4) * Math.PI * 2
      transform.updateMatrix()
      trunks.setMatrixAt(index, transform.matrix)

      transform.position.y = tree.height + (TRUNK_HEIGHT * 0.85 + CANOPY_HEIGHT / 2) * tree.scale
      transform.updateMatrix()
      canopies.setMatrixAt(index, transform.matrix)

      // Vary the green so the wood does not read as one flat mass.
      tint.copy(NEEDLE_DARK).lerp(NEEDLE_LIGHT, fraction(index, 5))
      canopies.setColorAt(index, tint)
    })

    trunks.instanceMatrix.needsUpdate = true
    canopies.instanceMatrix.needsUpdate = true
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true

    // Nothing gets close enough for a tree to need per-frame culling maths.
    trunks.frustumCulled = false
    canopies.frustumCulled = false
    this.group.add(trunks, canopies)
  }
}

/**
 * A deterministic value in 0..1 for the nth tree's kth property. Cheap,
 * repeatable, and with no visible lattice at these scales.
 */
function fraction(index: number, channel: number): number {
  let h = Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(channel + 7, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35)
  return ((h ^ (h >>> 13)) >>> 0) / 4294967295
}

const ATTEMPTS = 9000
const MARGIN = 12
const TREELINE = 52
const MAX_SLOPE = 0.55

const TRUNK_RADIUS = 0.5
const TRUNK_HEIGHT = 6
const CANOPY_RADIUS = 2.6
const CANOPY_HEIGHT = 9

const NEEDLE_DARK = new THREE.Color(0x1f3a2b)
const NEEDLE_LIGHT = new THREE.Color(0x3c6b44)
