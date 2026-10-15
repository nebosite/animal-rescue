import { describe, expect, it } from 'vitest'
import { AudioEngine, listenerOrientation } from './AudioEngine'

describe('listenerOrientation', () => {
  it('faces -Z at the initial heading, matching the flight model', () => {
    const forward = listenerOrientation(0)
    expect(forward.x).toBeCloseTo(0)
    expect(forward.y).toBe(0)
    expect(forward.z).toBeCloseTo(-1)
  })

  it('faces -X after a quarter turn to the left', () => {
    const forward = listenerOrientation(Math.PI / 2)
    expect(forward.x).toBeCloseTo(-1)
    expect(forward.z).toBeCloseTo(0)
  })

  it('faces +X after a quarter turn to the right', () => {
    const forward = listenerOrientation(-Math.PI / 2)
    expect(forward.x).toBeCloseTo(1)
    expect(forward.z).toBeCloseTo(0)
  })
})

/** The few parts of an AudioContext the engine touches, with a state a test can hold suspended. */
class FakeContext {
  state: 'suspended' | 'running' = 'suspended'
  currentTime = 0
  destination = {}
  resumeCalls = 0
  allowResume = false
  gainTargets: number[] = []
  private statechange: Array<() => void> = []

  createDynamicsCompressor() { return { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect() {} } }
  createAnalyser() { return { fftSize: 0, connect() {} } }
  createGain() {
    const targets = this.gainTargets
    return { gain: { setTargetAtTime: (value: number) => { targets.push(value) } }, connect() {} }
  }
  addEventListener(_type: string, listener: () => void) { this.statechange.push(listener) }
  async resume() {
    this.resumeCalls++
    if (this.allowResume) this.become('running')
  }
  become(state: 'suspended' | 'running') {
    this.state = state
    this.statechange.forEach((listener) => listener())
  }
}

describe('AudioEngine start', () => {
  const make = () => {
    const fake = new FakeContext()
    const engine = new AudioEngine(() => fake as unknown as AudioContext)
    return { fake, engine }
  }

  it('keeps asking the browser to resume on later gestures when the first was refused', () => {
    const { fake, engine } = make()
    engine.start()
    expect(engine.started).toBe(false)
    expect(fake.resumeCalls).toBe(1)

    fake.allowResume = true
    engine.start() // a later key press the browser does honour
    expect(fake.resumeCalls).toBe(2)
    expect(engine.started).toBe(true)
  })

  it('lets every gesture try again, not just the first', () => {
    const { fake, engine } = make()
    const target = new EventTarget() as unknown as Window
    engine.armOnGesture(target)
    target.dispatchEvent(new Event('keydown'))
    target.dispatchEvent(new Event('keydown'))
    target.dispatchEvent(new Event('pointerdown'))
    expect(fake.resumeCalls).toBe(3)
  })

  it('says the volume again once the context is running', () => {
    const { fake, engine } = make()
    engine.setVolume(0.05)
    engine.start()
    const before = fake.gainTargets.length
    fake.become('running')
    expect(fake.gainTargets.length).toBe(before + 1)
    expect(fake.gainTargets.at(-1)).toBeCloseTo(0.05 * 0.8)
  })
})
