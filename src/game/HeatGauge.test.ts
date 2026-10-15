import { describe, expect, it } from 'vitest'
import { HeatGauge, type HeatInput } from './HeatGauge'
import { WaterTank } from './WaterTank'

const inFire: HeatInput = { flameHeat: 1, manual: false, manualSpray: false }
const clear: HeatInput = { flameHeat: 0, manual: false, manualSpray: false }

/** Step the way the game does: sixty frames a second, for `seconds`. Returns the heat that reached the airframe. */
function sit(gauge: HeatGauge, tank: WaterTank, input: HeatInput, seconds: number): number {
  let burned = 0
  const dt = 1 / 60
  for (let t = 0; t < seconds; t += dt) burned += gauge.advance(dt, input, tank) * dt
  return burned
}

describe('HeatGauge', () => {
  it('starts cool and stays cool in clear air', () => {
    const gauge = new HeatGauge()
    sit(gauge, new WaterTank(), clear, 10)
    expect(gauge.temperature).toBe(0)
    expect(gauge.spraying).toBe(false)
  })

  it('lets a pilot sit in the thickest flame for twenty seconds without a scratch while the tank lasts', () => {
    const gauge = new HeatGauge()
    const tank = new WaterTank()
    expect(sit(gauge, tank, inFire, 20)).toBe(0)
    expect(tank.fraction).toBeGreaterThan(0)
    expect(tank.fraction).toBeLessThan(1)
  })

  it('opens the spray on its own as it heats, and shuts it again when cooled', () => {
    const gauge = new HeatGauge()
    const tank = new WaterTank()
    sit(gauge, tank, inFire, 4)
    const used = 1 - tank.fraction
    expect(used).toBeGreaterThan(0)

    sit(gauge, tank, clear, 10)
    expect(gauge.spraying).toBe(false)
    expect(gauge.temperature).toBeLessThan(0.25)
    const after = 1 - tank.fraction
    sit(gauge, tank, clear, 5)
    expect(1 - tank.fraction).toBe(after) // nothing wasted once it is cool
  })

  it('burns the paint once the water has run out', () => {
    const gauge = new HeatGauge()
    const tank = new WaterTank()
    while (tank.hasSpray) tank.spray(1)
    expect(sit(gauge, tank, inFire, 6)).toBeGreaterThan(0.5)
    expect(gauge.temperature).toBe(1)
  })

  it('does not spray itself when a person has the seat and has not asked', () => {
    const gauge = new HeatGauge()
    const tank = new WaterTank()
    const burned = sit(gauge, tank, { flameHeat: 1, manual: true, manualSpray: false }, 8)
    expect(tank.fraction).toBe(1)
    expect(burned).toBeGreaterThan(0)
  })

  it('sprays exactly while the person holds the control', () => {
    const gauge = new HeatGauge()
    const tank = new WaterTank()
    const burned = sit(gauge, tank, { flameHeat: 1, manual: true, manualSpray: true }, 8)
    expect(gauge.spraying).toBe(true)
    expect(burned).toBe(0)
    expect(tank.fraction).toBeLessThan(1)
  })

  it('reports only the heat that gets through, at its full strength', () => {
    const gauge = new HeatGauge()
    const tank = new WaterTank()
    while (tank.hasSpray) tank.spray(1)
    sit(gauge, tank, inFire, 6)
    expect(gauge.advance(1 / 60, { ...inFire, flameHeat: 0.4 }, tank)).toBeCloseTo(0.4)
  })

  it('resets cold', () => {
    const gauge = new HeatGauge()
    sit(gauge, new WaterTank(), inFire, 1)
    gauge.reset()
    expect(gauge.temperature).toBe(0)
  })
})

describe('HeatGauge fire resistance', () => {
  it('heats more slowly when the scale is down', () => {
    const plain = new HeatGauge()
    const tough = new HeatGauge()
    tough.riseScale = 0.5
    const dry = () => { const tank = new WaterTank(); while (tank.hasSpray) tank.spray(1); return tank }
    sit(plain, dry(), inFire, 1.5)
    sit(tough, dry(), inFire, 1.5)
    expect(tough.temperature).toBeLessThan(plain.temperature)
  })
})
