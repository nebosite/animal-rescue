import { describe, expect, it } from 'vitest'
import { Airframe } from './Airframe'

describe('Airframe', () => {
  it('starts pristine and in one piece', () => {
    const airframe = new Airframe()
    expect(airframe.integrity).toBe(1)
    expect(airframe.condition).toBe(1)
    expect(airframe.isWrecked).toBe(false)
    expect(airframe.isDamaged).toBe(false)
    expect(airframe.isFailing).toBe(false)
  })

  it('ignores being nowhere near the fire', () => {
    const airframe = new Airframe()
    airframe.scorch(0, 10)
    expect(airframe.integrity).toBe(1)
  })

  it('is wrecked by a long stretch in the flames, not by a moment', () => {
    const brush = new Airframe()
    brush.scorch(1, 0.4)
    expect(brush.isWrecked).toBe(false)
    expect(brush.integrity).toBeLessThan(1)

    const lingering = new Airframe()
    for (let i = 0; i < 60 * 4; i++) lingering.scorch(1, 1 / 60)
    expect(lingering.isWrecked).toBe(true)
  })

  it('burns more slowly high in the column than down in the flames', () => {
    const deep = new Airframe()
    const skimming = new Airframe()
    for (let i = 0; i < 60; i++) {
      deep.scorch(1, 1 / 60)
      skimming.scorch(0.25, 1 / 60)
    }
    expect(skimming.integrity).toBeGreaterThan(deep.integrity)
  })

  it('warns, then says go home, then runs out — in that order, with time between', () => {
    const airframe = new Airframe()
    let warnedAt: number | null = null
    let failingAt: number | null = null
    let wreckedAt: number | null = null

    for (let step = 0; step < 60 * 10; step++) {
      airframe.scorch(1, 1 / 60)
      if (warnedAt === null && airframe.isDamaged) warnedAt = step / 60
      if (failingAt === null && airframe.isFailing) failingAt = step / 60
      if (wreckedAt === null && airframe.isWrecked) wreckedAt = step / 60
    }

    expect(warnedAt).not.toBeNull()
    expect(failingAt).not.toBeNull()
    expect(wreckedAt).not.toBeNull()
    expect(warnedAt!).toBeLessThan(failingAt!)
    expect(failingAt!).toBeLessThan(wreckedAt!)
    // Long enough to decide to turn for home rather than merely to notice.
    expect(failingAt! - warnedAt!).toBeGreaterThan(0.75)
  })

  it('never goes below zero however long it burns', () => {
    const airframe = new Airframe()
    for (let i = 0; i < 6000; i++) airframe.scorch(1, 1 / 60)
    expect(airframe.integrity).toBe(0)
    expect(airframe.isWrecked).toBe(true)
  })

  it('loses a little paint to scuffs, and enough of them wreck it', () => {
    const airframe = new Airframe()
    airframe.scuff()
    expect(airframe.integrity).toBeLessThan(1)
    expect(airframe.isWrecked).toBe(false)
    for (let i = 0; i < 40; i++) airframe.scuff()
    expect(airframe.isWrecked).toBe(true)
  })

  it('never mends itself, however long it is left alone', () => {
    // The whole point of the shift economy: damage is a balance you cannot
    // top up. Sitting still, landing, and the fire going out all do nothing.
    const airframe = new Airframe()
    for (let i = 0; i < 120; i++) airframe.scorch(1, 1 / 60)
    const hurt = airframe.integrity
    airframe.scorch(0, 60)
    expect(airframe.integrity).toBe(hurt)
  })

  it('comes back whole from a repair, which is what starting a new shift is', () => {
    const airframe = new Airframe()
    for (let i = 0; i < 400; i++) airframe.scorch(1, 1 / 60)
    expect(airframe.isWrecked).toBe(true)

    airframe.repair()
    expect(airframe.integrity).toBe(1)
    expect(airframe.isWrecked).toBe(false)
    expect(airframe.isDamaged).toBe(false)
  })
})
