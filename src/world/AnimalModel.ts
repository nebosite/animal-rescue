import * as THREE from 'three'
import type { AnimalLook } from '../game/AnimalProfile'

/**
 * A small blocky animal that can take on any look from the roster: coat and
 * accent colours, size, ear shape and tail. Built with its feet at the group
 * origin, so it can be dropped straight onto the ground or slung under the
 * helicopter without fussing over its centre.
 */
export class AnimalModel {
  readonly group = new THREE.Group()
  private readonly coat = new THREE.MeshStandardMaterial({ color: 0xd9a05b, roughness: 0.8 })
  private readonly accent = new THREE.MeshStandardMaterial({ color: 0xf2ddc0, roughness: 0.8 })
  private readonly ears: Record<AnimalLook['ears'], THREE.Object3D>
  private readonly tails: Record<Exclude<AnimalLook['tail'], 'none'>, THREE.Object3D>
  private lookScale = 1
  private placementScale = 1

  constructor() {
    const body = box(1.4, 1.0, 2.2, this.coat)
    body.position.y = 1.4
    this.group.add(body)

    const head = box(0.9, 0.9, 0.9, this.coat)
    head.position.set(0, 2.1, -1.3)
    this.group.add(head)

    const snout = box(0.5, 0.4, 0.5, this.accent)
    snout.position.set(0, 1.9, -1.8)
    this.group.add(snout)

    const chest = box(1.0, 0.5, 0.3, this.accent)
    chest.position.set(0, 1.25, -1.0)
    this.group.add(chest)

    for (const side of [-1, 1]) {
      for (const end of [-1, 1]) {
        const leg = box(0.3, 0.9, 0.3, this.coat)
        leg.position.set(side * 0.45, 0.45, end * 0.7)
        this.group.add(leg)
      }
    }

    this.ears = {
      pointy: this.pair((side) => {
        const ear = box(0.25, 0.6, 0.15, this.coat)
        ear.position.set(side * 0.32, 2.75, -1.25)
        ear.rotation.z = -side * 0.25
        return ear
      }),
      round: this.pair((side) => {
        const ear = box(0.3, 0.3, 0.2, this.coat)
        ear.position.set(side * 0.38, 2.62, -1.2)
        return ear
      }),
      tufted: this.pair((side) => {
        const ear = box(0.18, 0.75, 0.15, this.accent)
        ear.position.set(side * 0.3, 2.85, -1.2)
        return ear
      }),
    }
    for (const ears of Object.values(this.ears)) this.group.add(ears)

    const bushy = box(0.45, 0.45, 1.0, this.accent)
    bushy.position.set(0, 1.55, 1.5)
    const stub = box(0.2, 0.5, 0.2, this.accent)
    stub.position.set(0, 1.7, 1.2)
    this.tails = { bushy, stub }
    for (const tail of Object.values(this.tails)) this.group.add(tail)

    this.applyLook({ coat: 0xd9a05b, accent: 0xf2ddc0, scale: 1, ears: 'round', tail: 'stub' })
  }

  /** Roughly how tall the animal stands at its current scale. */
  get height(): number {
    return TOP_OF_EARS * this.group.scale.y
  }

  /** Become a particular animal. */
  applyLook(look: AnimalLook): void {
    this.coat.color.setHex(look.coat)
    this.accent.color.setHex(look.accent)
    for (const [kind, ears] of Object.entries(this.ears)) ears.visible = kind === look.ears
    for (const [kind, tail] of Object.entries(this.tails)) tail.visible = kind === look.tail
    this.lookScale = look.scale
    this.rescale()
  }

  moveTo(position: THREE.Vector3): void {
    this.group.position.copy(position)
  }

  /** Scale for where it is standing — on a pad, or slung — on top of the animal's own size. */
  setScale(scale: number): void {
    this.placementScale = scale
    this.rescale()
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible
  }

  private rescale(): void {
    this.group.scale.setScalar(this.lookScale * this.placementScale)
  }

  private pair(make: (side: number) => THREE.Object3D): THREE.Group {
    const group = new THREE.Group()
    group.add(make(-1), make(1))
    return group
  }
}

function box(width: number, height: number, depth: number, material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
}

/** Height of the tallest part, unscaled, measured from the feet. */
const TOP_OF_EARS = 3.2
