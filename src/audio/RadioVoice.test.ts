import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHIEF } from '../game/AnimalProfile'
import type { AudioEngine } from './AudioEngine'
import { RadioVoice } from './RadioVoice'
import { recordingAudio } from './RecordingAudio'
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

describe('RadioVoice, as the game builds it', () => {
  // Nothing injected but the blips: the real SpeechVoices and the real
  // RadioFrame, joined by the code under test. The pieces are each tested on
  // their own; this is the test that notices if they are not connected.
  interface FakeUtterance {
    onstart?: () => void
    onend?: () => void
    onerror?: () => void
    volume: number
    pitch: number
    rate: number
    lang: string
    voice: unknown
  }

  function build(volume = 1) {
    const spoken: FakeUtterance[] = []
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      volume = 1; pitch = 1; rate = 1; lang = ''; voice = null
      constructor(readonly text: string) {}
    })
    vi.stubGlobal('speechSynthesis', {
      speak: (utterance: FakeUtterance) => spoken.push(utterance),
      cancel: () => {},
      getVoices: () => [{ name: 'Zira', lang: 'en-US', localService: true }],
      addEventListener: () => {},
    })
    const audio = recordingAudio()
    ;(audio.engine as unknown as { muted: boolean; volume: number }).muted = false
    ;(audio.engine as unknown as { muted: boolean; volume: number }).volume = volume
    const radio = new RadioVoice(audio.engine, undefined, undefined, { blips: { speak: vi.fn() } })
    const cracks = () => audio.all('createBufferSource').filter((node) => node.props.loop !== true)
    const beds = () => audio.all('createBufferSource').filter((node) => node.props.loop === true)
    return { radio, spoken, cracks, beds, audio }
  }

  afterEach(() => vi.unstubAllGlobals())

  it('keys the radio when a line is spoken', () => {
    const { radio, spoken, cracks, beds } = build()
    radio.speak('Chief', CHIEF.voice, 'NEW PAINT')
    expect(spoken).toHaveLength(1)
    expect(cracks()).toHaveLength(1)
    expect(beds()).toHaveLength(1)
  })

  it('releases it with a tick when the line ends', () => {
    const { radio, spoken, cracks } = build()
    radio.speak('Chief', CHIEF.voice, 'NEW PAINT')
    spoken[0].onstart?.()
    spoken[0].onend?.()
    expect(cracks()).toHaveLength(2)
  })

  it('drops it quietly when the radio is silenced', () => {
    const { radio, spoken, cracks } = build()
    radio.speak('Chief', CHIEF.voice, 'NEW PAINT')
    spoken[0].onstart?.()
    radio.silence()
    expect(cracks()).toHaveLength(1)
  })

  it('does not key the radio at all when the volume is off', () => {
    const { radio, spoken, cracks, beds } = build(0)
    radio.speak('Chief', CHIEF.voice, 'NEW PAINT')
    expect(spoken).toHaveLength(0)
    expect(cracks()).toHaveLength(0)
    expect(beds()).toHaveLength(0)
  })

  it('drops it when the volume goes off mid-line', () => {
    const { radio, spoken, cracks, audio } = build()
    radio.speak('Chief', CHIEF.voice, 'NEW PAINT')
    spoken[0].onstart?.()
    ;(audio.engine as unknown as { volume: number }).volume = 0
    radio.frame()
    spoken[0].onend?.()
    // Squelch only: cut off without a tick, and the late end is ignored.
    expect(cracks()).toHaveLength(1)
  })
})
