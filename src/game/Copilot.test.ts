import { describe, expect, it } from 'vitest'
import { Copilot, STEADY_ENOUGH, WINCH_FROM, type CopilotView } from './Copilot'

const hovering: CopilotView = {
  takenOver: false,
  carrying: false,
  overAnimal: true,
  heightAboveAnimal: 18,
  speed: 2,
  hasWater: true,
  overThreateningFire: false,
}

const at = (overrides: Partial<CopilotView>) => new Copilot().orders({ ...hovering, ...overrides })

describe('Copilot', () => {
  it('puts the line down when hovering low and steady over an animal', () => {
    expect(at({}).lowerWinch).toBe(true)
  })

  it('holds the line while there is nobody below to pick up', () => {
    expect(at({ overAnimal: false }).lowerWinch).toBe(false)
  })

  it('does not winch for someone already aboard', () => {
    expect(at({ carrying: true }).lowerWinch).toBe(false)
  })

  it('will not pay out from too high, or while the helicopter is moving off', () => {
    expect(at({ heightAboveAnimal: WINCH_FROM + 5 }).lowerWinch).toBe(false)
    expect(at({ speed: STEADY_ENOUGH + 5 }).lowerWinch).toBe(false)
  })

  it('spends water on fire that is threatening someone, and not otherwise', () => {
    expect(at({ overThreateningFire: true }).dropWater).toBe(true)
    expect(at({ overThreateningFire: false }).dropWater).toBe(false)
  })

  it('cannot drop water it does not have', () => {
    expect(at({ overThreateningFire: true, hasWater: false }).dropWater).toBe(false)
  })

  it('keeps his hands to himself once a second player takes the seat', () => {
    const orders = at({ takenOver: true, overAnimal: true, overThreateningFire: true })
    expect(orders.lowerWinch).toBe(false)
    expect(orders.dropWater).toBe(false)
  })
})
