import * as THREE from 'three'
import { MAX_PATCHES, type Fire } from '../game/Fire'
import type { Terrain } from '../game/Terrain'

/** One flame's place within its patch, as a fraction of the radius. */
interface Ember {
  angle: number
  spread: number
  scale: number
  phase: number
  drift: number
  /** Ground under it, refreshed as the patch grows. */
  ground: number
  seededAtRadius: number
}

/**
 * The fire you can see: flames licking up off the ground, a column of smoke
 * over each patch, and a few lights so the fire actually lights the hills
 * around it.
 *
 * The fire spreads, so this cannot be built once and left. Every slot is
 * allocated up front for the most patches the fire can ever have; each frame
 * the live patches' flames are placed from their fractional offsets times the
 * patch's current radius, and unused slots are scaled to nothing. Widening a
 * patch therefore widens its fire, and a new patch simply switches on.
 */
export class FireField {
  readonly group = new THREE.Group()

  private readonly flames: THREE.InstancedMesh
  private readonly smoke: THREE.InstancedMesh
  private readonly lights: THREE.PointLight[] = []
  private readonly embers: Ember[][] = []
  private readonly puffs: Array<Array<{ angle: number; spread: number; scale: number; phase: number }>> = []
  private readonly transform = new THREE.Object3D()

  constructor(private readonly fire: Fire, private readonly terrain: Terrain) {
    for (let p = 0; p < MAX_PATCHES; p++) {
      const embers: Ember[] = []
      for (let i = 0; i < FLAMES_PER_PATCH; i++) {
        // sqrt keeps the scatter even rather than crowding the centre, then a
        // bias pulls some back in so the heart of the fire looks hottest.
        embers.push({
          angle: random(p, i, 2) * Math.PI * 2,
          spread: Math.sqrt(random(p, i, 1)) ** 1.35,
          scale: 0.6 + random(p, i, 3) * 1.1,
          phase: random(p, i, 4) * Math.PI * 2,
          drift: 0.6 + random(p, i, 5) * 0.8,
          ground: 0,
          seededAtRadius: -Infinity,
        })
      }
      this.embers.push(embers)

      const puffs = []
      for (let i = 0; i < SMOKE_PER_PATCH; i++) {
        puffs.push({
          angle: random(p, i, 7) * Math.PI * 2,
          spread: Math.sqrt(random(p, i, 6)) * 0.8,
          scale: 5 + random(p, i, 8) * 9,
          phase: random(p, i, 9),
        })
      }
      this.puffs.push(puffs)
    }

    this.flames = new THREE.InstancedMesh(
      // Tall enough to show above the treeline from the air; the trees are ~15.
      new THREE.ConeGeometry(2.6, 13, 6),
      // Unlit and additive: fire makes its own light rather than catching any.
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
      MAX_PATCHES * FLAMES_PER_PATCH,
    )
    const tint = new THREE.Color()
    for (let index = 0; index < MAX_PATCHES * FLAMES_PER_PATCH; index++) {
      // Cycle ember red through flame yellow so the fire is not one flat colour.
      tint.copy(EMBER).lerp(FLAME_TIP, (index % 7) / 7)
      this.flames.setColorAt(index, tint)
    }
    this.flames.frustumCulled = false

    this.smoke = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 7, 5),
      new THREE.MeshBasicMaterial({ color: SMOKE_COLOR, transparent: true, opacity: 0.22, depthWrite: false }),
      MAX_PATCHES * SMOKE_PER_PATCH,
    )
    this.smoke.frustumCulled = false

    this.group.add(this.flames, this.smoke)

    // Only a few patches get a light: WebGL does not want dozens.
    for (let i = 0; i < GLOW_LIGHTS; i++) {
      const light = new THREE.PointLight(GLOW_COLOR, 900, 300, 2)
      this.lights.push(light)
      this.group.add(light)
    }
  }

  /** Flicker the flames, roll the smoke upward, and follow the fire's spread. */
  update(elapsed: number): void {
    const patches = this.fire.patches
    const hidden = this.transform
    hidden.scale.setScalar(0)
    hidden.updateMatrix()

    for (let p = 0; p < MAX_PATCHES; p++) {
      const patch = patches[p]
      const embers = this.embers[p]
      const puffs = this.puffs[p]

      if (!patch) {
        for (let i = 0; i < FLAMES_PER_PATCH; i++) this.flames.setMatrixAt(p * FLAMES_PER_PATCH + i, hidden.matrix)
        for (let i = 0; i < SMOKE_PER_PATCH; i++) this.smoke.setMatrixAt(p * SMOKE_PER_PATCH + i, hidden.matrix)
        continue
      }

      embers.forEach((ember, i) => {
        const x = patch.x + Math.cos(ember.angle) * ember.spread * patch.radius
        const z = patch.z + Math.sin(ember.angle) * ember.spread * patch.radius
        // The ground under a flame only moves when the patch has grown; refresh
        // it then rather than sampling the terrain for every flame every frame.
        if (patch.radius - ember.seededAtRadius > RESEED_AFTER) {
          ember.ground = this.terrain.heightAt(x, z)
          ember.seededAtRadius = patch.radius
        }
        // Two out-of-step waves, so the flicker never falls into a rhythm.
        const flicker = 0.72 + 0.28 * Math.sin(elapsed * 9 * ember.drift + ember.phase)
        const sway = Math.sin(elapsed * 2.4 + ember.phase) * 0.5
        const height = ember.scale * flicker
        this.transform.position.set(x + sway, ember.ground + 6.2 * height, z)
        this.transform.scale.set(ember.scale, height, ember.scale)
        this.transform.rotation.set(0, ember.phase, sway * 0.06)
        this.transform.updateMatrix()
        this.flames.setMatrixAt(p * FLAMES_PER_PATCH + i, this.transform.matrix)
      })

      const ground = this.terrain.heightAt(patch.x, patch.z)
      puffs.forEach((puff, i) => {
        // Each puff climbs, spreads and fades, then restarts from the flames.
        const life = (elapsed * SMOKE_SPEED + puff.phase) % 1
        const size = puff.scale * (0.45 + life * 1.5)
        this.transform.position.set(
          patch.x + Math.cos(puff.angle) * puff.spread * patch.radius + life * puff.scale * 1.6,
          ground + 6 + life * SMOKE_RISE,
          patch.z + Math.sin(puff.angle) * puff.spread * patch.radius + life * puff.scale * 0.8,
        )
        this.transform.scale.setScalar(size)
        this.transform.rotation.set(0, life * 3, 0)
        this.transform.updateMatrix()
        this.smoke.setMatrixAt(p * SMOKE_PER_PATCH + i, this.transform.matrix)
      })
    }
    this.flames.instanceMatrix.needsUpdate = true
    this.smoke.instanceMatrix.needsUpdate = true

    // Lights sit over the largest patches, and follow them as the fire moves.
    const brightest = [...patches].sort((a, b) => b.radius - a.radius).slice(0, GLOW_LIGHTS)
    this.lights.forEach((light, i) => {
      const patch = brightest[i]
      light.visible = !!patch
      if (patch) {
        light.position.set(patch.x, this.terrain.heightAt(patch.x, patch.z) + 12, patch.z)
        light.distance = patch.radius * 7
      }
    })
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
/** Re-sample a flame's ground once its patch has grown this much. */
const RESEED_AFTER = 3

const EMBER = new THREE.Color(0xd23b12)
const FLAME_TIP = new THREE.Color(0xffc247)
const SMOKE_COLOR = new THREE.Color(0x4a4340)
const GLOW_COLOR = new THREE.Color(0xff7a2a)
