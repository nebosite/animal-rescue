import type { Fire } from './Fire'
import { LANDABLE_SLOPE, type Terrain } from './Terrain'
import type { TreeCover } from './TreeCover'

/** The kinds of place an animal can be waiting. Each lands differently. */
export type SiteKind = 'clearing' | 'hilltop' | 'canyon' | 'ridge' | 'fireline'

/** Somewhere an animal is waiting to be picked up. */
export interface Site {
  kind: SiteKind
  x: number
  y: number
  z: number
  /** 1 easy .. 4 hard; worth extra points on delivery. */
  difficulty: number
  /** How the radio and the HUD describe it. */
  label: string
}

/** A spot on the map with everything the finder needs to judge it. */
interface Candidate {
  x: number
  z: number
  y: number
  canyon: number
  /** How far the ground falls away around it — big on a ridge, small on a plain. */
  relief: number
  /** Distance to the nearest trunk, or Infinity in the open. */
  treeGap: number
}

/**
 * Finds places in the landscape for animals to wait: a clearing in the
 * forest, a hilltop, the canyon floor, a ridge shelf, the edge of the fire.
 *
 * Pickups are places rather than pads, so every trip is a different flight
 * with a different landing. The finder scans the map once, keeps every spot
 * where the skids could safely go down, and then answers "give me a hilltop"
 * with a deterministic pick among the best of them — the same seed always
 * gives the same place, so a map can be learned.
 */
export class SiteFinder {
  private readonly candidates: Candidate[] = []

  constructor(
    private readonly terrain: Terrain,
    trees: TreeCover,
    base: { x: number; z: number },
  ) {
    const edge = terrain.halfSize - EDGE_MARGIN
    for (let x = -edge; x <= edge; x += SCAN_STEP) {
      for (let z = -edge; z <= edge; z += SCAN_STEP) {
        if (Math.hypot(x - base.x, z - base.z) < MIN_FROM_BASE) continue
        if (terrain.slopeAt(x, z) > LANDABLE_SLOPE * 0.8) continue
        const treeGap = trees.nearestTrunk(x, z, 32)
        // The skids need a gap; a tree under the hull is a strike, not a landing.
        if (treeGap < TOUCHDOWN_GAP) continue

        this.candidates.push({
          x, z,
          y: terrain.heightAt(x, z),
          canyon: terrain.canyonDepthAt(x, z),
          relief: this.reliefAt(x, z),
          treeGap,
        })
      }
    }
  }

  /** Every place the skids could go down. */
  get landable(): number {
    return this.candidates.length
  }

  /**
   * A site of the given kind, well clear of the fire and of `avoid`. The seed
   * picks among the dozen best, so the same kind can be asked for repeatedly
   * without always landing the same animal on the same rock.
   */
  find(kind: SiteKind, fire: Fire, seed: number, avoid: ReadonlyArray<{ x: number; z: number }> = []): Site | null {
    const suits = this.candidates.filter((c) => this.suits(c, kind, fire) && this.clearOf(c, avoid))
    if (suits.length === 0) return null
    suits.sort((a, b) => this.score(b, kind, fire) - this.score(a, kind, fire))
    const best = suits.slice(0, SHORTLIST)
    const pick = best[Math.floor(hash(seed) * best.length) % best.length]
    return this.site(pick, kind)
  }

  /**
   * Where a frightened animal runs when the fire reaches it: not far, away
   * from the flames, and somewhere a helicopter can still land.
   */
  fleeFrom(from: { x: number; z: number }, fire: Fire, seed: number, avoid: ReadonlyArray<{ x: number; z: number }> = []): Site | null {
    const wasThisFar = fire.distanceToNearest(from.x, from.z)
    const options = this.candidates.filter((c) => {
      const run = Math.hypot(c.x - from.x, c.z - from.z)
      return run >= FLEE_MIN && run <= FLEE_MAX
        && fire.intensityAt(c.x, c.z) === 0
        && fire.distanceToNearest(c.x, c.z) >= Math.max(SAFE_FROM_FIRE, wasThisFar + 20)
        && this.clearOf(c, avoid)
    })
    const pool = options.length > 0 ? options : this.candidates.filter((c) => fire.distanceToNearest(c.x, c.z) >= SAFE_FROM_FIRE * 2)
    if (pool.length === 0) return null
    pool.sort((a, b) => fire.distanceToNearest(b.x, b.z) - fire.distanceToNearest(a.x, a.z))
    const best = pool.slice(0, SHORTLIST)
    const pick = best[Math.floor(hash(seed) * best.length) % best.length]
    return this.site(pick, this.kindOf(pick, fire))
  }

  private suits(c: Candidate, kind: SiteKind, fire: Fire): boolean {
    const fromFire = fire.distanceToNearest(c.x, c.z)
    if (fire.intensityAt(c.x, c.z) > 0) return false
    if (kind !== 'fireline' && fromFire < SAFE_FROM_FIRE) return false

    switch (kind) {
      case 'clearing':
        return c.canyon < 0.15 && c.relief < 12 && Number.isFinite(c.treeGap) && c.treeGap < 30
      case 'hilltop':
        return c.y >= HILLTOP_HEIGHT && c.canyon < 0.1
      case 'canyon':
        return c.canyon >= 0.6
      case 'ridge':
        return c.relief >= RIDGE_RELIEF && c.y >= 30 && c.canyon < 0.2
      case 'fireline':
        return fromFire >= FIRELINE_NEAR && fromFire <= FIRELINE_FAR
    }
  }

  /** Higher is a better example of its kind. */
  private score(c: Candidate, kind: SiteKind, fire: Fire): number {
    switch (kind) {
      case 'clearing': return -Math.abs(c.treeGap - 13)
      case 'hilltop': return c.y
      case 'canyon': return c.canyon
      case 'ridge': return c.relief
      case 'fireline': return -Math.abs(fire.distanceToNearest(c.x, c.z) - (FIRELINE_NEAR + FIRELINE_FAR) / 2)
    }
  }

  /** What a spot chosen for other reasons should be called. */
  private kindOf(c: Candidate, fire: Fire): SiteKind {
    if (c.canyon >= 0.6) return 'canyon'
    if (c.relief >= RIDGE_RELIEF && c.y >= 30) return 'ridge'
    if (c.y >= HILLTOP_HEIGHT) return 'hilltop'
    if (fire.distanceToNearest(c.x, c.z) <= FIRELINE_FAR) return 'fireline'
    return 'clearing'
  }

  private site(c: Candidate, kind: SiteKind): Site {
    return { kind, x: c.x, y: c.y, z: c.z, difficulty: DIFFICULTY[kind], label: LABEL[kind] }
  }

  private clearOf(c: Candidate, avoid: ReadonlyArray<{ x: number; z: number }>): boolean {
    return avoid.every((other) => Math.hypot(c.x - other.x, c.z - other.z) >= SPACING)
  }

  /** How far the ground drops around a point, sampled on a ring. */
  private reliefAt(x: number, z: number): number {
    const here = this.terrain.heightAt(x, z)
    let lowest = here
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      lowest = Math.min(lowest, this.terrain.heightAt(x + Math.cos(angle) * RELIEF_RING, z + Math.sin(angle) * RELIEF_RING))
    }
    return here - lowest
  }
}

/** Deterministic 0..1 from an integer seed. */
function hash(seed: number): number {
  let h = Math.imul(seed + 1, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35)
  return ((h ^ (h >>> 13)) >>> 0) / 4294967295
}

const DIFFICULTY: Record<SiteKind, number> = { clearing: 1, hilltop: 2, canyon: 3, ridge: 3, fireline: 4 }
const LABEL: Record<SiteKind, string> = {
  clearing: 'a clearing in the forest',
  hilltop: 'a hilltop',
  canyon: 'the canyon floor',
  ridge: 'a ridge shelf',
  fireline: 'the edge of the fire',
}

const SCAN_STEP = 12
const EDGE_MARGIN = 40
const MIN_FROM_BASE = 220
/** Clear ground the skids need, in trunk distance. */
const TOUCHDOWN_GAP = 7.5
const SHORTLIST = 12
/** Sites are kept at least this far apart, so two animals are two trips. */
const SPACING = 70
const SAFE_FROM_FIRE = 34
const FIRELINE_NEAR = 36
const FIRELINE_FAR = 95
const HILLTOP_HEIGHT = 44
const RIDGE_RELIEF = 16
const RELIEF_RING = 28
const FLEE_MIN = 55
const FLEE_MAX = 170
