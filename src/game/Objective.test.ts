import { describe, expect, it } from 'vitest'
import { guidanceFor, type Situation } from './Objective'

const base: Situation = {
  animalName: 'Pip',
  species: 'fox kit',
  carrying: false,
  needsRepair: false,
  onGround: false,
  overTarget: false,
  range: 500,
  heightAboveTarget: 40,
  speed: 25,
}

const at = (overrides: Partial<Situation>) => guidanceFor({ ...base, ...overrides })

describe('guidanceFor', () => {
  it('names the animal you are going to find', () => {
    const guidance = at({})
    expect(guidance.task).toBe('Find Pip the fox kit')
    expect(guidance.target).toBe('pickup')
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
    expect(at({ range: 500 }).hint).toContain('Climb')
    expect(at({ range: 150 }).hint).not.toContain('Climb')
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
    expect(at({ range: 60, speed: 3 }).hint).toContain('Line up')
  })

  it('tells you to descend once you are over the pad, with the height', () => {
    const guidance = at({ range: 4, overTarget: true, heightAboveTarget: 32, speed: 1 })
    expect(guidance.hint).toContain('hold Z')
    expect(guidance.hint).toContain('32')
  })

  it('asks for a gentle touchdown at the very end, and says why', () => {
    expect(at({ range: 2, overTarget: true, heightAboveTarget: 2, speed: 0 }).hint).toContain('pick Pip up')
    expect(at({ range: 2, overTarget: true, heightAboveTarget: 2, speed: 0, carrying: true }).hint)
      .toContain('hand Pip over')
  })

  it('explains itself when the Chief takes over', () => {
    const guidance = at({ needsRepair: true, carrying: true })
    expect(guidance.task).toContain('Chief')
    expect(guidance.hint).toContain('repairs')
    expect(guidance.target).toBe('base')
  })

  it('always gives both a task and a hint, whatever the situation', () => {
    for (const carrying of [false, true]) {
      for (const onGround of [false, true]) {
        for (const overTarget of [false, true]) {
          for (const range of [0, 5, 60, 300, 800]) {
            const guidance = at({ carrying, onGround, overTarget, range })
            expect(guidance.task.length).toBeGreaterThan(0)
            expect(guidance.hint.length).toBeGreaterThan(0)
          }
        }
      }
    }
  })
})
