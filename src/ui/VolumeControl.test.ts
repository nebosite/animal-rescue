import { describe, expect, it } from 'vitest'
import { afterButton, startingSetting } from './VolumeControl'

describe('startingSetting', () => {
  it('never starts silent, whatever was saved', () => {
    // The bug: the speaker showed off and there was nothing to hear until the
    // button had been pressed twice.
    expect(startingSetting({ volume: 0.6, muted: true }).muted).toBe(false)
    expect(startingSetting({ volume: 0, muted: false }).volume).toBeGreaterThan(0)
    expect(startingSetting({ volume: 0, muted: true })).toEqual({ volume: 0.7, muted: false })
  })

  it('remembers a volume the player chose', () => {
    expect(startingSetting({ volume: 0.3, muted: false })).toEqual({ volume: 0.3, muted: false })
  })
})

describe('afterButton', () => {
  it('mutes a game that is making sound', () => {
    expect(afterButton({ volume: 0.5, muted: false })).toEqual({ volume: 0.5, muted: true })
  })

  it('turns sound on from muted, at the volume it was', () => {
    expect(afterButton({ volume: 0.5, muted: true })).toEqual({ volume: 0.5, muted: false })
  })

  it('turns sound on in one press when the slider is at zero', () => {
    // Used to take two: the first press "muted" a game that was already silent.
    const next = afterButton({ volume: 0, muted: false })
    expect(next.muted).toBe(false)
    expect(next.volume).toBeGreaterThan(0)
  })

  it('turns sound on when it is both muted and at zero', () => {
    const next = afterButton({ volume: 0, muted: true })
    expect(next.muted).toBe(false)
    expect(next.volume).toBeGreaterThan(0)
  })

  it('is never silent after a press that started from silence, and silent after a press from sound', () => {
    for (const state of [{ volume: 0, muted: false }, { volume: 0.4, muted: true }, { volume: 0, muted: true }]) {
      const next = afterButton(state)
      expect(next.muted || next.volume <= 0).toBe(false)
    }
    const heard = afterButton({ volume: 1, muted: false })
    expect(heard.muted || heard.volume <= 0).toBe(true)
  })
})
