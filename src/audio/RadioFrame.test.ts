import { describe, expect, it } from 'vitest'
import { decibels, TRIM } from './Mix'
import { CEILING, RadioFrame } from './RadioFrame'
import { recordingAudio, type RecordedNode } from './RecordingAudio'

function setup() {
  const audio = recordingAudio()
  const frame = new RadioFrame(audio.engine)
  /** The short cracks: squelch and tick. */
  const cracks = () => audio.all('createBufferSource').filter((node) => node.props.loop !== true)
  /** The looping static. */
  const beds = () => audio.all('createBufferSource').filter((node) => node.props.loop === true)
  /** The gain the static plays through: the one that ramps up to a level. */
  const bedGain = (index = 0) =>
    audio.all('createGain').filter((node) => hasCall(node, 'linearRampToValueAtTime', (args) => args[0] > 0))[index]
  /** The gain that sets how hard the chatter bites: held at a level of its own, never ramped up. */
  const chatterGain = (index = 0) =>
    audio.all('createGain').filter(
      (node) => !hasCall(node, 'linearRampToValueAtTime', (args) => args[0] > 0)
        && hasCall(node, 'linearRampToValueAtTime', (args) => args[0] === 0),
    )[index]
  return { ...audio, frame, cracks, beds, bedGain, chatterGain }
}

function hasCall(node: RecordedNode | undefined, method: string, match: (args: number[]) => boolean = () => true) {
  return node?.calls.some((call) => call.method === method && match(call.args)) ?? false
}

const stops = (node: RecordedNode) =>
  node.calls.filter((call) => call.method === 'stop').map((call) => call.args[0])

describe('RadioFrame', () => {
  it('is quiet until a line is keyed', () => {
    const { frame, beds, cracks } = setup()
    expect(frame.isOpen).toBe(false)
    expect(beds()).toHaveLength(0)
    expect(cracks()).toHaveLength(0)
  })

  it('keys with a squelch and a bed of static', () => {
    const { frame, beds, cracks } = setup()
    frame.open()
    expect(frame.isOpen).toBe(true)
    expect(cracks()).toHaveLength(1)
    expect(beds()).toHaveLength(1)
    expect(beds()[0].calls.some((call) => call.method === 'start')).toBe(true)
  })

  it('starts the static from silence, even if it is faded in the same instant', () => {
    // Fading cancels the scheduled events, including the one that sets the bed
    // to zero. If the resting value were not zero too, the static would decay
    // from the node's default of 1 and burst out at twenty-five times its level.
    const { frame, bedGain } = setup()
    frame.open()
    expect(bedGain().params.get('gain')!.value).toBe(0)
    frame.cancel()
    expect(bedGain().params.get('gain')!.value).toBe(0)
  })

  describe('letting go', () => {
    it('releases with a tick, and fades and stops everything it started', () => {
      const { frame, beds, cracks, bedGain, chatterGain, all, clock } = setup()
      frame.open()
      clock.time = 2
      frame.close()
      expect(frame.isOpen).toBe(false)
      // Squelch plus tick.
      expect(cracks()).toHaveLength(2)

      // The static is faded from the moment of release, not cut...
      for (const gain of [bedGain(), chatterGain()]) {
        expect(hasCall(gain, 'cancelScheduledValues', (args) => args[0] === 2)).toBe(true)
        expect(hasCall(gain, 'setTargetAtTime', (args) => args[0] === 0 && args[1] === 2)).toBe(true)
      }
      // ...and both the noise and the chatter on it are stopped soon after.
      expect(stops(beds()[0]).at(-1)).toBeLessThan(2.3)
      expect(stops(all('createOscillator')[0]).at(-1)).toBeLessThan(2.3)
    })

    it('drops quietly when cancelled, with no tick', () => {
      const { frame, beds, cracks, clock } = setup()
      frame.open()
      clock.time = 1
      frame.cancel()
      expect(frame.isOpen).toBe(false)
      expect(cracks()).toHaveLength(1)
      expect(stops(beds()[0]).at(-1)).toBeLessThan(1.3)
    })

    it('still fades properly when let go inside the first instant of the static fading in', () => {
      const { frame, bedGain, clock } = setup()
      frame.open()
      clock.time = 0.03
      frame.close()
      expect(hasCall(bedGain(), 'cancelScheduledValues', (args) => args[0] === 0.03)).toBe(true)
      expect(hasCall(bedGain(), 'setTargetAtTime', (args) => args[0] === 0 && args[1] === 0.03)).toBe(true)
    })

    it('does nothing to close or cancel what is not open', () => {
      const { frame, nodes } = setup()
      const made = nodes.length
      frame.close()
      frame.cancel()
      expect(nodes).toHaveLength(made)
    })

    it('does not tick twice for one release', () => {
      const { frame, cracks } = setup()
      frame.open()
      frame.close()
      frame.close()
      expect(cracks()).toHaveLength(2)
    })
  })

  it('re-keys without stacking a second bed of static', () => {
    // A line that replaces another opens again before the first one closes.
    const { frame, beds, cracks, bedGain, chatterGain, all, clock } = setup()
    frame.open()
    clock.time = 3
    frame.open()
    expect(frame.isOpen).toBe(true)
    // A fresh squelch for the new line, and a new bed...
    expect(cracks()).toHaveLength(2)
    expect(beds()).toHaveLength(2)
    // ...but the old bed was faded out and stopped at the moment of re-keying,
    // chatter and all, so only one is audible.
    for (const gain of [bedGain(0), chatterGain(0)]) {
      expect(hasCall(gain, 'setTargetAtTime', (args) => args[0] === 0 && args[1] === 3)).toBe(true)
    }
    expect(stops(beds()[0]).at(-1)).toBeLessThan(3.3)
    expect(stops(all('createOscillator')[0]).at(-1)).toBeLessThan(3.3)
    // The new bed has not been touched.
    expect(hasCall(bedGain(1), 'setTargetAtTime')).toBe(false)
  })

  describe('the ceiling', () => {
    // The speech engine may never send its end event. The fade has to be
    // scheduled on the audio clock when the static starts, not waited for.
    it('holds the static to the ceiling and then fades it, chatter included', () => {
      const { frame, bedGain, chatterGain } = setup()
      frame.open()
      for (const gain of [bedGain(), chatterGain()]) {
        // Held at its level right up to the ceiling...
        expect(hasCall(gain, 'setValueAtTime', (args) => args[0] > 0 && args[1] === CEILING)).toBe(true)
        // ...then ramped to nothing straight after it, and no later.
        expect(hasCall(gain, 'linearRampToValueAtTime', (args) => args[0] === 0 && args[1] === CEILING + 0.3)).toBe(true)
      }
    })

    it('stops the noise and the chatter once they have faded, and not before', () => {
      const { frame, beds, all } = setup()
      frame.open()
      expect(stops(beds()[0])).toEqual([CEILING + 0.4])
      expect(stops(all('createOscillator')[0])).toEqual([CEILING + 0.4])
    })

    it('does not tick a second time if the line ends long after the static has gone', () => {
      const { frame, cracks, clock } = setup()
      frame.open()
      clock.time = CEILING + 5
      frame.close()
      // A close this late is still one tick: squelch plus tick, never more.
      expect(cracks()).toHaveLength(2)
    })
  })

  it('sits where it was tuned in the mix', () => {
    const { nodes } = setup()
    const output = nodes.find((node) => node.kind === 'createGain')!
    expect(output.params.get('gain')!.value).toBeCloseTo(decibels(TRIM.radio), 6)
  })
})
