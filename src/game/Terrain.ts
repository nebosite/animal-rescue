/** A patch of ground levelled flat, so something can be built or landed on it. */
interface FlatZone {
  x: number
  z: number
  radius: number
  /** How far past the radius the levelling blends back into the hills. */
  blend: number
  height: number
}

/**
 * The shape of the land: rolling hills, a winding canyon cut through them, and
 * flat shelves where the pads sit.
 *
 * Entirely procedural and deterministic — the same coordinates always give the
 * same height — so it is a pure function of position with no mesh, no seed
 * file, and nothing to load. The renderer samples it to build a mesh; the
 * flight model samples it to know where the ground is.
 */
export class Terrain {
  private readonly flats: FlatZone[] = []

  constructor(readonly halfSize: number) {}

  /**
   * Level a circle of ground, returning the height it settled at. Call before
   * anything samples the terrain, since it changes the shape.
   */
  levelAt(x: number, z: number, radius: number, blend = radius * 1.6): number {
    const height = this.rawHeightAt(x, z)
    this.flats.push({ x, z, radius, blend, height })
    return height
  }

  /** Ground height at a point. */
  heightAt(x: number, z: number): number {
    let height = this.rawHeightAt(x, z)
    for (const flat of this.flats) {
      const distance = Math.hypot(x - flat.x, z - flat.z)
      // 1 inside the pad, easing to 0 at the edge of the blend.
      const pull = 1 - smoothStep(flat.radius, flat.radius + flat.blend, distance)
      height += (flat.height - height) * pull
    }
    return height
  }

  /** Steepness at a point: the rise over a short step, so 1 is a 45° slope. */
  slopeAt(x: number, z: number, step = 2): number {
    const dx = this.heightAt(x + step, z) - this.heightAt(x - step, z)
    const dz = this.heightAt(x, z + step) - this.heightAt(x, z - step)
    return Math.hypot(dx, dz) / (2 * step)
  }

  /** True where the ground is flat enough to put the skids down safely. */
  isLandable(x: number, z: number): boolean {
    return this.slopeAt(x, z) <= LANDABLE_SLOPE
  }

  /** How deep in the canyon a point is, 0 on the hills and 1 on the canyon floor. */
  canyonDepthAt(x: number, z: number): number {
    const winding = noise(x / CANYON_WAVELENGTH, z / CANYON_WAVELENGTH)
    return 1 - smoothStep(0, CANYON_HALF_WIDTH, Math.abs(winding - 0.5))
  }

  /** The hills before any levelling is applied. */
  private rawHeightAt(x: number, z: number): number {
    let height = 0
    height += HILL_HEIGHT * noise(x / HILL_WAVELENGTH, z / HILL_WAVELENGTH)
    height += RIDGE_HEIGHT * noise(x / RIDGE_WAVELENGTH + 11.3, z / RIDGE_WAVELENGTH + 7.1)
    height += DETAIL_HEIGHT * noise(x / DETAIL_WAVELENGTH + 3.7, z / DETAIL_WAVELENGTH + 19.4)

    // The canyon cuts down through whatever the hills were doing.
    height -= CANYON_DEPTH * this.canyonDepthAt(x, z)

    return height
  }
}

/** Smooth 0→1 ramp between two edges. */
function smoothStep(from: number, to: number, value: number): number {
    const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
    return t * t * (3 - 2 * t)
}

/** Deterministic pseudo-random value in 0..1 for a pair of integers. */
function hash(ix: number, iz: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/** Smoothly interpolated value noise, 0..1. */
function noise(x: number, z: number): number {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const u = fx * fx * (3 - 2 * fx)
  const v = fz * fz * (3 - 2 * fz)

  const a = hash(ix, iz)
  const b = hash(ix + 1, iz)
  const c = hash(ix, iz + 1)
  const d = hash(ix + 1, iz + 1)

  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v
}

/** Slope the skids can cope with. Above this, a landing is a topple. */
export const LANDABLE_SLOPE = 0.32

const HILL_HEIGHT = 54
const HILL_WAVELENGTH = 230
const RIDGE_HEIGHT = 22
const RIDGE_WAVELENGTH = 95
const DETAIL_HEIGHT = 6
const DETAIL_WAVELENGTH = 33

const CANYON_DEPTH = 46
const CANYON_WAVELENGTH = 420
const CANYON_HALF_WIDTH = 0.07
