import { describe, expect, it } from 'vitest'
import { Cadence } from './Cadence'

describe('Cadence', () => {
  it('fires on the very first advance', () => {
    expect(new Cadence(2).advance(1 / 60)).toBe(true)
  })

  it('then waits a full period before firing again', () => {
    const cadence = new Cadence(1)
    cadence.advance(1 / 60)
    let fired = 0
    // 59 frames is just short of a second: nothing.
    for (let i = 0; i < 59; i++) if (cadence.advance(1 / 60)) fired++
    expect(fired).toBe(0)
    // The 60th frame completes the period.
    expect(cadence.advance(1 / 60)).toBe(true)
    // And the clock restarts from there.
    for (let i = 0; i < 59; i++) if (cadence.advance(1 / 60)) fired++
    expect(fired).toBe(0)
  })

  it('fires immediately again after a reset', () => {
    const cadence = new Cadence(5)
    cadence.advance(1 / 60)
    cadence.advance(1 / 60)
    cadence.reset()
    expect(cadence.advance(1 / 60)).toBe(true)
  })
})
