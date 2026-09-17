import { describe, expect, it } from 'vitest'
import { guidanceFor, type Situation } from './Objective'

const base: Situation = {
  animalName: 'Pip',
  species: 'fox kit',
  siteLabel: 'a hilltop',
  carrying: false,
  needsRepair: false,
  onGround: false,
  overTarget: false,
  range: 500,
  heightAboveTarget: 40,
  speed: 25,
  othersWaiting: 2,
  fireClosingOn: null,
  shiftOver: false,
  closingSeconds: null,
}

const at = (overrides: Partial<Situation>) => guidanceFor({ ...base, ...overrides })

describe('guidanceFor', () => {
  it('names the animal, where it is, and how many others are waiting', () => {
    const guidance = at({})
    expect(guidance.task).toBe('Find Pip the fox kit on a hilltop (+2 more waiting)')
    expect(guidance.target).toBe('pickup')
    expect(at({ othersWaiting: 0 }).task).toBe('Find Pip the fox kit on a hilltop')
  })

  it('sends you to base once the animal is aboard', () => {
    const guidance = at({ carrying: true })
    expect(guidance.task).toContain('Rescue Base')
    expect(guidance.target).toBe('base')
  })

  it('tells you the distance and which beacon to steer at', () => {
    expect(at({ range: 500 }).hint).toContain('amber')
    expect(at({ range: 500 }).hint).toContain('500 m')
    expect(at({ range: 500, carrying: true }).hint).toContain('blue')
  })

  it('tells you to climb over the trees when it is a long way', () => {
    expect(at({ range: 500 }).hint).toContain('climb')
    expect(at({ range: 150 }).hint).not.toContain('climb')
  })

  it('tells you to get airborne when you are parked somewhere else', () => {
    expect(at({ onGround: true, overTarget: false }).hint).toContain('lift off')
  })

  it('switches from travelling to approaching as you close in', () => {
    expect(at({ range: 400 }).landing).toBe(false)
    expect(at({ range: 60 }).landing).toBe(true)
  })

  it('warns you to slow down if you are arriving too fast', () => {
    expect(at({ range: 60, speed: 28 }).hint).toContain('slow')
    expect(at({ range: 60, speed: 3 }).hint).toContain('line up over Pip')
  })

  it('tells you to descend once you are over the animal, with the height', () => {
    const guidance = at({ range: 4, overTarget: true, heightAboveTarget: 32, speed: 1 })
    expect(guidance.hint).toContain('hold Z')
    expect(guidance.hint).toContain('32')
  })

  it('asks for a gentle touchdown at the very end, and says why', () => {
    expect(at({ range: 2, overTarget: true, heightAboveTarget: 2, speed: 0 }).hint).toContain('pick Pip up')
    expect(at({ range: 2, overTarget: true, heightAboveTarget: 2, speed: 0, carrying: true }).hint)
      .toContain('hand Pip over')
  })

  it('puts the fire warning in front of everything, naming who is in trouble', () => {
    expect(at({ fireClosingOn: 'Mo' }).hint).toMatch(/^The fire is closing on Mo — /)
    expect(at({ fireClosingOn: 'Pip' }).hint).toMatch(/^The fire is closing on Pip — /)
    // Once the animal is aboard the fire warning is no longer the point.
    expect(at({ fireClosingOn: 'Pip', carrying: true }).hint).not.toContain('closing')
  })

  it('counts down out loud at the end of the shift', () => {
    expect(at({ closingSeconds: 12.2 }).hint).toMatch(/^13 seconds left/)
    expect(at({ closingSeconds: 12.2, fireClosingOn: 'Mo' }).hint).toMatch(/^13 seconds left — The fire is closing on Mo — /)
  })

  it('explains itself when the Chief takes over', () => {
    const guidance = at({ needsRepair: true, carrying: true })
    expect(guidance.task).toContain('Chief')
    expect(guidance.hint).toContain('repairs')
    expect(guidance.target).toBe('base')
  })

  it('wraps up when the shift is over', () => {
    const guidance = at({ shiftOver: true, needsRepair: true })
    expect(guidance.task).toBe('Shift over')
    expect(guidance.hint).toContain('R')
  })

  it('always gives both a task and a hint, whatever the situation', () => {
    for (const carrying of [false, true]) {
      for (const onGround of [false, true]) {
        for (const overTarget of [false, true]) {
          for (const range of [0, 5, 60, 300, 800]) {
            for (const fireClosingOn of [null, 'Mo']) {
              const guidance = at({ carrying, onGround, overTarget, range, fireClosingOn })
              expect(guidance.task.length).toBeGreaterThan(0)
              expect(guidance.hint.length).toBeGreaterThan(0)
            }
          }
        }
      }
    }
  })
})
