import { describe, expect, it } from 'vitest'
import { VoiceBlips } from './VoiceBlips'
import { ROSTER, CHIEF } from '../game/AnimalProfile'

const pip = ROSTER.find((animal) => animal.id === 'pip')!

describe('VoiceBlips.duration', () => {
  it('takes longer over a longer line', () => {
    const short = VoiceBlips.duration(pip.voice, 'Hi.')
    const long = VoiceBlips.duration(pip.voice, 'Oh finally, finally— wait, is this thing safe?')
    expect(long).toBeGreaterThan(short)
  })

  it('takes longer for a slower speaker saying the same thing', () => {
    const line = 'Oh finally, finally— wait, is this thing safe?'
    expect(VoiceBlips.duration(CHIEF.voice, line)).toBeGreaterThan(VoiceBlips.duration(pip.voice, line))
  })

  it('stays within a few seconds even for a very long line, so the beds come back', () => {
    const rambling = 'x'.repeat(400)
    expect(VoiceBlips.duration(pip.voice, rambling)).toBeLessThan(4)
  })

  it('is long enough to be worth ducking for on a real line', () => {
    expect(VoiceBlips.duration(pip.voice, pip.lines.scold[0])).toBeGreaterThan(0.4)
  })
})
