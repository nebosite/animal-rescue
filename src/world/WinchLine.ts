import * as THREE from 'three'

/**
 * The winch line and its hook, hanging out of the helicopter's door.
 *
 * Drawn as a single thin cylinder scaled to the line's length rather than
 * rebuilt each frame, with a small hook on the end so there is something to
 * aim at when the copilot is trying to catch a frightened animal.
 */
export class WinchLine {
  readonly group = new THREE.Group()
  private readonly cable: THREE.Mesh
  private readonly hook: THREE.Mesh

  constructor() {
    // A unit-tall cylinder with its top at the origin, so scaling Y pays it out.
    const geometry = new THREE.CylinderGeometry(CABLE_RADIUS, CABLE_RADIUS, 1, 5)
    geometry.translate(0, -0.5, 0)
    this.cable = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.7 }))
    this.group.add(this.cable)

    this.hook = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.28, 6, 10),
      new THREE.MeshStandardMaterial({ color: 0xd8c88a, roughness: 0.4, metalness: 0.6 }),
    )
    this.hook.rotation.x = Math.PI / 2
    this.group.add(this.hook)

    this.group.visible = false
  }

  /** Hang the line from a helicopter at `from`, paid out to `length`. */
  update(from: THREE.Vector3, length: number): void {
    if (length <= 0.05) {
      this.group.visible = false
      return
    }
    this.group.visible = true
    this.group.position.copy(from).add(DOOR_OFFSET)
    this.cable.scale.y = length
    this.hook.position.y = -length
  }
}

const CABLE_RADIUS = 0.13
/** Out of the side door, not the middle of the floor. */
const DOOR_OFFSET = new THREE.Vector3(1.2, -1.2, 0)
