import { describe, expect, it } from 'vitest'
import { Handling, bankThreshold, hardLandingThreshold, type RoughHandling } from './Handling'
import { Helicopter } from './Helicopter'
import { noInput, type FlightInput } from './FlightInput'

/** Fly with the axes held for `seconds`, feeding every frame to the detector. */
function fly(helicopter: Helicopter, handling: Handling, axes: Partial<FlightInput>, seconds: number): RoughHandling[] {
  const input = { ...noInput(), ...axes }
  const events: RoughHandling[] = []
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    helicopter.update(input, 1 / 60)
    const rough = handling.update(helicopter, 1 / 60)
    if (rough) events.push(rough)
  }
  return events
}

describe('Handling', () => {
  it('calls a full-collective drop from hover a hard landing', () => {
    const events = fly(new Helicopter(), new Handling(0.5), { collective: -1 }, 2)
    expect(events).toEqual(['hard-landing'])
  })

  it('lets a gentle, feathered descent land without complaint', () => {
    const events = fly(new Helicopter(), new Handling(0.5), { collective: -0.3 }, 4)
    expect(events).toEqual([])
  })

  it('is easier to upset the fussier the passenger', () => {
    expect(hardLandingThreshold(1)).toBeLessThan(hardLandingThreshold(0))
    expect(bankThreshold(1)).toBeLessThan(bankThreshold(0))
  })

  it('objects to a steep bank held through a turn, but not to a flick', () => {
    const held = fly(new Helicopter(), new Handling(0.5), { roll: 1, yaw: 1 }, 1.5)
    expect(held).toContain('steep-bank')

    const helicopter = new Helicopter()
    const handling = new Handling(0.5)
    const flick = [...fly(helicopter, handling, { roll: 1, yaw: 1 }, 0.2), ...fly(helicopter, handling, {}, 1)]
    expect(flick).toEqual([])
  })

  it('a prima donna objects to a plain full-stick slide that Gus would not notice', () => {
    expect(fly(new Helicopter(), new Handling(1), { roll: 1 }, 1.5)).toContain('steep-bank')
    expect(fly(new Helicopter(), new Handling(0.15), { roll: 1 }, 1.5)).toEqual([])
  })

  it('reports a bump against the edge of the field', () => {
    // Long enough to cross half the map at cruise and still be pushing.
    const events = fly(new Helicopter(), new Handling(0.5), { roll: 1 }, 30)
    expect(events).toContain('bump')
  })

  it('does not nag: a held steep bank produces one complaint every few seconds, not sixty a second', () => {
    const events = fly(new Helicopter(), new Handling(1), { roll: 1, yaw: 1 }, 6)
    expect(events.length).toBeGreaterThanOrEqual(2)
    expect(events.length).toBeLessThanOrEqual(3)
  })
})
