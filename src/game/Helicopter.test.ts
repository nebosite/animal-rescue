import { describe, expect, it } from 'vitest'
import { Helicopter } from './Helicopter'
import { noInput } from './FlightInput'

function fly(overrides: Partial<ReturnType<typeof noInput>>, seconds = 1) {
  const helicopter = new Helicopter()
  helicopter.update({ ...noInput(), ...overrides }, seconds)
  return helicopter
}

describe('Helicopter', () => {
  it('stays put with no input', () => {
    const start = new Helicopter().position.clone()
    expect(fly({}).position).toEqual(start)
  })

  it('flies right and left along X', () => {
    expect(fly({ right: true }).position.x).toBeGreaterThan(0)
    expect(fly({ left: true }).position.x).toBeLessThan(0)
  })

  it('flies forward away from the camera along -Z', () => {
    expect(fly({ forward: true }).position.z).toBeLessThan(0)
    expect(fly({ back: true }).position.z).toBeGreaterThan(0)
  })

  it('climbs and descends along Y', () => {
    const start = new Helicopter().position.y
    expect(fly({ up: true }).position.y).toBeGreaterThan(start)
    expect(fly({ down: true }).position.y).toBeLessThan(start)
  })

  it('moves twice as far in twice the time', () => {
    const short = fly({ right: true }, 0.5).position.x
    const long = fly({ right: true }, 1).position.x
    expect(long).toBeCloseTo(short * 2)
  })

  it('does not fly faster diagonally than straight', () => {
    const straight = fly({ right: true }).position.x
    const diagonal = fly({ right: true, forward: true }).position
    const distance = Math.hypot(diagonal.x, diagonal.z)
    expect(distance).toBeCloseTo(straight)
  })

  it('cannot sink through the ground', () => {
    const helicopter = new Helicopter()
    for (let i = 0; i < 100; i++) helicopter.update({ ...noInput(), down: true }, 1)
    expect(helicopter.position.y).toBeGreaterThan(0)
  })

  it('stays inside the grid', () => {
    const helicopter = new Helicopter()
    for (let i = 0; i < 100; i++) helicopter.update({ ...noInput(), right: true }, 1)
    expect(helicopter.position.x).toBeLessThanOrEqual(150)
  })
})
