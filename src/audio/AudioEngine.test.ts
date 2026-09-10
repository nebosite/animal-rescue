import { describe, expect, it } from 'vitest'
import { listenerOrientation } from './AudioEngine'

describe('listenerOrientation', () => {
  it('faces -Z at the initial heading, matching the flight model', () => {
    const forward = listenerOrientation(0)
    expect(forward.x).toBeCloseTo(0)
    expect(forward.y).toBe(0)
    expect(forward.z).toBeCloseTo(-1)
  })

  it('faces -X after a quarter turn to the left', () => {
    const forward = listenerOrientation(Math.PI / 2)
    expect(forward.x).toBeCloseTo(-1)
    expect(forward.z).toBeCloseTo(0)
  })

  it('faces +X after a quarter turn to the right', () => {
    const forward = listenerOrientation(-Math.PI / 2)
    expect(forward.x).toBeCloseTo(1)
    expect(forward.z).toBeCloseTo(0)
  })
})
