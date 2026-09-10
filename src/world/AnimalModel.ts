import * as THREE from 'three'

/**
 * A small blocky animal — body, head, ears, legs. Built with its feet at the
 * group origin, so it can be dropped straight onto a pad or slung under the
 * helicopter without fussing over its centre.
 */
export class AnimalModel {
  readonly group = new THREE.Group()

  constructor() {

    const body = box(1.4, 1.0, 2.2, COAT_COLOR)
    body.position.y = 1.4
    this.group.add(body)

    const head = box(0.9, 0.9, 0.9, COAT_COLOR)
    head.position.set(0, 2.1, -1.3)
    this.group.add(head)

    const snout = box(0.5, 0.4, 0.5, SNOUT_COLOR)
    snout.position.set(0, 1.9, -1.8)
    this.group.add(snout)

    for (const side of [-1, 1]) {
      const ear = box(0.25, 0.5, 0.2, COAT_COLOR)
      ear.position.set(side * 0.3, 2.7, -1.3)
      this.group.add(ear)

      for (const end of [-1, 1]) {
        const leg = box(0.3, 0.9, 0.3, LEG_COLOR)
        leg.position.set(side * 0.45, 0.45, end * 0.7)
        this.group.add(leg)
      }
    }

    const tail = box(0.2, 0.5, 0.2, SNOUT_COLOR)
    tail.position.set(0, 1.7, 1.2)
    this.group.add(tail)
  }

  /** Roughly how tall the animal stands at the given scale. */
  static heightAt(scale: number): number {
    return TOP_OF_EARS * scale
  }

  moveTo(position: THREE.Vector3): void {
    this.group.position.copy(position)
  }

  setScale(scale: number): void {
    this.group.scale.setScalar(scale)
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible
  }
}

function box(width: number, height: number, depth: number, color: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
  )
}

/** Height of the tallest part, unscaled, measured from the feet. */
const TOP_OF_EARS = 2.95
const COAT_COLOR = 0xd9a05b
const SNOUT_COLOR = 0xf2ddc0
const LEG_COLOR = 0x8a6238
