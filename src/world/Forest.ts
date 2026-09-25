import * as THREE from 'three'
import { CANOPY_HEIGHT, CANOPY_RADIUS, TRUNK_HEIGHT, type Tree, type TreeCover } from '../game/TreeCover'

/**
 * The picture of the forest: two instanced meshes, one for trunks and one for
 * canopies, so the whole wood costs two draw calls.
 *
 * Where the trees are is decided by `TreeCover`, which the flight loop also
 * asks about collisions — so what you can see and what you can hit are by
 * construction the same forest.
 *
 * A tree the fire reaches is not simply switched to black. While it burns it
 * is three things at once — a trunk already charred, needles still green above,
 * and embers glowing where the flame has climbed to — and the green retreats
 * upward as the glow follows it. Only once it has burnt out does it become
 * what it ends as: a bare black stick, with no crown and no fire in it.
 */
export class Forest {
  readonly group = new THREE.Group()

  private readonly trunks: THREE.InstancedMesh
  private readonly canopies: THREE.InstancedMesh
  /** Additive glow inside a burning canopy; nothing else uses these slots. */
  private readonly embers: THREE.InstancedMesh
  private readonly trees: readonly Tree[]
  private readonly transform = new THREE.Object3D()
  private readonly tint = new THREE.Color()

  constructor(cover: TreeCover) {
    this.trees = cover.trees
    const count = Math.max(1, cover.trees.length)

    // Both meshes carry per-instance colour so a single tree can be charred
    // without touching its neighbours.
    this.trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(TRUNK_RADIUS * 0.7, TRUNK_RADIUS, TRUNK_HEIGHT, 5),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }),
      count,
    )
    this.canopies = new THREE.InstancedMesh(
      new THREE.ConeGeometry(CANOPY_RADIUS, CANOPY_HEIGHT, 7),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
      count,
    )

    this.embers = new THREE.InstancedMesh(
      new THREE.ConeGeometry(CANOPY_RADIUS * 1.1, CANOPY_HEIGHT * EMBER_REACH, 6),
      // Unlit and additive, like the fire itself: it makes light, not catches it.
      new THREE.MeshBasicMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.85,
      }),
      count,
    )

    const transform = new THREE.Object3D()
    const tint = new THREE.Color()
    cover.trees.forEach((tree, index) => {
      transform.position.set(tree.x, tree.ground + (TRUNK_HEIGHT / 2) * tree.scale, tree.z)
      transform.scale.setScalar(tree.scale)
      transform.rotation.y = (index % 8) * 0.79
      transform.updateMatrix()
      this.trunks.setMatrixAt(index, transform.matrix)
      this.trunks.setColorAt(index, BARK)

      transform.position.y = tree.ground + (TRUNK_HEIGHT * 0.85 + CANOPY_HEIGHT / 2) * tree.scale
      transform.updateMatrix()
      this.canopies.setMatrixAt(index, transform.matrix)

      // Vary the green so the wood does not read as one flat mass.
      this.canopies.setColorAt(index, needles(tint, index))

      // Every tree carries an ember slot, scaled to nothing until it catches.
      transform.scale.setScalar(0)
      transform.updateMatrix()
      this.embers.setMatrixAt(index, transform.matrix)
      this.embers.setColorAt(index, GLOW)
    })

    this.trunks.instanceMatrix.needsUpdate = true
    this.canopies.instanceMatrix.needsUpdate = true
    this.embers.instanceMatrix.needsUpdate = true
    this.commitBurns()

    // Nothing gets close enough for a tree to need per-frame culling maths.
    this.trunks.frustumCulled = false
    this.canopies.frustumCulled = false
    this.embers.frustumCulled = false
    this.group.add(this.trunks, this.canopies, this.embers)
  }

  /**
   * A tree partway through burning: black below, green above, glowing between.
   *
   * `progress` runs 0..1 across its burn. The trunk chars first and fastest,
   * since the fire reaches it first, while the needles hold their colour a
   * while and then go. The ember cone climbs the crown behind the retreating
   * green, so there is always a lit edge between what has burnt and what has
   * not — which is the part you can actually see from the air.
   */
  setAlight(index: number, progress: number): void {
    const tree = this.trees[index]
    const eaten = clamp01(progress)

    // The trunk is black well before the crown is.
    this.tint.copy(BARK).lerp(CHARRED_TRUNK, clamp01(eaten * TRUNK_CHARS_BY))
    this.trunks.setColorAt(index, this.tint)

    // Needles scorch through before they go: green, then dry gold, then black.
    needles(this.tint, index)
    if (eaten < SCORCH_AT) this.tint.lerp(SCORCHED_NEEDLE, eaten / SCORCH_AT)
    else this.tint.copy(SCORCHED_NEEDLE).lerp(CHARRED_CANOPY, (eaten - SCORCH_AT) / (1 - SCORCH_AT))
    this.canopies.setColorAt(index, this.tint)

    // The crown burns from the bottom up, so it keeps its top and loses its
    // skirt, which is how a conifer actually goes.
    const left = 1 - eaten * CANOPY_EATEN
    this.placeCanopy(index, tree, left)

    // Brightest in the middle of the burn: catching and dying both glow less.
    const heat = Math.sin(Math.PI * eaten) ** 0.6
    this.transform.position.set(
      tree.x,
      tree.ground + (TRUNK_HEIGHT * 0.85 + CANOPY_HEIGHT * left * EMBER_SITS) * tree.scale,
      tree.z,
    )
    this.transform.rotation.set(0, index % 8, 0)
    this.transform.scale.setScalar(tree.scale * heat)
    this.transform.updateMatrix()
    this.embers.setMatrixAt(index, this.transform.matrix)
    this.embers.setColorAt(index, this.tint.copy(GLOW).multiplyScalar(0.35 + heat * 0.65))
  }

  /**
   * Burnt out: a bare black stick. No crown left to speak of and no fire in it
   * — a snag standing in the ash, which is what the ground behind the front is
   * supposed to look like.
   */
  burnOut(index: number): void {
    this.trunks.setColorAt(index, CHARRED_TRUNK)
    this.canopies.setColorAt(index, CHARRED_CANOPY)
    // Thin and short enough to read as a spar rather than a cone: what is left
    // is the top of the bole, not a tree.
    this.placeCanopy(index, this.trees[index], SNAG_HEIGHT, SNAG_SPREAD)

    this.transform.scale.setScalar(0)
    this.transform.updateMatrix()
    this.embers.setMatrixAt(index, this.transform.matrix)
  }

  /** Sit a canopy of the given remaining height on top of its trunk. */
  private placeCanopy(index: number, tree: Tree, left: number, spread = 1): void {
    this.transform.position.set(
      tree.x,
      tree.ground + (TRUNK_HEIGHT * 0.85 + (CANOPY_HEIGHT * left) / 2) * tree.scale,
      tree.z,
    )
    this.transform.rotation.set(0, (index % 8) * 0.79, 0)
    this.transform.scale.set(tree.scale * spread, tree.scale * left, tree.scale * spread)
    this.transform.updateMatrix()
    this.canopies.setMatrixAt(index, this.transform.matrix)
  }

  /** Call once after a batch of burns, rather than per tree. */
  commitBurns(): void {
    this.canopies.instanceMatrix.needsUpdate = true
    this.embers.instanceMatrix.needsUpdate = true
    for (const mesh of [this.trunks, this.canopies, this.embers]) {
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

const TRUNK_RADIUS = 0.5
const BARK = new THREE.Color(0x8a5a33)
const NEEDLE_DARK = new THREE.Color(0x2c9a4b)
const NEEDLE_LIGHT = new THREE.Color(0x74d96c)
const CHARRED_TRUNK = new THREE.Color(0x241d19)
const CHARRED_CANOPY = new THREE.Color(0x14100e)
/** Dead needles before they fall: the gold a conifer goes on its way to black. */
const SCORCHED_NEEDLE = new THREE.Color(0xb4622a)
const GLOW = new THREE.Color(0xff8a2b)

/** How far up the canopy the ember cone reaches, as a fraction of its height. */
const EMBER_REACH = 0.5
/** Where the ember cone sits within what is left of the crown. */
const EMBER_SITS = 0.34
/** The trunk is fully charred this far into the burn. */
const TRUNK_CHARS_BY = 3
/** Needles are fully scorched by here, and blacken from here on. */
const SCORCH_AT = 0.45
/** How much of its crown a tree loses while burning, before it goes entirely. */
const CANOPY_EATEN = 0.55
/** What a snag keeps: a thin spar, well short of the live crown. */
const SNAG_SPREAD = 0.07
const SNAG_HEIGHT = 0.35
