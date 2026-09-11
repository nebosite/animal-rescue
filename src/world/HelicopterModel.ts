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

    // Two crossed blades, spun as one group. They are part-transparent and sit
    // inside a faint disc: at rotor speed a real blade is a smear, and a solid
    // blade reads as a slowly turning plank however fast it is actually spun.
    this.rotor = new THREE.Group()
    this.rotor.position.y = 2.3
    for (const angle of [0, Math.PI / 2]) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(BLADE_SPAN, 0.12, 0.7),
        new THREE.MeshStandardMaterial({ color: ROTOR_COLOR, roughness: 0.6, transparent: true, opacity: 0.5 }),
      )
      blade.rotation.y = angle
      this.rotor.add(blade)
    }
    this.group.add(this.rotor)
    this.group.add(blurDisc(BLADE_SPAN / 2, 2.3))

    // The tail rotor smears too, seen edge-on from the chase camera.
    const tailBlur = blurDisc(1.5, 0.8)
    tailBlur.rotation.z = Math.PI / 2
    tailBlur.position.set(0.55, 0.8, 6)
    this.group.add(tailBlur)
  }

  /** Spin the blades. Purely cosmetic — the flight model knows nothing of it. */
  spin(dt: number): void {
    this.rotor.rotation.y += ROTOR_SPEED * dt
  }

  moveTo(position: THREE.Vector3): void {
    this.group.position.copy(position)
  }

  /**
   * Point the nose along `heading` and lean by `pitch` (positive nose-down) and
   * `roll` (positive right-side-down). Yaw is applied first, then the leans in
   * the body frame, which is what YXZ order means.
   *
   * Three.js rotates the nose *up* for positive X and the right side *up* for
   * positive Z, so both leans are negated here to match the flight model.
   */
  setAttitude(heading: number, pitch: number, roll: number): void {
    this.group.rotation.set(-pitch, heading, -roll, 'YXZ')
  }
}

function box(width: number, height: number, depth: number, color: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 }),
  )
}

/**
 * The smear a spinning rotor leaves: a barely-there disc in the blade plane.
 * Unlit so it reads the same against sky or ground, and it does not write
 * depth, so the blades and the hull stay visible through it.
 */
function blurDisc(radius: number, height: number): THREE.Mesh {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 48),
    new THREE.MeshBasicMaterial({
      color: ROTOR_COLOR,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  )
  disc.rotation.x = -Math.PI / 2
  disc.position.y = height
  return disc
}

const BLADE_SPAN = 14
const BODY_COLOR = 0xc4483a
const ACCENT_COLOR = 0xe0e4ec
const ROTOR_COLOR = 0x39404f
const ROTOR_SPEED = 18
