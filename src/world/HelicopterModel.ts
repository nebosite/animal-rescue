import * as THREE from 'three'

/**
 * A deliberately crude helicopter: a body, a tail, skids, and a spinning rotor.
 * Enough to read as a helicopter and to see which way it is facing. Nose points
 * down -Z, which is "forward" for the flight model.
 */
export class HelicopterModel {
  readonly group = new THREE.Group()
  private readonly rotor: THREE.Group

  constructor() {
    const body = box(3, 2.2, 5, BODY_COLOR)
    body.position.y = 0.4
    this.group.add(body)

    // Sloped nose, faked by a smaller block pushed forward and down.
    const nose = box(2.4, 1.4, 1.6, BODY_COLOR)
    nose.position.set(0, 0, -3)
    this.group.add(nose)

    const boom = box(0.7, 0.7, 5, BODY_COLOR)
    boom.position.set(0, 0.8, 4)
    this.group.add(boom)

    const fin = box(0.3, 1.8, 1, ACCENT_COLOR)
    fin.position.set(0, 1.6, 6)
    this.group.add(fin)

    const tailRotor = box(0.2, 1.6, 1.6, ROTOR_COLOR)
    tailRotor.position.set(0.5, 0.8, 6)
    this.group.add(tailRotor)

    const mast = box(0.4, 1, 0.4, ROTOR_COLOR)
    mast.position.y = 1.8
    this.group.add(mast)

    for (const side of [-1, 1]) {
      const skid = box(0.25, 0.25, 4.5, ROTOR_COLOR)
      skid.position.set(side * 1.2, -1.4, 0)
      this.group.add(skid)
      const strut = box(0.2, 1, 0.2, ROTOR_COLOR)
      strut.position.set(side * 1.2, -0.9, 0)
      this.group.add(strut)
    }

    // Two crossed blades, spun as one group.
    this.rotor = new THREE.Group()
    this.rotor.position.y = 2.3
    for (const angle of [0, Math.PI / 2]) {
      const blade = box(14, 0.12, 0.7, ROTOR_COLOR)
      blade.rotation.y = angle
      this.rotor.add(blade)
    }
    this.group.add(this.rotor)
  }

  /** Spin the blades. Purely cosmetic — the flight model knows nothing of it. */
  spin(dt: number): void {
    this.rotor.rotation.y += ROTOR_SPEED * dt
  }

  moveTo(position: THREE.Vector3): void {
    this.group.position.copy(position)
  }
}

function box(width: number, height: number, depth: number, color: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 }),
  )
}

const BODY_COLOR = 0xc4483a
const ACCENT_COLOR = 0xe0e4ec
const ROTOR_COLOR = 0x39404f
const ROTOR_SPEED = 18
