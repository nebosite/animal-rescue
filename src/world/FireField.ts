import * as THREE from 'three'
import { MAX_PATCHES, type Fire } from '../game/Fire'
import type { Terrain } from '../game/Terrain'

/**
 * The smoke over the fire, and the light it throws on the hills.
 *
 * The flame itself is not here: `FireParticles` lifts it off the burning
 * branches as sparks. This drew it with cones once, and from the air a mature
 * front looked like a field of traffic cones — a cone is a hard silhouette and
 * fire has none, so no amount of flicker, colour or stacking fixed it. What is
 * left are the two things cones were never doing anyway: the column of smoke
 * that tells you where the fire is from the far side of the map, and a handful
 * of lights so the ground near it is actually lit by it.
 *
 * Every patch gets a slot from an id-keyed map with a free list. The fire
 * retires patches from the middle of its list as the front moves on, so a slot
 * found by a patch's position in the array belongs to a different patch the
 * next frame, and the whole plume jumps sideways on the frame it happens.
 */
export class FireField {
  readonly group = new THREE.Group()

  private readonly smoke: THREE.InstancedMesh
  private readonly lights: THREE.PointLight[] = []
  private readonly puffs: Array<Array<{ angle: number; spread: number; scale: number; phase: number }>> = []
  private readonly transform = new THREE.Object3D()
  /** Which slot each live patch is drawn in, and which slots are spare. */
  private readonly slotOf = new Map<number, number>()
  private readonly spare: number[] = []
  private readonly alive = new Set<number>()
  /**
   * Where a slot goes when there is nothing for it to draw. Its own matrix,
   * not the scratch one: sharing them meant the first puff placed each frame
   * overwrote it, and every unused slot then drew a copy of that puff stacked
   * on the same spot.
   */
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0)

  constructor(private readonly fire: Fire, private readonly terrain: Terrain) {
    for (let p = 0; p < MAX_PATCHES; p++) {
      this.spare.push(p)
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

    this.smoke = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 7, 5),
      // Thin, and plenty of it. A thick puff is a grey polygon with visible
      // edges; the same smoke at a fraction of the opacity, piled up, is a
      // column you can see from the far side of the map.
      new THREE.MeshBasicMaterial({ color: SMOKE_COLOR, transparent: true, opacity: 0.075, depthWrite: false }),
      MAX_PATCHES * SMOKE_PER_PATCH,
    )
    this.smoke.frustumCulled = false
    for (let index = 0; index < MAX_PATCHES * SMOKE_PER_PATCH; index++) {
      this.smoke.setMatrixAt(index, this.hidden)
    }
    this.group.add(this.smoke)

    // Only a few patches get a light: WebGL does not want dozens.
    for (let i = 0; i < GLOW_LIGHTS; i++) {
      const light = new THREE.PointLight(GLOW_COLOR, 900, 300, 2)
      this.lights.push(light)
      this.group.add(light)
    }
  }

  /** Roll the smoke upward and follow the fire as it spreads. */
  update(elapsed: number): void {
    const patches = this.fire.patches
    this.allocate()

    for (const patch of patches) {
      const slot = this.slotOf.get(patch.id)
      if (slot !== undefined) this.drawSmoke(slot, patch, elapsed)
    }
    this.smoke.instanceMatrix.needsUpdate = true

    // Lights sit over the largest patches, and follow them as the fire moves.
    const brightest = [...patches].sort((a, b) => b.radius - a.radius).slice(0, GLOW_LIGHTS)
    this.lights.forEach((light, i) => {
      const patch = brightest[i]
      light.visible = !!patch
      if (patch) {
        light.position.set(patch.x, this.terrain.heightAt(patch.x, patch.z) + 14, patch.z)
        light.distance = patch.radius * 7
      }
    })
  }

  /** Hand every live patch a slot, and take back the slots of dead ones. */
  private allocate(): void {
    this.alive.clear()
    for (const patch of this.fire.patches) this.alive.add(patch.id)

    for (const [id, slot] of this.slotOf) {
      if (this.alive.has(id)) continue
      this.slotOf.delete(id)
      this.spare.push(slot)
      for (let i = 0; i < SMOKE_PER_PATCH; i++) this.smoke.setMatrixAt(slot * SMOKE_PER_PATCH + i, this.hidden)
    }

    for (const patch of this.fire.patches) {
      if (this.slotOf.has(patch.id)) continue
      const slot = this.spare.pop()
      if (slot === undefined) return
      this.slotOf.set(patch.id, slot)
    }
  }

  private drawSmoke(slot: number, patch: { x: number; z: number; radius: number }, elapsed: number): void {
    const puffs = this.puffs[slot]
    const ground = this.terrain.heightAt(patch.x, patch.z)
    for (let i = 0; i < puffs.length; i++) {
      const puff = puffs[i]
      // Each puff climbs, spreads and fades, then restarts from the flames.
      const life = (elapsed * SMOKE_SPEED + puff.phase) % 1
      const size = puff.scale * (0.45 + life * 1.6)
      this.transform.position.set(
        patch.x + Math.cos(puff.angle) * puff.spread * patch.radius + life * puff.scale * 1.8,
        ground + 8 + life * SMOKE_RISE,
        patch.z + Math.sin(puff.angle) * puff.spread * patch.radius + life * puff.scale * 0.9,
      )
      this.transform.scale.setScalar(size)
      this.transform.rotation.set(0, life * 3, 0)
      this.transform.updateMatrix()
      this.smoke.setMatrixAt(slot * SMOKE_PER_PATCH + i, this.transform.matrix)
    }
  }
}

/** Deterministic 0..1 from three integers, so the smoke looks the same each run. */
function random(a: number, b: number, c: number): number {
  let h = Math.imul(a + 1, 0x27d4eb2d) ^ Math.imul(b + 1, 0x9e3779b1) ^ Math.imul(c + 7, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35)
  return ((h ^ (h >>> 13)) >>> 0) / 4294967295
}

const SMOKE_PER_PATCH = 18
const GLOW_LIGHTS = 4
const SMOKE_SPEED = 0.09
const SMOKE_RISE = 125

const SMOKE_COLOR = new THREE.Color(0x3b3532)
const GLOW_COLOR = new THREE.Color(0xff7a2a)
