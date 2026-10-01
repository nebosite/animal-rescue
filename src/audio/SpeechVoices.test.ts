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
    expect(squeak.pitch).toBeLessThanOrEqual(1.75)
    expect(rumble.pitch).toBeGreaterThanOrEqual(0.45)
    expect(squeak.rate).toBeLessThanOrEqual(1.45)
    expect(rumble.rate).toBeGreaterThanOrEqual(0.85)
  })
})

/** A stand-in for the browser's speech synthesiser. */
function fakeSynth(voiceNames: string[] = []): SpeechLike & { spoken: SpeechSynthesisUtterance[]; cancels: number } {
  const voices = voiceNames.map((name) => ({ name, localService: true } as SpeechSynthesisVoice))
  const spoken: SpeechSynthesisUtterance[] = []
  return {
    spoken,
    cancels: 0,
    speak(utterance) { spoken.push(utterance) },
    cancel() { this.cancels += 1 },
    getVoices() { return voices },
  }
}

describe('SpeechVoices', () => {
  // The real utterance class is a browser global, so stand one in.
  vi.stubGlobal('SpeechSynthesisUtterance', class {
    pitch = 1
    rate = 1
    volume = 1
    voice: SpeechSynthesisVoice | null = null
    constructor(readonly text: string) {}
  })

  it('reports itself unavailable when the browser has no speech at all', () => {
    const voices = new SpeechVoices(() => 1, () => {}, null)
    expect(voices.available).toBe(false)
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
