/**
 * Classic 3D Perlin noise.
 *
 * Gradient noise rather than the value noise the terrain uses, because this is
 * for *flow*: what matters is that the field is smooth and that neighbouring
 * points move together, so that a few thousand sparks drifting through it twist
 * as a column rather than as a few thousand independent specks. Value noise
 * gives visible lattice artefacts at the scales a flame wants.
 *
 * Deterministic from a seed, with no dependencies and no renderer, so it can be
 * exercised in a plain test.
 */
export class PerlinNoise {
  /** The permutation table, doubled so lookups never have to wrap by hand. */
  private readonly perm = new Uint8Array(512)

  constructor(seed = 1) {
    const order = new Uint8Array(256)
    for (let i = 0; i < 256; i++) order[i] = i

    // Fisher–Yates, driven by a small deterministic generator so a given seed
    // always produces the same field.
    let state = (seed * 0x9e3779b1) >>> 0 || 1
    for (let i = 255; i > 0; i--) {
      state ^= state << 13
      state ^= state >>> 17
      state ^= state << 5
      state >>>= 0
      const j = state % (i + 1)
      const swap = order[i]
      order[i] = order[j]
      order[j] = swap
    }

    for (let i = 0; i < 512; i++) this.perm[i] = order[i & 255]
  }

  /** Noise at a point, in roughly -1..1. */
  at(x: number, y: number, z: number): number {
    const xi = Math.floor(x) & 255
    const yi = Math.floor(y) & 255
    const zi = Math.floor(z) & 255
    const xf = x - Math.floor(x)
    const yf = y - Math.floor(y)
    const zf = z - Math.floor(z)

    const u = fade(xf)
    const v = fade(yf)
    const w = fade(zf)

    const p = this.perm
    const a = p[xi] + yi
    const aa = p[a] + zi
    const ab = p[a + 1] + zi
    const b = p[xi + 1] + yi
    const ba = p[b] + zi
    const bb = p[b + 1] + zi

    return lerp(
      lerp(
        lerp(grad(p[aa], xf, yf, zf), grad(p[ba], xf - 1, yf, zf), u),
        lerp(grad(p[ab], xf, yf - 1, zf), grad(p[bb], xf - 1, yf - 1, zf), u),
        v,
      ),
      lerp(
        lerp(grad(p[aa + 1], xf, yf, zf - 1), grad(p[ba + 1], xf - 1, yf, zf - 1), u),
        lerp(grad(p[ab + 1], xf, yf - 1, zf - 1), grad(p[bb + 1], xf - 1, yf - 1, zf - 1), u),
        v,
      ),
      w,
    )
  }
}

/** The 6t⁵-15t⁴+10t³ ease that gives Perlin noise its continuous derivative. */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

/** Dot the corner's pseudo-random gradient with the offset to the point. */
function grad(hash: number, x: number, y: number, z: number): number {
  const h = hash & 15
  const u = h < 8 ? x : y
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z
  return (h & 1 ? -u : u) + (h & 2 ? -v : v)
}
