import * as THREE from 'three'

/**
 * A procedural stone surface: a mottled colour map and a matching bump map,
 * built out of tileable value noise in plain arrays.
 *
 * No canvas and no image file. The world is built and exercised in a plain
 * Node test with no DOM at all, so `document.createElement('canvas')` is not
 * available — and there is nothing to load over the wire either, which keeps
 * the "sharing is a URL" promise intact.
 *
 * The noise is *periodic*: every octave hashes its lattice modulo the number
 * of cells across the tile, so the pattern meets itself at the edges. Without
 * that, the seam shows up as a bright line running round every rock.
 */
export class StoneTexture {
  /** Mottled grey-brown grain, multiplied into the per-instance stone colour. */
  readonly map: THREE.DataTexture
  /** The same grain as relief, so the light catches the pits and crystals. */
  readonly bump: THREE.DataTexture

  constructor(size = SIZE) {
    const colour = new Uint8Array(size * size * 4)
    const relief = new Uint8Array(size * size * 4)

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Four octaves: broad blotches of darker and lighter stone, down to a
        // per-pixel grit that reads as crystal when the light is low.
        let grain = 0
        let amplitude = 1
        let total = 0
        let cells = BASE_CELLS
        for (let octave = 0; octave < OCTAVES; octave++) {
          grain += amplitude * periodic(x, y, size, cells, octave)
          total += amplitude
          amplitude *= 0.52
          cells *= 2
        }
        grain /= total

        // Ridged on top of that, which puts cracks and veins in it rather than
        // a uniform fuzz — the difference between stone and sandpaper.
        const veins = 1 - Math.abs(periodic(x, y, size, VEIN_CELLS, 11) * 2 - 1)
        const shade = clamp01(grain * 0.78 + veins * 0.22)

        const at = (y * size + x) * 4
        // Warm where it is light, cool and dark in the pits.
        const tone = DARK + (LIGHT - DARK) * shade
        colour[at] = tone * (0.94 + 0.12 * shade)
        colour[at + 1] = tone * 0.97
        colour[at + 2] = tone * (1.04 - 0.1 * shade)
        colour[at + 3] = 255

        const height = clamp01(shade * 1.15 - 0.07) * 255
        relief[at] = height
        relief[at + 1] = height
        relief[at + 2] = height
        relief[at + 3] = 255
      }
    }

    this.map = tile(colour, size)
    this.bump = tile(relief, size)
  }
}

/** A repeating, mipmapped data texture ready to wrap round a rock. */
function tile(data: Uint8Array, size: number): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

/**
 * Smoothly interpolated value noise over a tile `size` pixels across, divided
 * into `cells` lattice cells, wrapping at the edges.
 */
function periodic(x: number, y: number, size: number, cells: number, channel: number): number {
  const u = (x / size) * cells
  const v = (y / size) * cells
  const iu = Math.floor(u)
  const iv = Math.floor(v)
  const fu = u - iu
  const fv = v - iv
  const su = fu * fu * (3 - 2 * fu)
  const sv = fv * fv * (3 - 2 * fv)

  const a = hash(iu % cells, iv % cells, cells, channel)
  const b = hash((iu + 1) % cells, iv % cells, cells, channel)
  const c = hash(iu % cells, (iv + 1) % cells, cells, channel)
  const d = hash((iu + 1) % cells, (iv + 1) % cells, cells, channel)

  return a * (1 - su) * (1 - sv) + b * su * (1 - sv) + c * (1 - su) * sv + d * su * sv
}

/** Deterministic 0..1 for a lattice point, so every run gets the same rock. */
function hash(ix: number, iy: number, cells: number, channel: number): number {
  let h = Math.imul(ix + 1, 0x27d4eb2d) ^ Math.imul(iy + 1, 0x9e3779b1) ^ Math.imul(cells * 31 + channel + 7, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35)
  return ((h ^ (h >>> 13)) >>> 0) / 4294967295
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * Pixels across the tile. Big enough that the grain does not visibly repeat on
 * the largest boulders, small enough to build in a few milliseconds at load.
 */
const SIZE = 128
const OCTAVES = 4
/** Lattice cells in the broadest octave, and in the vein pass. */
const BASE_CELLS = 4
const VEIN_CELLS = 11
/** The darkest and lightest the grain goes, before the per-rock tint. */
const DARK = 120
const LIGHT = 255
