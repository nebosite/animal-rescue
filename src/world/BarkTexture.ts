import * as THREE from 'three'

/**
 * Redwood bark as a pair of data textures: a fibrous red-brown colour map and a
 * matching bump map of deep vertical furrows.
 *
 * Redwood bark is not noise. It is *fluted* — long vertical ribs and grooves
 * running the whole height of the trunk, fibrous and stringy rather than
 * cracked into plates, and a deep red-brown that goes almost purple in the
 * furrows. So the noise here is stretched hard along the trunk: wide in the
 * grain and narrow around the circumference, which is what turns a fuzz into
 * fibres.
 *
 * Built from arrays, not a canvas. The world is constructed and exercised in a
 * plain Node test with no DOM at all, and there is nothing to fetch over the
 * wire either.
 */
export class BarkTexture {
  readonly map: THREE.DataTexture
  readonly bump: THREE.DataTexture

  constructor(size = SIZE) {
    const colour = new Uint8Array(size * size * 4)
    const relief = new Uint8Array(size * size * 4)

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // The fluting: ridged noise that is many cells around the trunk and
        // very few up it, so every feature is drawn out into a long fibre.
        let fibre = 0
        let amplitude = 1
        let total = 0
        let around = RIB_CELLS
        let up = RIB_CELLS / STRETCH
        for (let octave = 0; octave < OCTAVES; octave++) {
          const value = periodic(x, y, size, Math.round(around), Math.max(1, Math.round(up)), octave)
          // Folded about its midpoint: smooth noise gives soft humps, and the
          // fold is what puts a crease at the bottom of every groove.
          fibre += amplitude * (1 - Math.abs(value * 2 - 1))
          total += amplitude
          amplitude *= 0.5
          around *= 2
          up *= 2
        }
        fibre /= total

        // A slow swell around the trunk, so the ribs gather into the broad
        // flutes a redwood actually has rather than spreading evenly.
        const flute = periodic(x, y, size, FLUTE_CELLS, 1, 31)
        const depth = clamp01(fibre * 0.72 + flute * 0.28)

        const at = (y * size + x) * 4
        // Red-brown on the ridges, nearly black-purple down in the grooves.
        colour[at] = lerp(GROOVE_R, RIDGE_R, depth)
        colour[at + 1] = lerp(GROOVE_G, RIDGE_G, depth)
        colour[at + 2] = lerp(GROOVE_B, RIDGE_B, depth)
        colour[at + 3] = 255

        const height = Math.round(255 * clamp01(depth * 1.2 - 0.1))
        relief[at] = height
        relief[at + 1] = height
        relief[at + 2] = height
        relief[at + 3] = 255
      }
    }

    this.map = wrap(colour, size)
    this.bump = wrap(relief, size)
  }
}

/** A repeating, mipmapped data texture ready to go round a trunk. */
function wrap(data: Uint8Array, size: number): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  // Once around the trunk, several times up it: the trees vary in height by
  // half again, and the grain should stay the same size on all of them.
  texture.repeat.set(1, REPEATS_UP)
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

/**
 * Smoothly interpolated value noise over a tile `size` pixels across, with a
 * different number of lattice cells across and down, wrapping at both edges.
 * The two counts are what let the grain be stretched into fibres.
 */
function periodic(x: number, y: number, size: number, across: number, down: number, channel: number): number {
  const u = (x / size) * across
  const v = (y / size) * down
  const iu = Math.floor(u)
  const iv = Math.floor(v)
  const fu = u - iu
  const fv = v - iv
  const su = fu * fu * (3 - 2 * fu)
  const sv = fv * fv * (3 - 2 * fv)

  const a = hash(iu % across, iv % down, channel)
  const b = hash((iu + 1) % across, iv % down, channel)
  const c = hash(iu % across, (iv + 1) % down, channel)
  const d = hash((iu + 1) % across, (iv + 1) % down, channel)

  return a * (1 - su) * (1 - sv) + b * su * (1 - sv) + c * (1 - su) * sv + d * su * sv
}

/** Deterministic 0..1 for a lattice point, so every run grows the same bark. */
function hash(ix: number, iy: number, channel: number): number {
  let h = Math.imul(ix + 1, 0x7feb352d) ^ Math.imul(iy + 1, 0x846ca68b) ^ Math.imul(channel + 13, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35)
  return ((h ^ (h >>> 13)) >>> 0) / 4294967295
}

function lerp(from: number, to: number, t: number): number {
  return Math.round(from + (to - from) * t)
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

const SIZE = 128
const OCTAVES = 4
/** Lattice cells around the trunk in the broadest octave... */
const RIB_CELLS = 14
/** ...divided by this going up it, which is what draws the grain into fibres. */
const STRETCH = 7
/** The slow swell that gathers the ribs into broad flutes. */
const FLUTE_CELLS = 5
/** How many times the grain repeats up a trunk. */
const REPEATS_UP = 3

/** Redwood: warm red-brown on the ridges, nearly black in the grooves. */
const RIDGE_R = 196
const RIDGE_G = 114
const RIDGE_B = 76
const GROOVE_R = 64
const GROOVE_G = 32
const GROOVE_B = 24
