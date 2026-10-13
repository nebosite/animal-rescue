import * as THREE from 'three'

/** One splinter of a tree, thrown fast and falling. */
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
 * What flying into a treetop throws out: thin splinters of snapped branch, hurled
 * away from the rotor at speed and slowing in the air as they arc down.
 *
 * They were blocks, thrown gently, and they fell almost straight down — which
 * read as a puff of gravel, not as a rotor chewing a branch. A splinter is long
 * and thin, leaves fast, and points the way it is going.
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
  // Scratch values for aiming a splinter, kept apart from anything kept.
  private readonly heading = new THREE.Vector3()
  private readonly aim = new THREE.Quaternion()
  private readonly roll = new THREE.Quaternion()

  constructor() {
    this.bits = new THREE.InstancedMesh(
      // Long along x and hair-thin across: the length is scaled up per splinter,
      // so the thinness scales with it and they stay needles, not planks.
      new THREE.BoxGeometry(1, 0.08, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }),
      MAX_SHARDS,
    )
    this.bits.frustumCulled = false
    for (let i = 0; i < MAX_SHARDS; i++) {
      this.bits.setMatrixAt(i, this.hidden)
      // Mostly raw pale wood and dark bark, a few green, fixed per slot so a
      // burst is never all one colour.
      this.bits.setColorAt(i, this.tint.copy(PALETTE[i % PALETTE.length]))
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
      // Any direction round the strike, tilted up or down, so the burst is a
      // starburst rather than a flat ring or a fountain.
      const around = Math.random() * Math.PI * 2
      const tilt = (Math.random() - 0.35) * 1.5
      const flat = Math.cos(tilt)
      const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED)
      this.shards.push({
        x, y, z,
        vx: Math.cos(around) * flat * speed + (awayX / carry) * CARRY,
        vy: Math.sin(tilt) * speed,
        vz: Math.sin(around) * flat * speed + (awayZ / carry) * CARRY,
        spin: (Math.random() - 0.5) * 18,
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
      // Hard air drag on every axis: thrown at speed, they lose it quickly and
      // arc over into a fall, instead of coasting off to the horizon.
      const drag = Math.exp(-DRAG * dt)
      shard.vx *= drag
      shard.vy *= drag
      shard.vz *= drag
    }
    while (this.shards.length > 0 && this.shards[0].life >= 1) this.shards.shift()

    let slot = 0
    for (const shard of this.shards) {
      // Shrinking away at the end, rather than vanishing on one frame.
      const size = shard.size * (1 - smoothStep(FADE_FROM, 1, shard.life))
      this.transform.position.set(shard.x, shard.y, shard.z)
      // Point along the flight, so it flies like a thrown stick; the spin is
      // about its own length, which reads as a splinter turning end over end
      // without ever tumbling sideways like a block.
      this.heading.set(shard.vx, shard.vy, shard.vz)
      if (this.heading.lengthSq() > 1e-6) this.aim.setFromUnitVectors(ALONG, this.heading.normalize())
      this.roll.setFromAxisAngle(ALONG, shard.life * shard.spin)
      this.transform.quaternion.copy(this.aim).multiply(this.roll)
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

const ALONG = new THREE.Vector3(1, 0, 0)
const PALETTE = [
  new THREE.Color(0xd8b97a), // raw pale wood
  new THREE.Color(0xc29a5b),
  new THREE.Color(0x7b4f2d), // bark
  new THREE.Color(0xd8b97a),
  new THREE.Color(0x3f9a4a), // a needle or two
]

/** How many splinters one strike throws, and how many may be in the air at once. */
const PER_BURST = 18
const MAX_SHARDS = 180
const SECONDS = 1.2
/** Where the fade to nothing starts, as a fraction of a shard's life. */
const FADE_FROM = 0.55
/** Length of a splinter, in metres; it is about a twelfth as thick. */
const MIN_SIZE = 1.3
const MAX_SIZE = 3.4
/** How fast a strike throws splinters at the start, and the drift along the flight path. */
const MIN_SPEED = 32
const MAX_SPEED = 62
const CARRY = 7
const GRAVITY = 24
const DRAG = 2.4
