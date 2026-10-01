import * as THREE from 'three'
import type { Terrain } from '../game/Terrain'

/**
 * The helicopter's shadow on the ground, with the sun taken as directly
 * overhead — so it sits straight below the machine and says, at a glance, how
 * high you are and what you are over.
 *
 * That is the whole reason it exists. The hardest judgement in the game is the
 * last ten metres of a descent onto an animal, and from a chase camera behind
 * the tail there is almost nothing to read height from. A shadow that grows and
 * fades as you climb, and crawls over the rocks as you drift, answers both
 * questions without a single number on the screen.
 *
 * It is a ring of vertices re-laid on the terrain every frame rather than a
 * flat disc, because a flat disc buries half of itself in any slope worth
 * landing on — and slopes are exactly where the interesting landings are.
 */
export class GroundShadow {
  readonly mesh: THREE.Mesh

  private readonly geometry: THREE.CircleGeometry
  private readonly material: THREE.MeshBasicMaterial
  /**
   * Where each vertex sits on a unit circle. Kept because the positions
   * themselves are rewritten every frame to follow the ground, so there would
   * otherwise be nothing left to scale the next frame's ring from.
   */
  private readonly shape: Float32Array

  constructor(private readonly terrain: Terrain, segments = SEGMENTS) {
    this.geometry = new THREE.CircleGeometry(1, segments)
    this.geometry.rotateX(-Math.PI / 2)
    this.shape = unitShape(this.geometry)

    // Soft at the rim: a hard-edged circle reads as a drawn disc on the ground
    // rather than as a shadow cast onto it.
    this.material = new THREE.MeshBasicMaterial({
      color: SHADOW_COLOR,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      alphaMap: softDisc(),
      // Fogging a shadow toward the sky colour makes it glow; it is darkness,
      // and darkness at distance should simply become less, not become sky.
      fog: false,
      // Both sides: the ring is re-laid on the terrain every frame, and a
      // steep enough slope can turn a triangle over. A shadow that vanishes on
      // exactly the ground that is hardest to land on is worse than none.
      side: THREE.DoubleSide,
    })

    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 1
  }

  /**
   * Put the shadow under the helicopter. `altitude` is height above the ground
   * below, which is what decides how big and how faint it is.
   */
  update(x: number, z: number, altitude: number): void {
    const high = clamp01(Math.max(0, altitude) / FADES_BY)
    // Spreading and fading together is what makes height readable: close to the
    // ground it is a small hard dark patch, and by treetop height it is a broad
    // smudge you have to look for.
    const radius = SIZE * (1 + high * SPREAD)
    this.material.opacity = DARKEST * (1 - high) ** 1.4
    if (this.material.opacity <= 0.001) {
      this.mesh.visible = false
      return
    }
    this.mesh.visible = true

    // Re-lay the ring on whatever the ground is doing underneath, so the shadow
    // creeps over rocks and down into the canyon instead of slicing through it.
    const position = this.geometry.attributes.position
    for (let i = 0; i < position.count; i++) {
      const outX = this.shape[i * 2] * radius
      const outZ = this.shape[i * 2 + 1] * radius
      position.setXYZ(i, outX, this.terrain.heightAt(x + outX, z + outZ) + LIFT, outZ)
    }
    position.needsUpdate = true
    this.mesh.position.set(x, 0, z)
  }

}

/** Remember where each vertex sits on a unit circle, in x and z. */
function unitShape(geometry: THREE.CircleGeometry): Float32Array {
  const position = geometry.attributes.position
  const shape = new Float32Array(position.count * 2)
  for (let i = 0; i < position.count; i++) {
    shape[i * 2] = position.getX(i)
    shape[i * 2 + 1] = position.getZ(i)
  }
  return shape
}

/**
 * A disc that is solid in the middle and fades to nothing at the rim, as a data
 * texture — no canvas, because the world is built and exercised in a plain Node
 * test with no DOM at all.
 */
function softDisc(size = DISC_SIZE): THREE.DataTexture {
  const pixels = new Uint8Array(size * size * 4)
  const middle = (size - 1) / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const away = Math.hypot(x - middle, y - middle) / middle
      const solid = 1 - smoothStep(SOFT_FROM, 1, away)
      // The falloff goes in the colour channels, not in alpha: Three reads an
      // alphaMap from the green channel, so a texture that is white everywhere
      // with the shape in its alpha is a plain hard-edged disc.
      const shade = Math.round(255 * solid)
      const at = (y * size + x) * 4
      pixels[at] = shade
      pixels[at + 1] = shade
      pixels[at + 2] = shade
      pixels[at + 3] = 255
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat)
  texture.needsUpdate = true
  return texture
}

function smoothStep(from: number, to: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

const SEGMENTS = 28
const DISC_SIZE = 64
/** Where across the disc the fade to nothing begins. */
const SOFT_FROM = 0.45
/** The shadow of a helicopter sitting on its skids. */
const SIZE = 5.5
/** How much wider it gets by the height at which it has faded out. */
const SPREAD = 2.2
/** Height above the ground at which the shadow is gone, in metres. */
const FADES_BY = 90
/** How dark it ever gets, with the skids on the ground. */
const DARKEST = 0.42
/** Held just clear of the ground so it does not fight with it. */
const LIFT = 0.12
const SHADOW_COLOR = new THREE.Color(0x101c12)
