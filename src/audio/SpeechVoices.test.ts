import { describe, expect, it, vi } from 'vitest'
import { CHIEF, FERRET, ROSTER } from '../game/AnimalProfile'
import { SpeechVoices, speechFor, type SpeechLike } from './SpeechVoices'

const gus = ROSTER.find((animal) => animal.id === 'gus')!
const pip = ROSTER.find((animal) => animal.id === 'pip')!

describe('speechFor', () => {
  it('keeps every character inside a pitch a synthesiser can actually say', () => {
    for (const voice of [...ROSTER.map((a) => a.voice), CHIEF.voice, FERRET.voice]) {
      const settings = speechFor(voice)
      expect(settings.pitch).toBeGreaterThan(0.1)
      expect(settings.pitch).toBeLessThan(2)
      expect(settings.rate).toBeGreaterThan(0.5)
      expect(settings.rate).toBeLessThan(2)
    }
  })

  it('carries the characters across from the blips: Gus rumbles, Bram gabbles', () => {
    expect(speechFor(gus.voice).pitch).toBeLessThan(speechFor(pip.voice).pitch)
    expect(speechFor(FERRET.voice).pitch).toBeGreaterThan(speechFor(CHIEF.voice).pitch)
    expect(speechFor(FERRET.voice).rate).toBeGreaterThan(speechFor(gus.voice).rate)
  })

  it('clamps a voice from outside the roster instead of going inaudible', () => {
    const squeak = speechFor({ wave: 'sine', baseHz: 9000, spread: 0, rate: 90 })
    const rumble = speechFor({ wave: 'sine', baseHz: 1, spread: 0, rate: 0.1 })
    expect(squeak.pitch).toBeLessThanOrEqual(0.875)
    expect(rumble.pitch).toBeGreaterThanOrEqual(0.225)
    expect(squeak.rate).toBeLessThanOrEqual(1.45)
    expect(rumble.rate).toBeGreaterThanOrEqual(0.85)
  })

  it('asks for half the pitch it used to', () => {
    // Literal numbers from the old mapping (0.45 at 150 Hz, 1.75 at 620 Hz,
    // linear between), so this fails if the halving is missed, not only if the
    // function disagrees with itself.
    const old = (hz: number) => 0.45 + 1.3 * ((hz - 150) / 470)
    for (const hz of [150, 380, 620]) {
      const settings = speechFor({ wave: 'sine', baseHz: hz, spread: 0, rate: 10 })
      expect(settings.pitch).toBeCloseTo(old(hz) * 0.5, 5)
    }
  })

  it('keeps all seven characters sounding different at the lower pitch', () => {
    const voices = [...ROSTER.map((a) => a.voice), CHIEF.voice, FERRET.voice]
    const pitches = voices.map((voice) => speechFor(voice).pitch).sort((a, b) => a - b)
    expect(voices).toHaveLength(7)
    for (let i = 1; i < pitches.length; i++) {
      expect(pitches[i] - pitches[i - 1]).toBeGreaterThan(0.02)
    }
  })
})

/** A stand-in for the browser's speech synthesiser. */
type FakeVoice = string | { name: string; lang?: string; localService?: boolean }

function fakeSynth(
  voiceList: FakeVoice[] = [],
): SpeechLike & { spoken: SpeechSynthesisUtterance[]; cancels: number; voices: SpeechSynthesisVoice[]; changed: () => void } {
  // A bare name is an American English voice, since most of these tests are
  // not about language.
  const voices = voiceList.map((entry) => {
    const voice = typeof entry === 'string' ? { name: entry } : entry
    return { lang: 'en-US', localService: true, ...voice } as SpeechSynthesisVoice
  })
  const spoken: SpeechSynthesisUtterance[] = []
  let listener: (() => void) | null = null
  return {
    spoken,
    voices,
    cancels: 0,
    speak(utterance) { spoken.push(utterance) },
    cancel() { this.cancels += 1 },
    getVoices() { return voices },
    addEventListener(_type, handler) { listener = handler },
    changed() { listener?.() },
  }
}

const event = null as unknown as SpeechSynthesisEvent

describe('SpeechVoices', () => {
  // The real utterance class is a browser global, so stand one in.
  vi.stubGlobal('SpeechSynthesisUtterance', class {
    pitch = 1
    rate = 1
    volume = 1
    voice: SpeechSynthesisVoice | null = null
    lang = ''
    constructor(readonly text: string) {}
  })

  it('reports itself unavailable when the browser has no speech at all', () => {
    const voices = new SpeechVoices(() => 1, () => {}, null)
    expect(voices.canSpeakEnglish).toBe(false)
    // And says nothing rather than throwing, so the caller can just ask.
    voices.speak('Chief', CHIEF.voice, 'hello')
  })

  it('says the line with the character pitch and the current volume', () => {
    const synth = fakeSynth(['One', 'Two', 'Three'])
    const voices = new SpeechVoices(() => 0.5, () => {}, synth)
    voices.speak('Gus', gus.voice, 'Mmf. Wake me when we get there.')

    expect(synth.spoken).toHaveLength(1)
    expect(synth.spoken[0].volume).toBe(0.5)
    expect(synth.spoken[0].pitch).toBeCloseTo(speechFor(gus.voice).pitch, 5)
    // Gus is the lowest voice on the roster: well under the old floor of 0.45.
    expect(synth.spoken[0].pitch).toBeLessThan(0.3)
  })

  it('stays silent when the mix is muted', () => {
    // Speech bypasses the AudioContext, so the master gain does not reach it
    // and the mute button would otherwise do nothing to the voices at all.
    const synth = fakeSynth(['One'])
    const voices = new SpeechVoices(() => 0, () => {}, synth)
    voices.speak('Chief', CHIEF.voice, 'NEW PAINT')
    expect(synth.spoken).toHaveLength(0)
  })

  it('cuts off whatever was being said, so the voice keeps up with the subtitle', () => {
    const synth = fakeSynth(['One'])
    const voices = new SpeechVoices(() => 1, () => {}, synth)
    voices.speak('Chief', CHIEF.voice, 'first')
    voices.speak('Bram', FERRET.voice, 'second')
    expect(synth.cancels).toBe(2)
    expect(synth.spoken).toHaveLength(2)
  })

  it('gives different speakers different installed voices', () => {
    const synth = fakeSynth(['One', 'Two', 'Three', 'Four', 'Five', 'Six'])
    const voices = new SpeechVoices(() => 1, () => {}, synth)
    for (const speaker of ['Chief', 'Bram', 'Pip', 'Gus', 'Duchess']) {
      voices.speak(speaker, CHIEF.voice, 'line')
    }
    const used = new Set(synth.spoken.map((utterance) => utterance.voice?.name))
    expect(used.size).toBeGreaterThan(1)
  })

  it('gives one speaker the same voice every time', () => {
    const synth = fakeSynth(['One', 'Two', 'Three', 'Four'])
    const voices = new SpeechVoices(() => 1, () => {}, synth)
    voices.speak('Chief', CHIEF.voice, 'one')
    voices.speak('Chief', CHIEF.voice, 'two')
    expect(synth.spoken[0].voice?.name).toBe(synth.spoken[1].voice?.name)
  })

  it('copes with a browser that has speech but no voices installed', () => {
    const synth = fakeSynth([])
    const voices = new SpeechVoices(() => 1, () => {}, synth)
    expect(voices.voiceCount).toBe(0)
    voices.speak('Chief', CHIEF.voice, 'line')
    expect(synth.spoken).toHaveLength(1)
    expect(synth.spoken[0].voice).toBeNull()
  })

  describe('English only', () => {
    const speakers = ['Chief', 'Bram', 'Pip', 'Gus', 'Duchess', 'Mo', 'Ollie']

    it('never picks a foreign voice, whatever else is installed', () => {
      // The bug: a machine with Japanese voices read the lines in Japanese.
      const synth = fakeSynth([
        { name: 'Haruka', lang: 'ja-JP' }, { name: 'Ichiro', lang: 'ja_JP' },
        { name: 'Hans', lang: 'de-DE' }, { name: 'Zira', lang: 'en_US' },
        { name: 'George', lang: 'en-GB' }, { name: 'Unlabelled', lang: '' },
      ])
      const voices = new SpeechVoices(() => 1, () => {}, synth)
      for (const speaker of speakers) voices.speak(speaker, CHIEF.voice, 'line')
      for (const utterance of synth.spoken) {
        expect(['Zira', 'George']).toContain(utterance.voice?.name)
      }
    })

    it('can speak English when it has at least one English voice among others', () => {
      const synth = fakeSynth([{ name: 'Haruka', lang: 'ja-JP' }, { name: 'George', lang: 'en-GB' }])
      expect(new SpeechVoices(() => 1, () => {}, synth).canSpeakEnglish).toBe(true)
    })

    it('cannot speak English when the list is known and holds none', () => {
      const synth = fakeSynth([{ name: 'Haruka', lang: 'ja-JP' }, { name: 'Hans', lang: 'de-DE' }])
      const voices = new SpeechVoices(() => 1, () => {}, synth)
      expect(voices.canSpeakEnglish).toBe(false)
    })

    it('does not mistake a list that has not loaded yet for one with no English', () => {
      // Chrome answers with an empty list until it fires voiceschanged, and the
      // welcome lines are spoken before that. They must not drop to blips.
      const synth = fakeSynth([])
      const voices = new SpeechVoices(() => 1, () => {}, synth)
      expect(voices.canSpeakEnglish).toBe(true)
    })

    it('has no way to speak without speech synthesis', () => {
      expect(new SpeechVoices(() => 1, () => {}, null).canSpeakEnglish).toBe(false)
    })

    it('notices when the list loads late, and that it is all foreign', () => {
      const synth = fakeSynth([])
      const voices = new SpeechVoices(() => 1, () => {}, synth)
      expect(voices.canSpeakEnglish).toBe(true)
      synth.voices.push({ name: 'Haruka', lang: 'ja-JP', localService: true } as SpeechSynthesisVoice)
      synth.changed()
      expect(voices.canSpeakEnglish).toBe(false)
    })

    it('uses an English voice that arrives late', () => {
      const synth = fakeSynth([])
      const voices = new SpeechVoices(() => 1, () => {}, synth)
      synth.voices.push({ name: 'Zira', lang: 'en-US', localService: true } as SpeechSynthesisVoice)
      synth.changed()
      voices.speak('Chief', CHIEF.voice, 'line')
      expect(synth.spoken[0].voice?.name).toBe('Zira')
    })

    it("sets the utterance's language, with a voice or without one", () => {
      const withVoice = fakeSynth([{ name: 'George', lang: 'en-GB' }])
      new SpeechVoices(() => 1, () => {}, withVoice).speak('Chief', CHIEF.voice, 'line')
      expect(withVoice.spoken[0].lang).toBe('en-GB')

      const without = fakeSynth([])
      new SpeechVoices(() => 1, () => {}, without).speak('Chief', CHIEF.voice, 'line')
      expect(without.spoken[0].lang).toBe('en-US')
    })

    it('still gives different speakers different voices from the English ones', () => {
      const synth = fakeSynth([
        'One', 'Two', 'Three', { name: 'Haruka', lang: 'ja-JP' }, { name: 'Four', lang: 'en-AU' },
      ])
      const voices = new SpeechVoices(() => 1, () => {}, synth)
      for (const speaker of speakers) voices.speak(speaker, CHIEF.voice, 'line')
      expect(new Set(synth.spoken.map((utterance) => utterance.voice?.name)).size).toBeGreaterThan(1)
    })
  })

  describe('which language tags count as English', () => {
    // One voice in the list, so the list is known and the verdict is about it.
    const judge = (lang: string | undefined) =>
      new SpeechVoices(() => 1, () => {}, fakeSynth([{ name: 'V', lang }])).canSpeakEnglish

    it.each(['en', 'EN-us', 'en_GB', 'en-AU', 'en-US'])('accepts %s', (lang) => {
      expect(judge(lang)).toBe(true)
    })

    it.each(['enm', 'eng', 'ens-XX', 'ja-JP', 'de', 'es-ES', ''])('rejects %s', (lang) => {
      // `enm` is Middle English and `eng` a three-letter code some engines use;
      // a loose startsWith('en') would let either through.
      expect(judge(lang)).toBe(false)
    })
  })

  describe('a machine that never reports any voices', () => {
    const failure = (error: string) => ({ error }) as SpeechSynthesisErrorEvent

    it('goes over to blips once a line has failed outright', () => {
      const synth = fakeSynth([])
      const voices = new SpeechVoices(() => 1, () => {}, synth)
      expect(voices.canSpeakEnglish).toBe(true)
      voices.speak('Chief', CHIEF.voice, 'line')
      synth.spoken[0].onerror?.(failure('synthesis-failed'))
      expect(voices.canSpeakEnglish).toBe(false)
    })

    it('goes over to blips when a line never starts', () => {
      vi.useFakeTimers()
      try {
        const synth = fakeSynth([])
        const talking: boolean[] = []
        const voices = new SpeechVoices(() => 1, (on) => talking.push(on), synth)
        voices.speak('Chief', CHIEF.voice, 'line')
        vi.advanceTimersByTime(4000)
        expect(voices.canSpeakEnglish).toBe(true)
        vi.advanceTimersByTime(2000)
        expect(voices.canSpeakEnglish).toBe(false)
        expect(talking).toEqual([false])
      } finally {
        vi.useRealTimers()
      }
    })

    it('does not write off an engine that was only slow to start', () => {
      vi.useFakeTimers()
      try {
        const synth = fakeSynth([])
        const voices = new SpeechVoices(() => 1, () => {}, synth)
        voices.speak('Chief', CHIEF.voice, 'line')
        synth.spoken[0].onstart?.(event)
        vi.advanceTimersByTime(30000)
        expect(voices.canSpeakEnglish).toBe(true)
      } finally {
        vi.useRealTimers()
      }
    })

    it('does not mistake our own cancelling for a failure', () => {
      const synth = fakeSynth([])
      const voices = new SpeechVoices(() => 1, () => {}, synth)
      voices.speak('Chief', CHIEF.voice, 'line')
      synth.spoken[0].onerror?.(failure('canceled'))
      synth.spoken[0].onerror?.(failure('interrupted'))
      expect(voices.canSpeakEnglish).toBe(true)
    })

    it('forgives it if the voices turn up after all', () => {
      const synth = fakeSynth([])
      const voices = new SpeechVoices(() => 1, () => {}, synth)
      voices.speak('Chief', CHIEF.voice, 'line')
      synth.spoken[0].onerror?.(failure('synthesis-failed'))
      expect(voices.canSpeakEnglish).toBe(false)
      synth.voices.push({ name: 'Zira', lang: 'en-US', localService: true } as SpeechSynthesisVoice)
      synth.changed()
      expect(voices.canSpeakEnglish).toBe(true)
    })

    it('trusts a machine that does list English voices, whatever one line does', () => {
      const synth = fakeSynth(['Zira'])
      const voices = new SpeechVoices(() => 1, () => {}, synth)
      voices.speak('Chief', CHIEF.voice, 'line')
      synth.spoken[0].onerror?.(failure('synthesis-failed'))
      expect(voices.canSpeakEnglish).toBe(true)
    })
  })

  describe('when the volume goes off', () => {
    it('stops a line that is already being read, because the master gain cannot reach it', () => {
      const synth = fakeSynth(['One'])
      const talking: boolean[] = []
      let volume = 1
      const voices = new SpeechVoices(() => volume, (on) => talking.push(on), synth)
      voices.speak('Chief', CHIEF.voice, 'a long line')
      synth.spoken[0].onstart?.(event)
      const cancelsBefore = synth.cancels

      volume = 0
      voices.checkLevel()
      expect(synth.cancels).toBe(cancelsBefore + 1)
      expect(talking).toEqual([true, false])
    })

    it('leaves a line alone while there is volume, or when nothing is being said', () => {
      const synth = fakeSynth(['One'])
      let volume = 1
      const voices = new SpeechVoices(() => volume, () => {}, synth)
      voices.checkLevel()
      voices.speak('Chief', CHIEF.voice, 'line')
      const cancelsBefore = synth.cancels
      voices.checkLevel()
      expect(synth.cancels).toBe(cancelsBefore)

      volume = 0
      voices.silence()
      const after = synth.cancels
      voices.checkLevel()
      expect(synth.cancels).toBe(after)
    })

    it('says nothing new at zero volume', () => {
      const synth = fakeSynth(['One'])
      const voices = new SpeechVoices(() => 0, () => {}, synth)
      voices.speak('Chief', CHIEF.voice, 'line')
      expect(synth.spoken).toHaveLength(0)
    })
  })

  describe('a line cut off by the next one', () => {
    it("does not let the cancelled line's late start duck the beds again", () => {
      const synth = fakeSynth(['One'])
      const talking: boolean[] = []
      const voices = new SpeechVoices(() => 1, (on) => talking.push(on), synth)
      voices.speak('Chief', CHIEF.voice, 'line')
      voices.silence()
      synth.spoken[0].onstart?.(event)
      expect(talking).toEqual([false])
    })

    it('ignores the late end of a line cancelled by a muted one', () => {
      const synth = fakeSynth(['One'])
      const talking: boolean[] = []
      let volume = 1
      const voices = new SpeechVoices(() => volume, (on) => talking.push(on), synth)
      voices.speak('Chief', CHIEF.voice, 'first')
      synth.spoken[0].onstart?.(event)
      volume = 0
      voices.speak('Chief', CHIEF.voice, 'second')
      synth.spoken[0].onend?.(event)
      expect(talking).toEqual([true, false])
    })

    it("does not let the cancelled line's late end event un-duck the new one", () => {
      // Cancelling fires the old line's end or error event, and it can arrive
      // after the new line has started. It must not release the beds mid-line.
      const synth = fakeSynth(['One'])
      const talking: boolean[] = []
      const voices = new SpeechVoices(() => 1, (on) => talking.push(on), synth)
      voices.speak('Chief', CHIEF.voice, 'first')
      const first = synth.spoken[0]
      first.onstart?.(event)
      voices.speak('Bram', FERRET.voice, 'second')
      const second = synth.spoken[1]
      second.onstart?.(event)

      first.onerror?.(null as unknown as SpeechSynthesisErrorEvent)
      first.onend?.(event)
      expect(talking).toEqual([true, true])

      second.onend?.(event)
      expect(talking).toEqual([true, true, false])
    })

    it('lets the beds back up when the new line is muted out and nothing will end the duck', () => {
      const synth = fakeSynth(['One'])
      const talking: boolean[] = []
      let volume = 1
      const voices = new SpeechVoices(() => volume, (on) => talking.push(on), synth)
      voices.speak('Chief', CHIEF.voice, 'first')
      synth.spoken[0].onstart?.(event)
      volume = 0
      voices.speak('Chief', CHIEF.voice, 'second')
      expect(talking).toEqual([true, false])
    })

    it('ignores the end of a line that silence() has already cut off', () => {
      const synth = fakeSynth(['One'])
      const talking: boolean[] = []
      const voices = new SpeechVoices(() => 1, (on) => talking.push(on), synth)
      voices.speak('Chief', CHIEF.voice, 'line')
      synth.spoken[0].onstart?.(event)
      voices.silence()
      synth.spoken[0].onend?.(event)
      expect(talking).toEqual([true, false])
    })
  })

  it('tells the mix when it starts and stops talking, so the beds duck', () => {
    const synth = fakeSynth(['One'])
    const talking: boolean[] = []
    const voices = new SpeechVoices(() => 1, (on) => talking.push(on), synth)
    voices.speak('Chief', CHIEF.voice, 'line')

    const utterance = synth.spoken[0]
    utterance.onstart?.(null as unknown as SpeechSynthesisEvent)
    utterance.onend?.(null as unknown as SpeechSynthesisEvent)
    expect(talking).toEqual([true, false])
  })

  it('lets the beds back up if the utterance errors instead of finishing', () => {
    // Otherwise a failed line leaves the engine ducked for the rest of the shift.
    const synth = fakeSynth(['One'])
    const talking: boolean[] = []
    const voices = new SpeechVoices(() => 1, (on) => talking.push(on), synth)
    voices.speak('Chief', CHIEF.voice, 'line')
    synth.spoken[0].onerror?.(null as unknown as SpeechSynthesisErrorEvent)
    expect(talking).toEqual([false])
  })
})
