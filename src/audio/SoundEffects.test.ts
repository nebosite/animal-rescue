import { describe, expect, it } from 'vitest'
import { recordingAudio } from './RecordingAudio'
import { SoundEffects } from './SoundEffects'

/** One tear of foliage, heard through the real code against a recording context. */
function oneTear() {
  const audio = recordingAudio()
  const effects = new SoundEffects(audio.engine)
  effects.advance(1)
  effects.foliage()
  const noise = audio.all('createBufferSource')
  const stopOf = (node: (typeof noise)[number]) =>
    node.calls.filter((c) => c.method === 'stop').map((c) => c.args[0])[0]
  // Each noise burst has its own envelope that starts at its peak.
  const noisePeaks = audio.all('createGain')
    .flatMap((g) => g.calls.filter((c) => c.method === 'setValueAtTime' && c.args[0] > 0).map((c) => c.args[0]))
  // The tone's envelope starts at zero and ramps up to its peak.
  const tonePeaks = audio.all('createGain')
    .flatMap((g) => g.calls.filter((c) => c.method === 'linearRampToValueAtTime').map((c) => c.args[0]))
  return { noise, stopOf, noisePeaks, tonePeaks }
}

describe('SoundEffects.foliage', () => {
  it('is mostly noise: several white-noise cracks and only a faint tone', () => {
    const { noise, noisePeaks, tonePeaks } = oneTear()
    expect(noise.length).toBeGreaterThanOrEqual(2)
    const noiseLevel = noisePeaks.reduce((sum, p) => sum + p, 0)
    expect(noiseLevel).toBeGreaterThan(0.8)
    expect(Math.max(...tonePeaks)).toBeLessThanOrEqual(0.1)
  })

  it('is staccato: every crack is over within a few hundredths of a second', () => {
    // At eleven blade passes a second and one and a half tears a pass, a tear
    // has about sixty milliseconds. A crack you can hear the end of is what
    // makes the next one audible as a separate chop.
    const { noise, stopOf } = oneTear()
    for (const burst of noise) expect(stopOf(burst)).toBeLessThan(0.06)
  })

  it('does not fire more than once in a tear interval', () => {
    const audio = recordingAudio()
    const effects = new SoundEffects(audio.engine)
    effects.advance(1)
    effects.foliage()
    const after = audio.nodes.length
    effects.foliage()
    expect(audio.nodes.length).toBe(after)
  })
})
