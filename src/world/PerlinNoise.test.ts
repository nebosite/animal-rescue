import { describe, expect, it } from 'vitest'
import { PerlinNoise } from './PerlinNoise'

const noise = new PerlinNoise(7)

describe('PerlinNoise', () => {
  it('stays inside the range the rest of the code assumes', () => {
    let lowest = Infinity
    let highest = -Infinity
    for (let i = 0; i < 20000; i++) {
      const value = noise.at(i * 0.37, i * 0.11 + 3.3, i * 0.53 - 7.1)
      lowest = Math.min(lowest, value)
      highest = Math.max(highest, value)
    }
    expect(lowest).toBeGreaterThanOrEqual(-1.05)
    expect(highest).toBeLessThanOrEqual(1.05)
    // And it actually uses the range, rather than hugging zero.
    expect(highest).toBeGreaterThan(0.6)
    expect(lowest).toBeLessThan(-0.6)
  })

  it('is zero on the lattice, as gradient noise is', () => {
    for (const at of [0, 1, 5, 17, -3]) {
      expect(Math.abs(noise.at(at, at, at))).toBeLessThan(1e-9)
    }
  })

  it('is smooth: neighbouring points move together', () => {
    // This is the whole reason for using gradient noise here. A field that
    // jumps between nearby points scatters the sparks instead of twisting them
    // into a column.
    let biggestJump = 0
    let previous = noise.at(0, 0, 0)
    for (let i = 1; i < 4000; i++) {
      const value = noise.at(i * 0.01, 2.5, -1.25)
      biggestJump = Math.max(biggestJump, Math.abs(value - previous))
      previous = value
    }
    expect(biggestJump).toBeLessThan(0.05)
  })

  it('gives the same field every time for a seed, and different fields for different seeds', () => {
    const again = new PerlinNoise(7)
    const other = new PerlinNoise(8)
    let same = 0
    let differs = 0
    for (let i = 0; i < 500; i++) {
      const at: [number, number, number] = [i * 0.31, i * 0.17, i * 0.07]
      expect(again.at(...at)).toBe(noise.at(...at))
      if (other.at(...at) === noise.at(...at)) same++
      else differs++
    }
    expect(differs).toBeGreaterThan(same)
  })

  it('varies in all three dimensions', () => {
    // A flame column samples a drifting field, so a noise that ignored one
    // axis would make every spark at a given height drift the same way.
    const base = noise.at(1.3, 2.7, 4.1)
    expect(noise.at(2.3, 2.7, 4.1)).not.toBe(base)
    expect(noise.at(1.3, 3.7, 4.1)).not.toBe(base)
    expect(noise.at(1.3, 2.7, 5.1)).not.toBe(base)
  })
})
