import { describe, expect, it } from 'vitest'
import { MAX_LEVEL, Upgrades } from './Upgrades'

describe('Upgrades', () => {
  it('starts as a stock helicopter', () => {
    const upgrades = new Upgrades()
    expect(upgrades.animalSlots).toBe(1)
    expect(upgrades.enginePower).toBe(1)
    expect(upgrades.heatRise).toBe(1)
    expect(upgrades.tankLoads(4)).toBe(4)
  })

  it('charges against the score, and does not buy what it cannot afford', () => {
    const upgrades = new Upgrades()
    expect(upgrades.buy('motor', 150)).toBe(false)
    expect(upgrades.levels.motor).toBe(0)
    expect(upgrades.buy('motor', 500)).toBe(true)
    expect(upgrades.balance(500)).toBe(300)
    expect(upgrades.enginePower).toBeGreaterThan(1)
  })

  it('costs more for each level, and stops at the top', () => {
    const upgrades = new Upgrades()
    const prices: number[] = []
    for (let i = 0; i < MAX_LEVEL; i++) {
      prices.push(upgrades.price('tank')!)
      expect(upgrades.buy('tank', 99999)).toBe(true)
    }
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
    expect(new Set(prices).size).toBe(MAX_LEVEL)
    expect(upgrades.price('tank')).toBeNull()
    expect(upgrades.buy('tank', 99999)).toBe(false)
    expect(upgrades.tankLoads(4)).toBe(4 + 2 * MAX_LEVEL)
  })

  it('turns each upgrade into the number its owner reads', () => {
    const upgrades = new Upgrades()
    upgrades.buy('slot', 99999)
    upgrades.buy('fireproof', 99999)
    expect(upgrades.animalSlots).toBe(2)
    expect(upgrades.heatRise).toBeLessThan(1)
    expect(upgrades.heatRise).toBeGreaterThan(0)
  })

  it('goes back to stock for a new game', () => {
    const upgrades = new Upgrades()
    upgrades.buy('motor', 99999)
    upgrades.reset()
    expect(upgrades.enginePower).toBe(1)
    expect(upgrades.balance(100)).toBe(100)
  })
})
