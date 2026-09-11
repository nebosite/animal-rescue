import { describe, expect, it } from 'vitest'
import { Announcer } from './Announcer'
import { CHIEF, ROSTER } from './AnimalProfile'

const duchess = ROSTER.find((animal) => animal.id === 'duchess')!

describe('Announcer', () => {
  it('lets the animal greet you in its own voice on pickup', () => {
    const line = new Announcer().pickedUp(duchess)
    expect(line.speaker).toBe('Duchess')
    expect(duchess.lines.greeting).toContain(line.text)
    expect(line.voice).toBe(duchess.voice)
  })

  it('cycles through the variants rather than repeating the first', () => {
    const announcer = new Announcer()
    const first = announcer.scolded(duchess).text
    const second = announcer.scolded(duchess).text
    expect(second).not.toBe(first)
    const wrapped = Array.from({ length: duchess.lines.scold.length - 1 }, () => announcer.scolded(duchess).text)
    expect(wrapped.at(-1)).toBe(first)
  })

  it('thanks you properly for a smooth trip, and grudgingly for a rough one', () => {
    const announcer = new Announcer()
    expect(duchess.lines.thanks).toContain(announcer.delivered(duchess, duchess.value).text)
    expect(duchess.lines.grudging).toContain(announcer.delivered(duchess, duchess.value - 1).text)
  })

  it('has the Chief speak up about landings and bumps, but not banking', () => {
    const announcer = new Announcer()
    expect(announcer.chiefOnRoughFlying('hard-landing')?.speaker).toBe(CHIEF.name)
    expect(announcer.chiefOnRoughFlying('bump')?.speaker).toBe(CHIEF.name)
    expect(announcer.chiefOnRoughFlying('steep-bank')).toBeNull()
  })

  it('has the Chief cover the fire, the grounding and the repair', () => {
    const announcer = new Announcer()
    for (const line of [announcer.scorched(), announcer.grounded(), announcer.repaired()]) {
      expect(line.speaker).toBe(CHIEF.name)
      expect(line.text.length).toBeGreaterThan(0)
      expect(line.voice).toBe(CHIEF.voice)
    }
    expect(CHIEF.lines.scorched).toContain(new Announcer().scorched().text)
  })

  it('gives every animal in the roster something to say at each moment', () => {
    for (const animal of ROSTER) {
      for (const lines of Object.values(animal.lines)) expect(lines.length).toBeGreaterThan(0)
    }
  })
})
