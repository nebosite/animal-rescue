import { describe, expect, it } from 'vitest'
import { CopilotInput, WATER_KEY, WINCH_KEY } from './CopilotInput'
import type { GamepadLike } from './GamepadInput'

const pad = (buttons: Record<number, number> = {}): GamepadLike => ({
  id: 'Pad',
  connected: true,
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, (_, i) => ({ value: buttons[i] ?? 0, pressed: (buttons[i] ?? 0) > 0.5 })),
})

describe('CopilotInput', () => {
  it('starts with nobody in the seat', () => {
    const seat = new CopilotInput(() => [])
    seat.poll()
    expect(seat.taken).toBe(false)
    expect(seat.command).toEqual({ winch: false, water: false })
  })

  it('takes the winch and the water from the keyboard', () => {
    const seat = new CopilotInput(() => [])
    seat.press(WINCH_KEY, true)
    expect(seat.poll().winch).toBe(true)
    seat.press(WINCH_KEY, false)
    seat.press(WATER_KEY, true)
    const command = seat.poll()
    expect(command.winch).toBe(false)
    expect(command.water).toBe(true)
  })

  it('counts the seat as taken the moment anyone touches it, and keeps it taken', () => {
    const seat = new CopilotInput(() => [])
    seat.press(WINCH_KEY, true)
    expect(seat.taken).toBe(true)
    seat.press(WINCH_KEY, false)
    seat.poll()
    // Letting go of the winch is not the same as giving the job back.
    expect(seat.taken).toBe(true)
  })

  it('ignores keys that belong to the pilot', () => {
    const seat = new CopilotInput(() => [])
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft']) {
      expect(seat.press(code, true), code).toBe(false)
    }
    expect(seat.taken).toBe(false)
  })

  it('reads the second controller, leaving the first to the pilot', () => {
    const pilotOnly = new CopilotInput(() => [pad({ 0: 1 })])
    expect(pilotOnly.poll().winch).toBe(false)
    expect(pilotOnly.taken).toBe(false)

    const both = new CopilotInput(() => [pad(), pad({ 0: 1 })])
    expect(both.poll().winch).toBe(true)
    expect(both.taken).toBe(true)
  })

  it('takes the winch from A or the right trigger, and water from B or the left', () => {
    expect(new CopilotInput(() => [pad(), pad({ 7: 1 })]).poll().winch).toBe(true)
    expect(new CopilotInput(() => [pad(), pad({ 1: 1 })]).poll().water).toBe(true)
    expect(new CopilotInput(() => [pad(), pad({ 6: 1 })]).poll().water).toBe(true)
  })

  it('a second controller takes the seat just by being plugged in', () => {
    const seat = new CopilotInput(() => [pad(), pad()])
    seat.poll()
    expect(seat.taken).toBe(true)
  })
})
