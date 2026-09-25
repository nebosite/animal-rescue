import type { Terrain } from './Terrain'

/**
 * What the fire has done to a tree so far. A tree burns for a while before it
 * is gone — green, then alight, then a bare snag — because the middle state is
 * most of what you actually see from the air at the fire's edge.
 */
export type TreeState = 'green' | 'burning' | 'burnt'

/** One tree: where it stands, how big, and how tall its canopy reaches. */
export interface Tree {
  /** Its place in the forest, which is also its place in the drawing. */
  index: number
  x: number
  z: number
  /** Ground height at its foot. */
  ground: number
  scale: number
  /** World height of the top of its canopy. */
  top: number
  /** Horizontal radius that counts as a strike. */
  radius: number
  state: TreeState
  /** Seconds it has been alight. */
  alight: number
  /**
   * How long this one takes to burn out. Varied per tree so a stand does not
   * all flip to black on the same frame.
   */
  burnsFor: number
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
  /** Just the trees currently alight, so ageing them costs nothing per green tree. */
  private readonly alight: Tree[] = []

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
        index: trees.length,
        x, z, ground, scale,
        top: ground + TOP_OF_CANOPY * scale,
        // The hull, not the rotor — so threading between trunks is possible.
        radius: CANOPY_RADIUS * scale + HULL_RADIUS,
        state: 'green',
        alight: 0,
        burnsFor: BURNS_FOR * (0.65 + fraction(i, 4) * 0.7),
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

  /**
   * Set light to every tree the fire has reached, and report which ones newly
   * caught so the drawing can blacken them.
   *
   * Only the ground near a burning patch is examined, through the same grid
   * the strike lookups use — sweeping several thousand trees every frame to
   * ask a question whose answer almost never changes would be absurd.
   */
  scorch(fire: { patches: ReadonlyArray<{ x: number; z: number; radius: number }>; intensityAt(x: number, z: number): number }): Tree[] {
    const caught: Tree[] = []
    for (const patch of fire.patches) {
      const reach = Math.ceil(patch.radius / CELL)
      for (let ox = -reach; ox <= reach; ox++) {
        for (let oz = -reach; oz <= reach; oz++) {
          const bucket = this.cells.get(cellKey(patch.x + ox * CELL, patch.z + oz * CELL))
          if (!bucket) continue
          for (const tree of bucket) {
            if (tree.state !== 'green') continue
            if (Math.hypot(tree.x - patch.x, tree.z - patch.z) > patch.radius) continue
            if (fire.intensityAt(tree.x, tree.z) < CATCHES_AT) continue
            tree.state = 'burning'
            tree.alight = 0
            this.alight.push(tree)
            caught.push(tree)
          }
        }
      }
    }
    return caught
  }

  /**
   * Age the trees that are alight, and report the ones that have just burnt
   * out so the drawing can strip them to snags.
   *
   * Only the burning ones are kept in a list and walked; the several thousand
   * green trees have nothing to age.
   */
  advance(dt: number): Tree[] {
    const spent: Tree[] = []
    for (let i = this.alight.length - 1; i >= 0; i--) {
      const tree = this.alight[i]
      tree.alight += dt
      if (tree.alight < tree.burnsFor) continue
      tree.state = 'burnt'
      this.alight.splice(i, 1)
      spent.push(tree)
    }
    return spent
  }

  /** The trees currently alight, for whoever is drawing the flames in them. */
  get burning(): readonly Tree[] {
    return this.alight
  }

  /** How far through burning a tree is, 0..1. */
  static burnProgress(tree: Tree): number {
    if (tree.state === 'burnt') return 1
    return Math.min(1, tree.alight / tree.burnsFor)
  }

  /** How much of the forest the fire has reached, 0..1 — the scale of the thing. */
  get burntFraction(): number {
    if (this.trees.length === 0) return 0
    return this.trees.reduce((count, tree) => count + (tree.state === 'green' ? 0 : 1), 0) / this.trees.length
  }

  /** Distance to the nearest trunk within `within`, or Infinity if there is none. */
  nearestTrunk(x: number, z: number, within = CELL): number {
    let nearest = Infinity
    const cells = Math.ceil(within / CELL)
    for (let ox = -cells; ox <= cells; ox++) {
      for (let oz = -cells; oz <= cells; oz++) {
        const bucket = this.cells.get(cellKey(x + ox * CELL, z + oz * CELL))
        if (!bucket) continue
        for (const tree of bucket) nearest = Math.min(nearest, Math.hypot(x - tree.x, z - tree.z))
      }
    }
    return nearest <= within ? nearest : Infinity
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
/** Heat at a trunk that sets it alight. Embers behind the front still count. */
const CATCHES_AT = 0.12
/**
 * Seconds a tree stays alight before it is a snag, on average. Long enough to
 * watch a stand go up as the front passes, short enough that the ground behind
 * the front is properly dead within a shift.
 */
const BURNS_FOR = 11

/** Matches the drawn tree: trunk plus cone, measured from the ground. */
export const TRUNK_HEIGHT = 6
export const CANOPY_HEIGHT = 9
export const CANOPY_RADIUS = 2.6
const TOP_OF_CANOPY = TRUNK_HEIGHT * 0.85 + CANOPY_HEIGHT
/** Roughly the hull's half-width. The rotor is ignored, so gaps are flyable. */
const HULL_RADIUS = 2.2
