import { describe, expect, it } from 'vitest'
import { Terrain } from './Terrain'
import { TreeCover } from './TreeCover'

const terrain = new Terrain(420)
const cover = new TreeCover(terrain)

describe('TreeCover', () => {
  it('grows a forest, but not everywhere', () => {
    expect(cover.trees.length).toBeGreaterThan(500)
    expect(cover.trees.length).toBeLessThan(9000)
  })

  it('is the same forest every time, so the map is learnable', () => {
    const again = new TreeCover(terrain)
    expect(again.trees.length).toBe(cover.trees.length)
    expect(again.trees[0]).toEqual(cover.trees[0])
  })

  it('keeps trees off steep ground, out of the canyon and below the treeline', () => {
    for (const tree of cover.trees) {
      expect(tree.ground).toBeLessThanOrEqual(52)
      expect(terrain.canyonDepthAt(tree.x, tree.z)).toBeLessThanOrEqual(0.55)
      expect(terrain.slopeAt(tree.x, tree.z)).toBeLessThanOrEqual(0.55)
    }
  })

  it('leaves clearings empty', () => {
    const clearing = { x: 0, z: 0, radius: 60 }
    const cleared = new TreeCover(terrain, [clearing])
    for (const tree of cleared.trees) {
      expect(Math.hypot(tree.x - clearing.x, tree.z - clearing.z)).toBeGreaterThanOrEqual(clearing.radius)
    }
  })

  it('reports a strike when flying into a canopy', () => {
    const tree = cover.trees[10]
    expect(cover.strikeAt(tree.x, tree.top - 1, tree.z)).toBe(tree)
  })

  it('lets you fly over the top of the trees', () => {
    const tree = cover.trees[10]
    expect(cover.strikeAt(tree.x, tree.top + 0.5, tree.z)).toBeNull()
  })

  it('lets you fly past a trunk without clipping it', () => {
    // The real wood is too dense for this: stepping clear of one trunk simply
    // puts you inside its neighbour. A thin scatter isolates the question.
    const sparse = new TreeCover(terrain, [], 300)
    const lonely = sparse.trees.find((tree) =>
      sparse.trees.every((other) => other === tree || Math.hypot(other.x - tree.x, other.z - tree.z) > 40),
    )
    expect(lonely).toBeDefined()
    expect(sparse.strikeAt(lonely!.x, lonely!.ground + 2, lonely!.z)).toBe(lonely)
    expect(sparse.strikeAt(lonely!.x + lonely!.radius + 1, lonely!.ground + 2, lonely!.z)).toBeNull()
  })

  it('finds a tree that reaches across a grid cell boundary', () => {
    // Every tree must be findable from its own position, whatever cell it is in.
    for (const tree of cover.trees) {
      expect(cover.strikeAt(tree.x, tree.ground + 1, tree.z)).not.toBeNull()
    }
  })

  it('finds nothing high above the canopy', () => {
    expect(cover.strikeAt(0, 400, 0)).toBeNull()
  })

  it('finds nothing at all inside a clearing', () => {
    const cleared = new TreeCover(terrain, [{ x: 0, z: 0, radius: 80 }])
    expect(cleared.strikeAt(0, cleared.trees[0].ground + 2, 0)).toBeNull()
  })

  it('answers strike queries fast enough for every frame', () => {
    const started = performance.now()
    for (let i = 0; i < 20000; i++) {
      cover.strikeAt((i % 800) - 400, 20, ((i * 7) % 800) - 400)
    }
    // Twenty thousand lookups is hundreds of frames' worth.
    expect(performance.now() - started).toBeLessThan(400)
  })

  it('reports how high the canopy stands nearby, and nothing in the open', () => {
    const tree = cover.trees[20]
    // At least this tree's own top, and possibly a taller neighbour's.
    expect(cover.canopyHeightNear(tree.x, tree.z)).toBeGreaterThanOrEqual(tree.top - 1e-6)
    // Nothing to report where nothing grows.
    const cleared = new TreeCover(terrain, [{ x: 0, z: 0, radius: 80 }])
    expect(cleared.canopyHeightNear(0, 0)).toBe(-Infinity)
  })
})
