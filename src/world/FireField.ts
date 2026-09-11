import * as THREE from 'three'
import type { Fire } from '../game/Fire'
import type { Terrain } from '../game/Terrain'

/**
 * The fire you can see: flames licking up off the ground, a column of smoke
 * over each patch, and a few lights so the fire actually lights the hills
 * around it.
 *
 * Flames and smoke are two instanced meshes, animated by rewriting their
 * instance matrices each frame — a few hundred of each, which is cheap and
 * avoids any shader work.
 */
export class FireField {
  readonly group = new THREE.Group()

  private readonly flames: THREE.InstancedMesh
  private readonly smoke: THREE.InstancedMesh
  private readonly seeds: Array<{ x: number; z: number; ground: number; scale: number; phase: number; drift: number }> = []
  private readonly smokeSeeds: Array<{ x: number; z: number; ground: number; scale: number; phase: number }> = []
  private readonly transform = new THREE.Object3D()

  constructor(fire: Fire, terrain: Terrain) {
    // Scatter flames through each patch, thicker toward the middle.
    fire.patches.forEach((patch, patchIndex) => {
      for (let i = 0; i < FLAMES_PER_PATCH; i++) {
        // sqrt keeps the scatter even rather than crowding the centre, then a
        // bias pulls some back in so the heart of the fire looks hottest.
        const spread = Math.sqrt(random(patchIndex, i, 1)) ** 1.35
        const angle = random(patchIndex, i, 2) * Math.PI * 2
        const x = patch.x + Math.cos(angle) * spread * patch.radius
        const z = patch.z + Math.sin(angle) * spread * patch.radius
        this.seeds.push({
          x, z,
          ground: terrain.heightAt(x, z),
          scale: 0.6 + random(patchIndex, i, 3) * 1.1,
          phase: random(patchIndex, i, 4) * Math.PI * 2,
          drift: 0.6 + random(patchIndex, i, 5) * 0.8,
        })
      }

      for (let i = 0; i < SMOKE_PER_PATCH; i++) {
        const spread = Math.sqrt(random(patchIndex, i, 6))
        const angle = random(patchIndex, i, 7) * Math.PI * 2
        const x = patch.x + Math.cos(angle) * spread * patch.radius * 0.8
        const z = patch.z + Math.sin(angle) * spread * patch.radius * 0.8
        this.smokeSeeds.push({
          x, z,
          ground: terrain.heightAt(x, z),
          scale: 5 + random(patchIndex, i, 8) * 9,
          phase: random(patchIndex, i, 9),
        })
      }
    })

    this.flames = new THREE.InstancedMesh(
      // Tall enough to show above the treeline from the air; the trees are ~15.
      new THREE.ConeGeometry(2.6, 13, 6),
      // Unlit and additive: fire makes its own light rather than catching any.
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
      this.seeds.length,
    )
    const tint = new THREE.Color()
    for (let index = 0; index < this.seeds.length; index++) {
      // Cycle ember red through flame yellow so the fire is not one flat colour.
      tint.copy(EMBER).lerp(FLAME_TIP, (index % 7) / 7)
      this.flames.setColorAt(index, tint)
    }
    this.flames.frustumCulled = false

    this.smoke = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 7, 5),
      new THREE.MeshBasicMaterial({ color: SMOKE_COLOR, transparent: true, opacity: 0.14, depthWrite: false }),
      this.smokeSeeds.length,
    )
    this.smoke.frustumCulled = false

    this.group.add(this.flames, this.smoke)

    // Only the largest patches get a light: WebGL does not want dozens.
    const brightest = [...fire.patches].sort((a, b) => b.radius - a.radius).slice(0, GLOW_LIGHTS)
    for (const patch of brightest) {
      const light = new THREE.PointLight(GLOW_COLOR, 900, patch.radius * 7, 2)
      light.position.set(patch.x, terrain.heightAt(patch.x, patch.z) + 12, patch.z)
      this.group.add(light)
    }
  }

  /** Flicker the flames and roll the smoke upward. */
  update(elapsed: number): void {
    this.seeds.forEach((seed, index) => {
      // Two out-of-step waves, so the flicker never falls into a rhythm.
      const flicker = 0.72 + 0.28 * Math.sin(elapsed * 9 * seed.drift + seed.phase)
      const sway = Math.sin(elapsed * 2.4 + seed.phase) * 0.5
      const height = seed.scale * flicker
      this.transform.position.set(seed.x + sway, seed.ground + 6.2 * height, seed.z)
      this.transform.scale.set(seed.scale, height, seed.scale)
      this.transform.rotation.set(0, seed.phase, sway * 0.06)
      this.transform.updateMatrix()
      this.flames.setMatrixAt(index, this.transform.matrix)
    })
    this.flames.instanceMatrix.needsUpdate = true

    this.smokeSeeds.forEach((seed, index) => {
      // Each puff climbs, spreads and fades, then restarts from the flames.
      const life = (elapsed * SMOKE_SPEED + seed.phase) % 1
      const size = seed.scale * (0.45 + life * 1.5)
      this.transform.position.set(
        seed.x + life * seed.scale * 1.6,
        seed.ground + 6 + life * SMOKE_RISE,
        seed.z + life * seed.scale * 0.8,
      )
      this.transform.scale.setScalar(size)
      this.transform.rotation.set(0, life * 3, 0)
      this.transform.updateMatrix()
      this.smoke.setMatrixAt(index, this.transform.matrix)
    })
    this.smoke.instanceMatrix.needsUpdate = true
  }
}

/** Deterministic 0..1 from three integers, so the fire looks the same each run. */
function random(a: number, b: number, c: number): number {
  let h = Math.imul(a + 1, 0x27d4eb2d) ^ Math.imul(b + 1, 0x9e3779b1) ^ Math.imul(c + 7, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35)
  return ((h ^ (h >>> 13)) >>> 0) / 4294967295
}

const FLAMES_PER_PATCH = 46
const SMOKE_PER_PATCH = 16
const GLOW_LIGHTS = 4
const SMOKE_SPEED = 0.09
const SMOKE_RISE = 110

const EMBER = new THREE.Color(0xd23b12)
const FLAME_TIP = new THREE.Color(0xffc247)
const SMOKE_COLOR = new THREE.Color(0x2b2622)
const GLOW_COLOR = new THREE.Color(0xff7a2a)
