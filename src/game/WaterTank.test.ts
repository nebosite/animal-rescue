import { describe, expect, it } from 'vitest'
import { LOADS, WaterTank } from './WaterTank'

describe('WaterTank', () => {
  it('starts full', () => {
    const tank = new WaterTank()
    expect(tank.fraction).toBe(1)
    expect(tank.loads).toBe(LOADS)
    expect(tank.hasWater).toBe(true)
  })

  it('gives exactly as many drops as it holds, then runs dry', () => {
    const tank = new WaterTank()
    for (let i = 0; i < LOADS; i++) expect(tank.drop()).toBe(true)
    expect(tank.hasWater).toBe(false)
    expect(tank.drop()).toBe(false)
    expect(tank.fraction).toBe(0)
  })

  it('empties a little at a time, so the gauge means something', () => {
    const tank = new WaterTank()
    tank.drop()
    expect(tank.fraction).toBeCloseTo((LOADS - 1) / LOADS)
    expect(tank.loads).toBe(LOADS - 1)
  })

  it('refills on the pad, and stops at full', () => {
    const tank = new WaterTank()
    while (tank.drop()) { /* empty it */ }
    tank.refill(4)
    expect(tank.fraction).toBeGreaterThan(0.4)
    expect(tank.fraction).toBeLessThan(1)
    tank.refill(30)
    expect(tank.fraction).toBe(1)
  })

  it('takes a while to fill, so a water run costs you time', () => {
    const tank = new WaterTank()
    while (tank.drop()) { /* empty it */ }
    tank.refill(1)
    expect(tank.loads).toBeLessThan(LOADS)
  })
})
