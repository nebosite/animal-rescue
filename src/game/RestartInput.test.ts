import { describe, expect, it } from 'vitest'
import type { GamepadLike } from './GamepadInput'
import { RESTART_KEY, RestartInput } from './RestartInput'

function pad(pressed: Record<number, boolean> = {}): GamepadLike {
  return {
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 12 }, (_, i) => ({ value: pressed[i] ? 1 : 0, pressed: !!pressed[i] })),
  }
}

describe('RestartInput', () => {
  it('asks for nothing until something is pressed', () => {
    const restart = new RestartInput(() => [])
    expect(restart.poll()).toBe(false)
    expect(restart.poll()).toBe(false)
  })

  it('fires once on the R key, however long it is held', () => {
    const restart = new RestartInput(() => [])
    restart.press(RESTART_KEY, true)
    expect(restart.poll()).toBe(true)
    expect(restart.poll()).toBe(false)
    expect(restart.poll()).toBe(false)

    // Released and pressed again is a second request.
    restart.press(RESTART_KEY, false)
    expect(restart.poll()).toBe(false)
    restart.press(RESTART_KEY, true)
    expect(restart.poll()).toBe(true)
  })

  it('ignores keys that are not ours', () => {
    const restart = new RestartInput(() => [])
    expect(restart.press('KeyW', true)).toBe(false)
    expect(restart.poll()).toBe(false)
  })

  it('takes Start, or A, from a controller — the whole point of it', () => {
    // A controller-only player had no way to begin another shift at all.
    for (const button of [9, 0]) {
      let held = false
      const restart = new RestartInput(() => [pad({ [button]: held })])
      expect(restart.poll()).toBe(false)
      held = true
      expect(restart.poll(), `button ${button}`).toBe(true)
      expect(restart.poll()).toBe(false)
    }
  })

  it('takes it from the second pad too, so either seat can call for another go', () => {
    let held = false
    const restart = new RestartInput(() => [pad(), pad({ 9: held })])
    expect(restart.poll()).toBe(false)
    held = true
    expect(restart.poll()).toBe(true)
  })

  it('ignores a pad that is not connected', () => {
    const asleep = { ...pad({ 9: true }), connected: false }
    const restart = new RestartInput(() => [asleep])
    expect(restart.poll()).toBe(false)
  })

  it('does not restart twice from a button still held from the last shift', () => {
    // Which would end the new shift on its first frame.
    const restart = new RestartInput(() => [pad({ 0: true })])
    expect(restart.poll()).toBe(true)
    for (let i = 0; i < 10; i++) expect(restart.poll()).toBe(false)
  })
})
