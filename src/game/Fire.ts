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
  constructor(readonly patches: readonly FirePatch[]) {}

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
    return new Fire(patches)
  }
}

/** Below this the helicopter is merely warm, not burning. */
const SINGEING = 0.02
/** How high the heat column reaches above the ground. */
export const COLUMN_HEIGHT = 85
