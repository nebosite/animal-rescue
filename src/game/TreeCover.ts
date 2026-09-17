import type { Terrain } from './Terrain'

/** One tree: where it stands, how big, and how tall its canopy reaches. */
export interface Tree {
  x: number
  z: number
  /** Ground height at its foot. */
  ground: number
  scale: number
  /** World height of the top of its canopy. */
  top: number
  /** Horizontal radius that counts as a strike. */
  radius: number
}

/** Somewhere trees must not grow — a pad, a clearing. */
export interface Clearing {
  x: number
  z: number
  radius: number
}

/**
 * Where the forest actually is, and what it costs to fly into it.
 *
 * This is the authority on tree positions — `Forest` in the world layer only
 * draws what this decides — so collision can be reasoned about and tested with
 * no renderer at all.
 *
 * Lookups go through a coarse grid, because asking "am I in a tree" of several
 * thousand trees every frame is otherwise the most expensive thing in the game.
 */
export class TreeCover {
  readonly trees: readonly Tree[]
  private readonly cells = new Map<string, Tree[]>()

  constructor(terrain: Terrain, clearings: readonly Clearing[] = [], attempts = ATTEMPTS) {
    const trees: Tree[] = []
    const edge = terrain.halfSize - MARGIN

    // A deterministic scatter: the same forest every time, no seed to store.
    for (let i = 0; i < attempts; i++) {
      const x = (fraction(i, 1) * 2 - 1) * edge
      const z = (fraction(i, 2) * 2 - 1) * edge
      const ground = terrain.heightAt(x, z)

      if (ground > TREELINE) continue
      if (terrain.canyonDepthAt(x, z) > 0.55) continue
      if (terrain.slopeAt(x, z) > MAX_SLOPE) continue
      if (clearings.some((c) => Math.hypot(x - c.x, z - c.z) < c.radius)) continue

      const scale = 0.7 + fraction(i, 3) * 0.8
      trees.push({
        x, z, ground, scale,
        top: ground + TOP_OF_CANOPY * scale,
        // The hull, not the rotor — so threading between trunks is possible.
        radius: CANOPY_RADIUS * scale + HULL_RADIUS,
      })
    }

    this.trees = trees
    for (const tree of trees) {
      const key = cellKey(tree.x, tree.z)
      const bucket = this.cells.get(key)
      if (bucket) bucket.push(tree)
      else this.cells.set(key, [tree])
    }
  }

  /** The tree being clipped at this point, or null. */
  strikeAt(x: number, y: number, z: number): Tree | null {
    // A tree can reach into a neighbouring cell, so check the ring around us.
    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        const bucket = this.cells.get(cellKey(x + ox * CELL, z + oz * CELL))
        if (!bucket) continue
        for (const tree of bucket) {
          if (y > tree.top) continue
          if (Math.hypot(x - tree.x, z - tree.z) > tree.radius) continue
          return tree
        }
      }
    }
    return null
  }

  /** How high the canopy reaches near a point — how low is too low to fly. */
  canopyHeightNear(x: number, z: number, within = 14): number {
    let highest = -Infinity
    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        const bucket = this.cells.get(cellKey(x + ox * CELL, z + oz * CELL))
        if (!bucket) continue
        for (const tree of bucket) {
          if (Math.hypot(x - tree.x, z - tree.z) > within) continue
          highest = Math.max(highest, tree.top)
        }
      }
    }
    return highest === -Infinity ? -Infinity : highest
  }
}

function cellKey(x: number, z: number): string {
  return `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`
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
const CELL = 24

/** Matches the drawn tree: trunk plus cone, measured from the ground. */
export const TRUNK_HEIGHT = 6
export const CANOPY_HEIGHT = 9
export const CANOPY_RADIUS = 2.6
const TOP_OF_CANOPY = TRUNK_HEIGHT * 0.85 + CANOPY_HEIGHT
/** Roughly the hull's half-width. The rotor is ignored, so gaps are flyable. */
const HULL_RADIUS = 2.2
