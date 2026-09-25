import * as THREE from 'three'

/** One load of water, falling and spreading. */
interface Drop {
  x: number
  y: number
  z: number
  ground: number
  radius: number
  /** 0 just released, 1 finished. */
  life: number
}

/**
 * Water leaving the belly tank: a falling curtain that spreads into a sheet
 * when it lands, then soaks away.
 *
 * A pool of instances is allocated once and reused, so a drop costs nothing
 * to start and there is no garbage to collect mid-flight.
 */
export class WaterDrop {
  readonly group = new THREE.Group()

  private readonly drops: Drop[] = []
  private readonly blobs: THREE.InstancedMesh
  private readonly transform = new THREE.Object3D()

  constructor() {
    this.blobs = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshStandardMaterial({
        color: 0x7fc9f2,
        transparent: true,
        opacity: 0.6,
        roughness: 0.2,
        depthWrite: false,
      }),
      MAX_DROPS * BLOBS_PER_DROP,
    )
    this.blobs.frustumCulled = false
    this.group.add(this.blobs)
  }

  /** Let a load go from here, to land on ground at `ground`. */
  release(x: number, y: number, z: number, ground: number, radius: number): void {
    if (this.drops.length >= MAX_DROPS) this.drops.shift()
    this.drops.push({ x, y, z, ground, radius, life: 0 })
  }

  update(dt: number): void {
    for (const drop of this.drops) drop.life += dt / DROP_SECONDS
    while (this.drops.length > 0 && this.drops[0].life >= 1) this.drops.shift()

    const hidden = this.transform
    hidden.scale.setScalar(0)
    hidden.updateMatrix()

    let slot = 0
    for (const drop of this.drops) {
      // First half falling, second half spreading out across the ground.
      const falling = Math.min(1, drop.life * 2)
      const spreading = Math.max(0, drop.life * 2 - 1)
      const height = drop.y + (drop.ground - drop.y) * falling * falling

      for (let i = 0; i < BLOBS_PER_DROP; i++, slot++) {
        const angle = (i / BLOBS_PER_DROP) * Math.PI * 2
        const out = spreading * drop.radius * (0.4 + (i % 3) * 0.3)
        this.transform.position.set(
          drop.x + Math.cos(angle) * out,
          height + (1 - falling) * (i % 4) * 2.5,
          drop.z + Math.sin(angle) * out,
        )
        const size = (2.6 + (i % 3)) * (1 - spreading * 0.5)
        this.transform.scale.set(size, size * (1 - spreading * 0.75), size)
        this.transform.updateMatrix()
        this.blobs.setMatrixAt(slot, this.transform.matrix)
      }
    }
    for (; slot < MAX_DROPS * BLOBS_PER_DROP; slot++) this.blobs.setMatrixAt(slot, hidden.matrix)
    this.blobs.instanceMatrix.needsUpdate = true
  }
}

const MAX_DROPS = 4
const BLOBS_PER_DROP = 14
const DROP_SECONDS = 1.9
