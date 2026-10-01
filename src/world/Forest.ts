import * as THREE from 'three'
import { CANOPY_RADIUS, TRUNK_HEIGHT, TRUNK_RADIUS, type Tree, type TreeCover } from '../game/TreeCover'
import { BarkTexture } from './BarkTexture'
import { ConiferCrown } from './ConiferCrown'

/**
 * The picture of the forest: trunks, crowns, and a second copy of the crowns
 * for the ones that are alight, so the whole wood costs three draw calls. The
 * fire in it is not drawn here at all — `FireParticles` lifts sparks off the
 * burning branches, which is both a better flame and one fewer thing for this
 * class to know about.
 *
 * Burning crowns need their own mesh because they need their own *material*.
 * Branches on fire are a light source, not a lit surface: they want to be flat,
 * fully bright and the same colour whichever way they face, and a material is
 * either lit or unlit for every instance that shares it. So a tree lives in the
 * lit mesh while it is green and again once it is a black snag, and in the
 * unlit one for the eleven seconds in between.
 *
 * Where the trees are is decided by `TreeCover`, which the flight loop also
 * asks about collisions — so what you can see and what you can hit are by
 * construction the same forest.
 *
 * A tree the fire reaches is not simply switched to black. Its crown stops
 * being green the moment it catches and becomes what it now is — alight: bright
 * yellow where the flame is newest, deepening to orange as it is eaten, and
 * only going dark at the very end. The crown burns from the skirt upward, so
 * what is left retreats into a tuft at the top and the bare spar is left
 * standing, which is how a fir actually goes and what makes the front legible
 * from the air. Only once it has burnt out is it what it ends as: a black stick.
 */
export class Forest {
  readonly group = new THREE.Group()

  private readonly trunks: THREE.InstancedMesh
  /** Green crowns and dead ones: ordinary geometry, lit by the sun. */
  private readonly crowns: THREE.InstancedMesh
  /** And the ones that are on fire: unlit, so they make their own light. */
  private readonly alight: THREE.InstancedMesh
  private readonly trees: readonly Tree[]
  private readonly transform = new THREE.Object3D()
  private readonly tint = new THREE.Color()
  /** Where a crown goes in whichever of the two meshes it is not in today. */
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0)

  constructor(cover: TreeCover) {
    this.trees = cover.trees
    const count = Math.max(1, cover.trees.length)

    // Both meshes carry per-instance colour so a single tree can be charred
    // without touching its neighbours. On the trunks that colour multiplies the
    // bark texture, so an unburnt tree is plain white here and the wood comes
    // entirely from the map — which is also what lets charring simply darken it.
    const bark = new BarkTexture()
    this.trunks = new THREE.InstancedMesh(
      // Ten-sided rather than five: the fluting in the bark is wasted on a
      // pentagon, and a redwood trunk seen from fifty metres is a column.
      new THREE.CylinderGeometry(TRUNK_RADIUS * 0.62, TRUNK_RADIUS, TRUNK_HEIGHT, 10),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: bark.map,
        bumpMap: bark.bump,
        bumpScale: BARK_DEPTH,
        roughness: 0.95,
      }),
      count,
    )
    this.crowns = new THREE.InstancedMesh(
      new ConiferCrown().geometry,
      // Two-sided: the branch sprays are open shells, so the underside of a
      // tier is a back face and the crown would be full of holes from below —
      // which is precisely the angle a helicopter looks at it from.
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide }),
      count,
    )

    // The same branches again, unlit. A burning crown is drawn here instead of
    // in `crowns`, never in both.
    this.alight = new THREE.InstancedMesh(
      this.crowns.geometry,
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
      count,
    )

    this.trees.forEach((_, index) => this.dress(index))
    this.commitBurns()
    this.trunks.instanceMatrix.needsUpdate = true

    // Nothing gets close enough for a tree to need per-frame culling maths.
    for (const mesh of [this.trunks, this.crowns, this.alight]) mesh.frustumCulled = false
    this.group.add(this.trunks, this.crowns, this.alight)
  }

  /** One tree as it grew: brown trunk, green crown, no fire in it. */
  private dress(index: number): void {
    const tree = this.trees[index]

    this.transform.position.set(tree.x, tree.ground + (TRUNK_HEIGHT / 2) * tree.scale, tree.z)
    this.transform.rotation.set(0, (index % 8) * 0.79, 0)
    this.transform.scale.setScalar(tree.scale)
    this.transform.updateMatrix()
    this.trunks.setMatrixAt(index, this.transform.matrix)
    this.trunks.setColorAt(index, UNBURNT_BARK)

    this.placeCrown(this.crowns, index, tree, 1)
    // Vary the green so the wood does not read as one flat mass.
    this.crowns.setColorAt(index, needles(this.tint, index))

    this.alight.setMatrixAt(index, this.hidden)
    this.alight.setColorAt(index, BURNING_YELLOW)
  }

  /** A green forest again, for a fresh shift. */
  restore(): void {
    this.trees.forEach((_, index) => this.dress(index))
    this.trunks.instanceMatrix.needsUpdate = true
    this.commitBurns()
  }

  /**
   * A tree partway through burning: black below, green above, glowing between.
   *
   * `progress` runs 0..1 across its burn. The trunk chars first and fastest,
   * since the fire reaches it first, while the needles hold their colour a
   * while and then go. The crown is eaten from the skirt upward and the ember
   * glow follows the retreating green, so there is always a lit edge between
   * what has burnt and what has not — the part you can actually see from the
   * air. The flame standing over it is animated separately, every frame, by
   * `flicker`: this runs only a few times a second.
   */
  setAlight(index: number, progress: number): void {
    const tree = this.trees[index]
    const eaten = clamp01(progress)

    // The trunk chars well before the crown is gone. The colour multiplies the
    // bark map, so this darkens the real grain rather than painting over it.
    this.tint.copy(UNBURNT_BARK).lerp(CHARRED_TRUNK, clamp01(eaten * TRUNK_CHARS_BY))
    this.trunks.setColorAt(index, this.tint)

    // A crown that has caught is not green any more. It is alight: bright
    // yellow where the flame is newest, deepening to orange as it is eaten, and
    // dark only at the very end. Scorching it gently through gold was the first
    // attempt, and from the air a stand in the middle of catching read as
    // autumn rather than as being on fire.
    this.tint.copy(BURNING_YELLOW).lerp(BURNING_ORANGE, clamp01(eaten / EMBERS_AT))
    if (eaten > EMBERS_AT) this.tint.lerp(CHARRED_CANOPY, (eaten - EMBERS_AT) / (1 - EMBERS_AT))
    this.alight.setColorAt(index, this.tint)

    // Drawn in the unlit mesh while it burns, and taken out of the lit one, so
    // the sun cannot put a shaded side on something that is on fire.
    this.placeCrown(this.alight, index, tree, 1 - eaten * CROWN_EATEN)
    this.crowns.setMatrixAt(index, this.hidden)
  }

  /**
   * Burnt out: a bare black spar with a dark tuft at the top. No crown left to
   * speak of and no fire in it — a snag standing in the ash, which is what the
   * ground behind the front is supposed to look like.
   */
  burnOut(index: number): void {
    this.trunks.setColorAt(index, CHARRED_TRUNK)
    this.crowns.setColorAt(index, CHARRED_CANOPY)
    // Back to the lit mesh: a snag is a dead stick in the sun, not a light.
    this.placeCrown(this.crowns, index, this.trees[index], SNAG_HEIGHT, SNAG_SPREAD)
    this.alight.setMatrixAt(index, this.hidden)
  }

  /**
   * Sit a crown holding `left` of its height on the top of its trunk.
   *
   * Anchored at the *top*, not the base: a fir loses its skirt first and keeps
   * its spike, so what is left has to stay up where the tip was rather than
   * shrinking down onto the trunk.
   */
  private placeCrown(into: THREE.InstancedMesh, index: number, tree: Tree, left: number, spread = 1): void {
    const radius = CANOPY_RADIUS * tree.scale * spread
    this.transform.position.set(tree.x, tree.top - tree.crownHeight * left, tree.z)
    this.transform.rotation.set(0, (index % 8) * 0.79, 0)
    this.transform.scale.set(radius, tree.crownHeight * left, radius)
    this.transform.updateMatrix()
    into.setMatrixAt(index, this.transform.matrix)
  }

  /** Call once after a batch of burns, rather than per tree. */
  commitBurns(): void {
    this.crowns.instanceMatrix.needsUpdate = true
    this.alight.instanceMatrix.needsUpdate = true
    for (const mesh of [this.trunks, this.crowns, this.alight]) {
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  }
}

/** The green this tree started as, which charring is measured away from. */
function needles(out: THREE.Color, index: number): THREE.Color {
  return out.copy(NEEDLE_DARK).lerp(NEEDLE_LIGHT, (index % 11) / 11)
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** White: an unburnt trunk takes its whole colour from the bark map. */
const UNBURNT_BARK = new THREE.Color(0xffffff)
const NEEDLE_DARK = new THREE.Color(0x256f3a)
const NEEDLE_LIGHT = new THREE.Color(0x6bc45f)
const CHARRED_TRUNK = new THREE.Color(0x241d19)
const CHARRED_CANOPY = new THREE.Color(0x14100e)
/** A crown that is alight: newly caught, and well into burning. */
const BURNING_YELLOW = new THREE.Color(0xffd43a)
const BURNING_ORANGE = new THREE.Color(0xf07518)

/** How deep the bark fluting reads as relief. */
const BARK_DEPTH = 0.5
/** The trunk is fully charred this far into the burn. */
const TRUNK_CHARS_BY = 3
/** Past here a burning crown is dying back to black. */
const EMBERS_AT = 0.72
/** How much of its crown a tree loses while burning, before it goes entirely. */
const CROWN_EATEN = 0.62
/** What a snag keeps: a dark tuft, well short of a live crown. */
const SNAG_SPREAD = 0.3
const SNAG_HEIGHT = 0.16
