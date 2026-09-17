import * as THREE from 'three'
import { CANOPY_HEIGHT, CANOPY_RADIUS, TRUNK_HEIGHT, type TreeCover } from '../game/TreeCover'

/**
 * The picture of the forest: two instanced meshes, one for trunks and one for
 * canopies, so the whole wood costs two draw calls.
 *
 * Where the trees are is decided by `TreeCover`, which the flight loop also
 * asks about collisions — so what you can see and what you can hit are by
 * construction the same forest.
 */
export class Forest {
  readonly group = new THREE.Group()

  constructor(cover: TreeCover) {
    const count = Math.max(1, cover.trees.length)

    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(TRUNK_RADIUS * 0.7, TRUNK_RADIUS, TRUNK_HEIGHT, 5),
      new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.95 }),
      count,
    )
    const canopies = new THREE.InstancedMesh(
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
      trunks.setMatrixAt(index, transform.matrix)

      transform.position.y = tree.ground + (TRUNK_HEIGHT * 0.85 + CANOPY_HEIGHT / 2) * tree.scale
      transform.updateMatrix()
      canopies.setMatrixAt(index, transform.matrix)

      // Vary the green so the wood does not read as one flat mass.
      tint.copy(NEEDLE_DARK).lerp(NEEDLE_LIGHT, (index % 11) / 11)
      canopies.setColorAt(index, tint)
    })

    trunks.instanceMatrix.needsUpdate = true
    canopies.instanceMatrix.needsUpdate = true
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true

    // Nothing gets close enough for a tree to need per-frame culling maths.
    trunks.frustumCulled = false
    canopies.frustumCulled = false
    this.group.add(trunks, canopies)
  }
}

const TRUNK_RADIUS = 0.5
const NEEDLE_DARK = new THREE.Color(0x2c9a4b)
const NEEDLE_LIGHT = new THREE.Color(0x74d96c)
