import * as THREE from 'three'
import { CANOPY_HEIGHT, CANOPY_RADIUS, TRUNK_HEIGHT, type TreeCover } from '../game/TreeCover'

/**
 * The picture of the forest: two instanced meshes, one for trunks and one for
 * canopies, so the whole wood costs two draw calls.
 *
 * Where the trees are is decided by `TreeCover`, which the flight loop also
 * asks about collisions — so what you can see and what you can hit are by
 * construction the same forest. When the fire goes through, `burn` blackens a
 * tree and strips its canopy back to a charred spike, which is what leaves the
 * dead ground behind the front looking dead.
 */
export class Forest {
  readonly group = new THREE.Group()

  private readonly trunks: THREE.InstancedMesh
  private readonly canopies: THREE.InstancedMesh
  private readonly scratch = new THREE.Matrix4()
  private readonly position = new THREE.Vector3()
  private readonly rotation = new THREE.Quaternion()
  private readonly scale = new THREE.Vector3()

  constructor(cover: TreeCover) {
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
      tint.copy(NEEDLE_DARK).lerp(NEEDLE_LIGHT, (index % 11) / 11)
      this.canopies.setColorAt(index, tint)
    })

    this.trunks.instanceMatrix.needsUpdate = true
    this.canopies.instanceMatrix.needsUpdate = true
    if (this.trunks.instanceColor) this.trunks.instanceColor.needsUpdate = true
    if (this.canopies.instanceColor) this.canopies.instanceColor.needsUpdate = true

    // Nothing gets close enough for a tree to need per-frame culling maths.
    this.trunks.frustumCulled = false
    this.canopies.frustumCulled = false
    this.group.add(this.trunks, this.canopies)
  }

  /** Char a tree the fire has been through: black, and stripped of needles. */
  burn(index: number): void {
    this.trunks.setColorAt(index, CHARRED_TRUNK)
    this.canopies.setColorAt(index, CHARRED_CANOPY)

    // A burnt conifer is a spike, not a cone: keep its height, lose its spread.
    this.canopies.getMatrixAt(index, this.scratch)
    this.scratch.decompose(this.position, this.rotation, this.scale)
    this.scale.x *= BURNT_SPREAD
    this.scale.z *= BURNT_SPREAD
    this.scratch.compose(this.position, this.rotation, this.scale)
    this.canopies.setMatrixAt(index, this.scratch)
  }

  /** Call once after a batch of burns, rather than per tree. */
  commitBurns(): void {
    this.canopies.instanceMatrix.needsUpdate = true
    if (this.trunks.instanceColor) this.trunks.instanceColor.needsUpdate = true
    if (this.canopies.instanceColor) this.canopies.instanceColor.needsUpdate = true
  }
}

const TRUNK_RADIUS = 0.5
const BARK = new THREE.Color(0x8a5a33)
const NEEDLE_DARK = new THREE.Color(0x2c9a4b)
const NEEDLE_LIGHT = new THREE.Color(0x74d96c)
const CHARRED_TRUNK = new THREE.Color(0x241d19)
const CHARRED_CANOPY = new THREE.Color(0x14100e)
/** How much of its spread a burnt canopy keeps. */
const BURNT_SPREAD = 0.3
