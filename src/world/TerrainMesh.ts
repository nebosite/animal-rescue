import * as THREE from 'three'
import type { Terrain } from '../game/Terrain'

/**
 * The visible land: one displaced plane, coloured per vertex by height and
 * steepness so grass, bare rock and the canyon floor read apart without any
 * textures to load.
 *
 * Built once from the Terrain, which stays the authority on where the ground
 * is; this is only its picture.
 */
export class TerrainMesh {
  readonly mesh: THREE.Mesh

  private readonly size: number
  private readonly segments: number
  private readonly colors: Float32Array
  /** The land as it looked before anything burned, so charring can be re-applied. */
  private readonly pristine: Float32Array
  /** How burnt each vertex is, 0..1. */
  private readonly charred: Float32Array

  constructor(terrain: Terrain, segments = SEGMENTS) {
    const size = terrain.halfSize * 2
    this.size = size
    this.segments = segments
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments)
    // Built in the XY plane; lay it down so Y is up.
    geometry.rotateX(-Math.PI / 2)

    const position = geometry.attributes.position
    const colors = new Float32Array(position.count * 3)
    const colour = new THREE.Color()

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i)
      const z = position.getZ(i)
      const height = terrain.heightAt(x, z)
      position.setY(i, height)

      shade(colour, height, terrain.slopeAt(x, z), terrain.canyonDepthAt(x, z), terrain.rockinessAt(x, z))
      colour.toArray(colors, i * 3)
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.computeVertexNormals()
    this.colors = colors
    this.pristine = colors.slice()
    this.charred = new Float32Array(position.count)

    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
    )
    this.mesh.receiveShadow = false
  }

  /**
   * Blacken the ground inside a circle the fire has burned out.
   *
   * The land is one big regular grid, so the vertices under a patch can be
   * indexed straight from its coordinates rather than searched for — which is
   * what makes it cheap enough to do while the fire spreads.
   *
   * Each vertex keeps *how* burnt it is and is repainted from the untouched
   * colour whenever the fire chars it deeper. Darkening it once and then
   * skipping it was the first attempt, and it left the burn almost invisible in
   * play: the circle grows a little at a time, so nearly every vertex is first
   * reached at the rim where the falloff is nil, and the skip then froze it
   * there. Only a jump-cut test that aged the fire in one step made it look
   * right.
   */
  scorch(centreX: number, centreZ: number, radius: number): boolean {
    if (radius <= 0) return false
    const step = this.size / this.segments
    const half = this.size / 2
    const stride = this.segments + 1

    const lowCol = Math.max(0, Math.floor((centreX - radius + half) / step))
    const highCol = Math.min(this.segments, Math.ceil((centreX + radius + half) / step))
    const lowRow = Math.max(0, Math.floor((centreZ - radius + half) / step))
    const highRow = Math.min(this.segments, Math.ceil((centreZ + radius + half) / step))

    let changed = false
    for (let row = lowRow; row <= highRow; row++) {
      const z = row * step - half
      for (let col = lowCol; col <= highCol; col++) {
        const x = col * step - half
        const distance = Math.hypot(x - centreX, z - centreZ)
        if (distance > radius) continue

        // Black through the middle of the burn, easing off over the last of it
        // so the scar has no cut-out rim.
        const index = row * stride + col
        const deep = Math.min(1, (1 - distance / radius) / CHAR_EDGE)
        if (deep <= this.charred[index]) continue

        this.charred[index] = deep
        const at = index * 3
        this.colors[at] = this.pristine[at] + (ASH.r - this.pristine[at]) * deep
        this.colors[at + 1] = this.pristine[at + 1] + (ASH.g - this.pristine[at + 1]) * deep
        this.colors[at + 2] = this.pristine[at + 2] + (ASH.b - this.pristine[at + 2]) * deep
        changed = true
      }
    }

    if (changed) this.mesh.geometry.attributes.color.needsUpdate = true
    return changed
  }
}

/** Pick a ground colour: canyon rock, grass, or bare stone where it is steep or high. */
function shade(out: THREE.Color, height: number, slope: number, canyon: number, rockiness: number): void {
  const highness = clamp01((height - TREELINE_LOW) / (TREELINE_HIGH - TREELINE_LOW))
  const bareness = clamp01(Math.max(highness, (slope - 0.25) / 0.45, rockiness * 0.8))

  out.copy(GRASS).lerp(MEADOW, clamp01(height / 40))
  out.lerp(ROCK, bareness)
  out.lerp(CANYON_ROCK, canyon * 0.9)
  // Streak the bedrock light and dark so the crags read as strata rather
  // than one flat orange.
  out.lerp(STRATA, canyon * clamp01((slope - 0.2) / 0.6) * 0.7)
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * More polygons than the land strictly needs on the hills, because the canyon
 * crags do need them: at 220 the bedrock read as smooth folds instead of rock.
 */
const SEGMENTS = 340

// Saturated and sunny on purpose: fresh grass, yellow-green meadow, warm
// stone, and an orange canyon — a place that looks like fun to fly over.
const GRASS = new THREE.Color(0x5fbd55)
const MEADOW = new THREE.Color(0x9bd45c)
const ROCK = new THREE.Color(0xbcb09e)
const CANYON_ROCK = new THREE.Color(0xd4884f)
const STRATA = new THREE.Color(0x9a6a4a)
/** What the fire leaves behind it. */
const ASH = new THREE.Color(0x201b17)
/** The outer fraction of a burn over which the char fades out to nothing. */
const CHAR_EDGE = 0.35
/** Above this the hills start going bare; by the upper figure they are stone. */
const TREELINE_LOW = 46
const TREELINE_HIGH = 78
