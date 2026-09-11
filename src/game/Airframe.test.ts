import { describe, expect, it } from 'vitest'
import { Airframe } from './Airframe'

describe('Airframe', () => {
  it('starts pristine and in one piece', () => {
    const airframe = new Airframe()
    expect(airframe.integrity).toBe(1)
    expect(airframe.needsRepair).toBe(false)
    expect(airframe.isDamaged).toBe(false)
  })

  it('ignores being nowhere near the fire', () => {
    const airframe = new Airframe()
    airframe.scorch(0, 10)
    expect(airframe.integrity).toBe(1)
  })

  it('is wrecked by a few seconds in the flames, not by a moment', () => {
    const brush = new Airframe()
    brush.scorch(1, 0.4)
    expect(brush.needsRepair).toBe(false)
    expect(brush.integrity).toBeLessThan(1)

    const lingering = new Airframe()
    for (let i = 0; i < 60 * 3; i++) lingering.scorch(1, 1 / 60)
    expect(lingering.needsRepair).toBe(true)
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

  it('warns well before it grounds you, leaving time to turn away', () => {
    const airframe = new Airframe()
    let warnedAt: number | null = null
    let groundedAt: number | null = null

    for (let step = 0; step < 60 * 10; step++) {
      airframe.scorch(1, 1 / 60)
      if (warnedAt === null && airframe.isDamaged) warnedAt = step / 60
      if (groundedAt === null && airframe.needsRepair) groundedAt = step / 60
    }

    expect(warnedAt).not.toBeNull()
    expect(groundedAt).not.toBeNull()
    expect(warnedAt!).toBeLessThan(groundedAt!)
    // A second or so of warning: long enough to react, short enough to respect.
    expect(groundedAt! - warnedAt!).toBeGreaterThan(0.75)
  })

  it('never goes below zero however long it burns', () => {
    const airframe = new Airframe()
    for (let i = 0; i < 6000; i++) airframe.scorch(1, 1 / 60)
    expect(airframe.integrity).toBe(0)
  })

  it('loses a little paint to scuffs, and enough of them ground it', () => {
    const airframe = new Airframe()
    airframe.scuff()
    expect(airframe.integrity).toBeLessThan(1)
    expect(airframe.needsRepair).toBe(false)
    for (let i = 0; i < 40; i++) airframe.scuff()
    expect(airframe.needsRepair).toBe(true)
  })

  it('comes back whole from a repair, and can fly into trouble again', () => {
    const airframe = new Airframe()
    for (let i = 0; i < 300; i++) airframe.scorch(1, 1 / 60)
    expect(airframe.needsRepair).toBe(true)

    airframe.repair()
    expect(airframe.integrity).toBe(1)
    expect(airframe.needsRepair).toBe(false)
    expect(airframe.isDamaged).toBe(false)
  })

  it('stays grounded until repaired, even if it stops burning', () => {
    const airframe = new Airframe()
    for (let i = 0; i < 300; i++) airframe.scorch(1, 1 / 60)
    airframe.scorch(0, 10)
    expect(airframe.needsRepair).toBe(true)
  })
})
