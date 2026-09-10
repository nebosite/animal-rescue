import { describe, expect, it } from 'vitest'
import { impulseResponse } from './Reverb'

const meanAbs = (samples: Float32Array, from: number, to: number) => {
  let sum = 0
  for (let i = from; i < to; i++) sum += Math.abs(samples[i])
  return sum / (to - from)
}

describe('impulseResponse', () => {
  it('produces a stereo pair of the requested length', () => {
    const [left, right] = impulseResponse(48000, 2)
    expect(left.length).toBe(96000)
    expect(right.length).toBe(96000)
  })

  it('is loud at the start and fades to almost nothing by the end', () => {
    const [left] = impulseResponse(48000, 2)
    const n = left.length
    const head = meanAbs(left, 0, n / 10)
    const tail = meanAbs(left, n - n / 10, n)
    expect(head).toBeGreaterThan(0.05)
    expect(tail).toBeLessThan(head / 10)
  })

  it('keeps every sample inside the audio range', () => {
    const [left] = impulseResponse(48000, 1)
    for (const sample of left) expect(Math.abs(sample)).toBeLessThanOrEqual(1)
  })

  it('gives the two channels different noise, so the space has width', () => {
    const [left, right] = impulseResponse(48000, 0.5)
    let identical = 0
    for (let i = 0; i < left.length; i++) if (left[i] === right[i]) identical++
    expect(identical).toBeLessThan(left.length / 100)
  })
})
