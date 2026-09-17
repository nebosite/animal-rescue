/** One burning patch of forest. */
export interface FirePatch {
  x: number
  z: number
  radius: number
}

/**
 * The forest fire: a front of burning patches, and the column of heat and
 * smoke standing over each one.
 *
 * It is a hazard to the machine, never to anything alive — nothing is hurt on
 * screen. Flying into it wrecks the paint, the rotor and eventually the
 * airframe, and that is the whole of its violence.
 *
 * Pure geometry, no renderer: the flight loop asks how hot a point is, and the
 * visuals ask the same question to decide where to draw flames.
 */
export class Fire {
  /** How long the fire has been burning, seconds. */
  age = 0
  /** Which way the wind is pushing the front, as a unit vector. */
  readonly spread: { x: number; z: number }

  private readonly live: FirePatch[]
  private sinceSpawn = 0
  private spawned = 0

  constructor(patches: readonly FirePatch[], spread: { x: number; z: number } = { x: 0, z: -1 }) {
    this.live = patches.map((patch) => ({ ...patch }))
    const length = Math.hypot(spread.x, spread.z) || 1
    this.spread = { x: spread.x / length, z: spread.z / length }
  }

  get patches(): readonly FirePatch[] {
    return this.live
  }

  /** Start a fresh patch burning — a spot fire, or a test's blaze. */
  addPatch(patch: FirePatch): void {
    if (this.live.length >= MAX_PATCHES) return
    this.live.push({ ...patch })
  }

  /**
   * Let the fire grow: every patch widens toward its limit, and every so often
   * a new patch catches downwind of an old one, so the front creeps across the
   * country toward wherever the animals are waiting. Deterministic, so the
   * same map always burns the same way and can be learned.
   */
  advance(dt: number): void {
    this.age += dt
    for (const patch of this.live) {
      patch.radius = Math.min(MAX_RADIUS, patch.radius + GROWTH_PER_SECOND * dt)
    }

    this.sinceSpawn += dt
    while (this.sinceSpawn >= SPAWN_EVERY && this.live.length < MAX_PATCHES) {
      this.sinceSpawn -= SPAWN_EVERY
      this.ignite()
    }
  }

  /** A new patch catches at the downwind edge of an existing one. */
  private ignite(): void {
    const parent = this.live[this.spawned % this.live.length]
    const jitter = (hash(this.spawned, 1) - 0.5) * SPREAD_CONE
    const cos = Math.cos(jitter)
    const sin = Math.sin(jitter)
    const dirX = this.spread.x * cos - this.spread.z * sin
    const dirZ = this.spread.x * sin + this.spread.z * cos
    const radius = MIN_NEW_RADIUS + hash(this.spawned, 2) * (MAX_RADIUS * 0.5 - MIN_NEW_RADIUS)
    const reach = parent.radius * 0.85 + radius * 0.6
    this.live.push({ x: parent.x + dirX * reach, z: parent.z + dirZ * reach, radius })
    this.spawned += 1
  }

  /**
   * How fiercely a point is burning, 0 outside the fire and 1 at the heart of
   * a patch. Overlapping patches do not stack past 1.
   */
  intensityAt(x: number, z: number): number {
    let hottest = 0
    for (const patch of this.patches) {
      const distance = Math.hypot(x - patch.x, z - patch.z)
      if (distance >= patch.radius) continue
      // Hottest in the middle, easing to nothing at the rim.
      const closeness = 1 - distance / patch.radius
      hottest = Math.max(hottest, closeness * closeness * (3 - 2 * closeness))
    }
    return hottest
  }

  /**
   * How much heat the helicopter is taking, 0..1. The column thins with
   * height, so climbing over the fire is a real option — and a real decision,
   * because the top of the column is a long way up.
   */
  heatAt(x: number, z: number, altitudeAboveGround: number): number {
    const intensity = this.intensityAt(x, z)
    if (intensity <= 0) return 0
    const height = Math.max(0, altitudeAboveGround)
    if (height >= COLUMN_HEIGHT) return 0
    const thinning = 1 - height / COLUMN_HEIGHT
    return intensity * thinning * thinning
  }

  /** Is this point somewhere the helicopter is actively being damaged? */
  isBurning(x: number, z: number, altitudeAboveGround: number): boolean {
    return this.heatAt(x, z, altitudeAboveGround) > SINGEING
  }

  /** Distance to the nearest flame, for warning the pilot before it hurts. */
  distanceToNearest(x: number, z: number): number {
    let nearest = Infinity
    for (const patch of this.patches) {
      nearest = Math.min(nearest, Math.hypot(x - patch.x, z - patch.z) - patch.radius)
    }
    return Math.max(0, nearest)
  }

  /**
   * Lay a fire front across the country between two points, offset to one side
   * so there is always a way round as well as a way over. Deterministic, so
   * the same map always burns in the same place.
   */
  static frontBetween(
    from: { x: number; z: number },
    to: { x: number; z: number },
    options: { patches?: number; spread?: number; radius?: number; offset?: number } = {},
  ): Fire {
    const count = options.patches ?? 9
    const spread = options.spread ?? 150
    const radius = options.radius ?? 44
    const offset = options.offset ?? 70

    const midX = (from.x + to.x) / 2
    const midZ = (from.z + to.z) / 2
    // Along the line between the pads, and the perpendicular to it.
    const length = Math.hypot(to.x - from.x, to.z - from.z) || 1
    const alongX = (to.x - from.x) / length
    const alongZ = (to.z - from.z) / length
    const acrossX = -alongZ
    const acrossZ = alongX

    const patches: FirePatch[] = []
    for (let i = 0; i < count; i++) {
      // -1..1 across the front.
      const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1
      const wander = Math.sin(i * 2.399) * 26
      const centreX = midX + acrossX * t * spread + alongX * (offset + wander)
      const centreZ = midZ + acrossZ * t * spread + alongZ * (offset + wander)
      // Thickest in the middle of the front, tapering at its ends.
      const size = radius * (0.6 + 0.4 * Math.cos((t * Math.PI) / 2))
      patches.push({ x: centreX, z: centreZ, radius: size })
    }
    // The wind blows on toward the far end, so the fire chases the animals.
    return new Fire(patches, { x: alongX, z: alongZ })
  }
}

/** Deterministic 0..1 for the nth ignition's kth property. */
function hash(index: number, channel: number): number {
  let h = Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(channel + 3, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35)
  return ((h ^ (h >>> 13)) >>> 0) / 4294967295
}

/** Below this the helicopter is merely warm, not burning. */
const SINGEING = 0.02
/** How high the heat column reaches above the ground. */
export const COLUMN_HEIGHT = 85

/** A patch widens by this much a second until it hits the limit. */
const GROWTH_PER_SECOND = 0.35
const MAX_RADIUS = 64
const MIN_NEW_RADIUS = 22
/** Seconds between new patches catching. */
const SPAWN_EVERY = 14
/** The drawing pre-allocates for this many; the fire never exceeds it. */
export const MAX_PATCHES = 30
/** How far off the wind a new patch may catch, radians, total width. */
const SPREAD_CONE = 1.7
