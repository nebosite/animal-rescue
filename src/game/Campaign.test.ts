import { describe, expect, it } from 'vitest'
import { ROSTER } from './AnimalProfile'
import { Campaign } from './Campaign'

describe('Campaign', () => {
  it('opens with one animal on level one at normal pace', () => {
    const run = new Campaign()
    expect(run.level).toBe(1)
    expect(run.party).toEqual([ROSTER[0]])
    expect(run.firePace).toBe(1)
  })

  it('brings back everyone saved, plus one new animal, and speeds the fire up', () => {
    const run = new Campaign()
    expect(run.finishLevel([ROSTER[0]])).toBe('next')
    expect(run.level).toBe(2)
    expect(run.party).toEqual([ROSTER[0], ROSTER[1]])
    expect(run.firePace).toBeGreaterThan(1)
  })

  it('leaves out anyone the fire took', () => {
    const run = new Campaign()
    run.finishLevel([ROSTER[0]])
    run.finishLevel([ROSTER[1]]) // lost the first one on level two
    expect(run.party).toEqual([ROSTER[1], ROSTER[2]])
  })

  it('is over when a level saves nobody', () => {
    const run = new Campaign()
    expect(run.finishLevel([])).toBe('over')
  })

  it('stops adding animals when the roster runs out, but keeps the fire speeding up', () => {
    const run = new Campaign()
    let paceBefore = 0
    for (let i = 0; i < ROSTER.length + 2; i++) {
      paceBefore = run.firePace
      run.finishLevel(run.party)
    }
    expect(run.party).toHaveLength(ROSTER.length)
    expect(run.firePace).toBeGreaterThan(paceBefore)
  })

  it('restarts from level one', () => {
    const run = new Campaign()
    run.finishLevel([ROSTER[0]])
    run.restart()
    expect(run.level).toBe(1)
    expect(run.party).toEqual([ROSTER[0]])
    expect(run.firePace).toBe(1)
  })
})
