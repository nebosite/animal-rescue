import * as THREE from 'three'

/** One piece of a tree, thrown and falling. */
interface Shard {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  spin: number
  size: number
  /** 0 just thrown, 1 gone. */
  life: number
}

/**
 * What flying into a treetop throws out: a burst of needles, bark and snapped
 * branch, tumbling away from the rotor and falling.
 *
 * Hitting a tree used to cost paint and produce a noise, and nothing whatever
 * happened on screen — so the most common mistake in the game was also the
 * least legible one. A pool of shards is allocated once and reused, so a strike
 * costs nothing to start and there is no garbage mid-flight.
 */
export class Debris {
  readonly group = new THREE.Group()

  private readonly shards: Shard[] = []
  private readonly bits: THREE.InstancedMesh
  private readonly transform = new THREE.Object3D()
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0)
  private readonly tint = new THREE.Color()

  constructor() {
    this.bits = new THREE.InstancedMesh(
      // Flat slivers rather than cubes: they catch the light as they tumble
      // and read as needles and bark rather than as gravel.
      new THREE.BoxGeometry(1, 0.22, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }),
      MAX_SHARDS,
    )
    this.bits.frustumCulled = false
    for (let i = 0; i < MAX_SHARDS; i++) {
      this.bits.setMatrixAt(i, this.hidden)
      // A mix of green needle and brown bark, fixed per slot so a burst is
      // never all one colour.
      this.bits.setColorAt(i, this.tint.copy(NEEDLE).lerp(BARK, (i % 5) / 4))
    }
    this.group.add(this.bits)
  }

  /**
   * Knock a burst out of a tree at this point. `awayX`/`awayZ` is roughly the
   * direction the helicopter is travelling, so the spray goes with it rather
   * than appearing as a tidy symmetrical puff.
   */
  burst(x: number, y: number, z: number, awayX: number, awayZ: number): void {
    const carry = Math.hypot(awayX, awayZ) || 1
    for (let i = 0; i < PER_BURST; i++) {
      if (this.shards.length >= MAX_SHARDS) this.shards.shift()
      const around = Math.random() * Math.PI * 2
      const out = THROW * (0.4 + Math.random() * 0.9)
      this.shards.push({
        x, y, z,
        vx: Math.cos(around) * out + (awayX / carry) * CARRY,
        vy: LIFT * (0.3 + Math.random()),
        vz: Math.sin(around) * out + (awayZ / carry) * CARRY,
        spin: (Math.random() - 0.5) * 14,
        size: MIN_SIZE + Math.random() * (MAX_SIZE - MIN_SIZE),
        life: 0,
      })
    }
  }

  /** Call every frame. */
  update(dt: number): void {
    for (const shard of this.shards) {
      shard.life += dt / SECONDS
      shard.vy -= GRAVITY * dt
      shard.x += shard.vx * dt
      shard.y += shard.vy * dt
      shard.z += shard.vz * dt
      // Air drag, so they slow and flutter down rather than flying off flat.
      const drag = Math.exp(-DRAG * dt)
      shard.vx *= drag
      shard.vz *= drag
    }
    while (this.shards.length > 0 && this.shards[0].life >= 1) this.shards.shift()

    let slot = 0
    for (const shard of this.shards) {
      // Shrinking away at the end, rather than vanishing on one frame.
      const size = shard.size * (1 - smoothStep(FADE_FROM, 1, shard.life))
      this.transform.position.set(shard.x, shard.y, shard.z)
      this.transform.rotation.set(shard.life * shard.spin, shard.life * shard.spin * 0.6, shard.life * shard.spin * 1.3)
      this.transform.scale.setScalar(size)
      this.transform.updateMatrix()
      this.bits.setMatrixAt(slot++, this.transform.matrix)
    }
    for (; slot < MAX_SHARDS; slot++) this.bits.setMatrixAt(slot, this.hidden)
    this.bits.instanceMatrix.needsUpdate = true
  }
}

function smoothStep(from: number, to: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

const NEEDLE = new THREE.Color(0x3f9a4a)
const BARK = new THREE.Color(0x7b4f2d)

/** How many pieces one strike throws, and how many may be in the air at once. */
const PER_BURST = 16
const MAX_SHARDS = 160
const SECONDS = 1.5
/** Where the fade to nothing starts, as a fraction of a shard's life. */
const FADE_FROM = 0.55
const MIN_SIZE = 0.5
const MAX_SIZE = 1.5
/** How hard a strike throws pieces sideways, up, and along the flight path. */
const THROW = 11
const LIFT = 9
const CARRY = 7
const GRAVITY = 26
const DRAG = 1.4
