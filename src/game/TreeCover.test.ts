import { describe, expect, it } from 'vitest'
import { Fire } from './Fire'
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
    // Which tree is struck is not the point — the wood is dense enough that a
    // neighbour may be nearer. That something is struck is the point.
    expect(cover.strikeAt(tree.x, tree.top - 1, tree.z)).not.toBeNull()
  })

  it('lets you fly over the top of the trees', () => {
    const tree = cover.trees[10]
    // Clear of the tallest canopy anywhere near, not merely of this one trunk.
    const tallest = cover.canopyHeightNear(tree.x, tree.z, 40)
    expect(cover.strikeAt(tree.x, tallest + 0.5, tree.z)).toBeNull()
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

  it('sets light to the trees the fire reaches, once each, and leaves the rest alone', () => {
    const cover = new TreeCover(terrain)
    const tree = cover.trees.find((t) => Math.abs(t.x) < 300 && Math.abs(t.z) < 300)!
    const blaze = new Fire([{ x: tree.x, z: tree.z, radius: 45, age: 0 }])

    const caught = cover.scorch(blaze)
    expect(caught.length).toBeGreaterThan(0)
    expect(caught).toContain(tree)
    expect(tree.state).toBe('burning')
    // Everything that caught is inside the fire; everything outside is untouched.
    for (const burnt of caught) expect(Math.hypot(burnt.x - tree.x, burnt.z - tree.z)).toBeLessThanOrEqual(45)
    for (const other of cover.trees) {
      if (Math.hypot(other.x - tree.x, other.z - tree.z) > 60) expect(other.state).toBe('green')
    }

    // A second pass over the same fire catches nothing new: burning is once only.
    expect(cover.scorch(blaze)).toHaveLength(0)
    expect(cover.burntFraction).toBeGreaterThan(0)
    expect(cover.burntFraction).toBeLessThan(0.5)
  })

  it('scorching a spreading fire is cheap enough to do every frame', () => {
    const cover = new TreeCover(terrain)
    const fire = Fire.frontBetween({ x: -316, z: 190 }, { x: 195, z: -203 })
    for (let i = 0; i < 1200; i++) fire.advance(0.1)

    const started = performance.now()
    for (let i = 0; i < 600; i++) cover.scorch(fire)
    // Ten seconds of frames against a grown fire.
    expect(performance.now() - started).toBeLessThan(500)
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

  it('burns a tree down over time rather than switching it to black', () => {
    const cover = new TreeCover(new Terrain(420))
    const tree = cover.trees[0]
    const blaze = {
      patches: [{ x: tree.x, z: tree.z, radius: 40 }],
      intensityAt: () => 1,
    }

    expect(cover.scorch(blaze).length).toBeGreaterThan(0)
    expect(tree.state).toBe('burning')
    expect(TreeCover.burnProgress(tree)).toBe(0)

    // Halfway through its burn it is still alight, not yet a snag — that middle
    // state is most of what you see at the front.
    for (let i = 0; i < tree.burnsFor / 2 / 0.4; i++) cover.advance(0.4)
    expect(tree.state).toBe('burning')
    expect(TreeCover.burnProgress(tree)).toBeGreaterThan(0.3)
    expect(TreeCover.burnProgress(tree)).toBeLessThan(0.7)

    for (let i = 0; i < 200; i++) cover.advance(0.4)
    expect(tree.state).toBe('burnt')
    expect(TreeCover.burnProgress(tree)).toBe(1)
  })

  it('does not burn a whole stand out on the same tick', () => {
    const cover = new TreeCover(new Terrain(420))
    const blaze = { patches: [{ x: 0, z: 0, radius: 400 }], intensityAt: () => 1 }
    const caught = cover.scorch(blaze)
    expect(caught.length).toBeGreaterThan(50)

    // Every tree caught at once, so any bunching at the end is the burn
    // duration alone. If they all shared one it would be a single step.
    const steps = new Set<number>()
    for (let i = 0; i < 200; i++) {
      if (cover.advance(0.4).length > 0) steps.add(i)
    }
    expect(steps.size).toBeGreaterThan(8)
  })

  it('keeps only the burning trees on its list, so ageing costs nothing per green tree', () => {
    const cover = new TreeCover(new Terrain(420))
    expect(cover.burning).toHaveLength(0)

    const tree = cover.trees[0]
    cover.scorch({ patches: [{ x: tree.x, z: tree.z, radius: 40 }], intensityAt: () => 1 })
    const alight = cover.burning.length
    expect(alight).toBeGreaterThan(0)

    for (let i = 0; i < 200; i++) cover.advance(0.4)
    expect(cover.burning).toHaveLength(0)
    expect(cover.burntFraction).toBeGreaterThan(0)
  })

  it('counts a tree as burnt from the moment it catches, not only when it is spent', () => {
    const cover = new TreeCover(new Terrain(420))
    const tree = cover.trees[0]
    cover.scorch({ patches: [{ x: tree.x, z: tree.z, radius: 40 }], intensityAt: () => 1 })
    expect(cover.burntFraction).toBeGreaterThan(0)
  })

  it('never sets a tree alight twice', () => {
    const cover = new TreeCover(new Terrain(420))
    const blaze = { patches: [{ x: 0, z: 0, radius: 400 }], intensityAt: () => 1 }
    const first = cover.scorch(blaze).length
    expect(first).toBeGreaterThan(0)
    expect(cover.scorch(blaze)).toHaveLength(0)

    // And a spent tree does not catch again when the fire is still over it.
    for (let i = 0; i < 200; i++) cover.advance(0.4)
    expect(cover.scorch(blaze)).toHaveLength(0)
    expect(cover.burning).toHaveLength(0)
  })
})
