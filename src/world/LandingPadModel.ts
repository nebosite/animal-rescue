import * as THREE from 'three'
import type { LandingPad } from '../game/LandingPad'

/**
 * The visible pad: a disc, a rim, and a painted H. Lights up when the
 * helicopter is down on it, so the confirmation is felt in the world and not
 * only read in the HUD.
 */
export class LandingPadModel {
  readonly group = new THREE.Group()
  private readonly deck: THREE.MeshStandardMaterial
  private readonly rim: THREE.MeshStandardMaterial

  constructor(pad: LandingPad, private readonly idleRimColor: number = RIM_COLOR) {
    this.group.position.copy(pad.position)

    this.rim = new THREE.MeshStandardMaterial({ color: idleRimColor, roughness: 0.7 })
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(pad.radius, pad.radius, 0.2, 48), this.rim)
    rim.position.y = 0.1
    this.group.add(rim)

    this.deck = new THREE.MeshStandardMaterial({ color: DECK_COLOR, roughness: 0.9 })
    const deck = new THREE.Mesh(
      new THREE.CylinderGeometry(pad.radius - 0.8, pad.radius - 0.8, 0.22, 48),
      this.deck,
    )
    deck.position.y = 0.12
    this.group.add(deck)

    for (const bar of paintedH()) this.group.add(bar)
  }

  /** Brighten the pad while the helicopter is standing on it. */
  setActive(active: boolean): void {
    this.rim.color.setHex(active ? RIM_ACTIVE_COLOR : this.idleRimColor)
    this.rim.emissive.setHex(active ? RIM_ACTIVE_COLOR : 0x000000)
    this.rim.emissiveIntensity = active ? 0.6 : 0
    this.deck.color.setHex(active ? DECK_ACTIVE_COLOR : DECK_COLOR)
  }
}

function paintedH(): THREE.Mesh[] {
  const paint = new THREE.MeshStandardMaterial({ color: PAINT_COLOR, roughness: 1 })
  const bar = (w: number, d: number, x: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), paint)
    mesh.position.set(x, 0.25, 0)
    return mesh
  }
  return [bar(1.2, 7, -2.4), bar(1.2, 7, 2.4), bar(4.8, 1.2, 0)]
}

const RIM_COLOR = 0x4a5568
const RIM_ACTIVE_COLOR = 0x5fd39a
const DECK_COLOR = 0x252c3a
const DECK_ACTIVE_COLOR = 0x2f4a44
const PAINT_COLOR = 0xd7deeb
