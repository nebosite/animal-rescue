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

  constructor(terrain: Terrain, segments = SEGMENTS) {
    const size = terrain.halfSize * 2
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

      shade(colour, height, terrain.slopeAt(x, z), terrain.canyonDepthAt(x, z))
      colour.toArray(colors, i * 3)
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.computeVertexNormals()

    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
    )
    this.mesh.receiveShadow = false
  }
}

/** Pick a ground colour: canyon rock, grass, or bare stone where it is steep or high. */
function shade(out: THREE.Color, height: number, slope: number, canyon: number): void {
  const highness = clamp01((height - TREELINE_LOW) / (TREELINE_HIGH - TREELINE_LOW))
  const bareness = clamp01(Math.max(highness, (slope - 0.3) / 0.5))

  out.copy(GRASS).lerp(MEADOW, clamp01(height / 40))
  out.lerp(ROCK, bareness)
  out.lerp(CANYON_ROCK, canyon * 0.85)
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

const SEGMENTS = 220

const GRASS = new THREE.Color(0x2f4a34)
const MEADOW = new THREE.Color(0x3d5638)
const ROCK = new THREE.Color(0x5a5a57)
const CANYON_ROCK = new THREE.Color(0x4a3a30)
/** Above this the hills start going bare; by the upper figure they are stone. */
const TREELINE_LOW = 46
const TREELINE_HIGH = 78
