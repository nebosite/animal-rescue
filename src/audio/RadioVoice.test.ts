import { describe, expect, it, vi } from 'vitest'
import { CHIEF } from '../game/AnimalProfile'
import type { AudioEngine } from './AudioEngine'
import { RadioVoice } from './RadioVoice'
import type { SpeechVoices } from './SpeechVoices'

/** Two stand-ins that record who was asked to say what, and in what order. */
function setup(canSpeakEnglish: boolean) {
  const log: string[] = []
  const speech = {
    canSpeakEnglish,
    speak: vi.fn(() => log.push('speech.speak')),
    silence: vi.fn(() => log.push('speech.silence')),
    checkLevel: vi.fn(() => log.push('speech.checkLevel')),
  }
  const blips = { speak: vi.fn(() => log.push('blips.speak')) }
  const radio = new RadioVoice({} as AudioEngine, undefined, undefined, {
    speech: speech as unknown as SpeechVoices,
    blips,
  })
  return { radio, speech, blips, log }
}

describe('RadioVoice', () => {
  it('reads the line aloud when there is an English voice to do it with', () => {
    const { radio, speech, blips } = setup(true)
    radio.speak('Chief', CHIEF.voice, 'NEW PAINT')
    expect(speech.speak).toHaveBeenCalledWith('Chief', CHIEF.voice, 'NEW PAINT')
    expect(blips.speak).not.toHaveBeenCalled()
  })

  it('blips rather than hand the line to a foreign voice', () => {
    // The Japanese-voices bug: with no English voice installed the line used to
    // go to whatever voice the machine had. If this call goes back to checking
    // only that speech exists, this is the test that fails.
    const { radio, speech, blips } = setup(false)
    radio.speak('Chief', CHIEF.voice, 'NEW PAINT')
    expect(speech.speak).not.toHaveBeenCalled()
    expect(blips.speak).toHaveBeenCalledWith(CHIEF.voice, 'NEW PAINT')
  })

  it('stops a spoken line that is still running before the blips begin', () => {
    // Otherwise the old line talks over the blips, and its end event releases
    // the beds in the middle of them.
    const { radio, log } = setup(false)
    radio.speak('Chief', CHIEF.voice, 'NEW PAINT')
    expect(log).toEqual(['speech.silence', 'blips.speak'])
  })

  it('keeps checking the volume every frame, so a line stops when it is turned off', () => {
    const { radio, speech } = setup(true)
    radio.frame()
    expect(speech.checkLevel).toHaveBeenCalledTimes(1)
  })

  it('follows the verdict line by line, so a late-loading list can change it', () => {
    const { radio, speech, blips } = setup(true)
    radio.speak('Chief', CHIEF.voice, 'first')
    ;(speech as { canSpeakEnglish: boolean }).canSpeakEnglish = false
    radio.speak('Chief', CHIEF.voice, 'second')
    expect(speech.speak).toHaveBeenCalledTimes(1)
    expect(blips.speak).toHaveBeenCalledTimes(1)
  })
})
