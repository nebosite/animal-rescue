import { describe, expect, it } from 'vitest'
import { TOP_SPEED } from '../game/Helicopter'
import type { AudioEngine } from './AudioEngine'
import { FireSound, fireOutput } from './FireSound'
import { decibels, TRIM } from './Mix'
import { RotorSound, rotorOutput, rotorTargets } from './RotorSound'
import { WindSound, windOutput, windTargets } from './WindSound'

/**
 * The trim functions are pure and tested on their own, but a trim that nothing
 * calls is exactly the dead wire CLAUDE.md warns about: put the raw gain back
 * in an `update()` and every pure test stays green. So these build the real
 * sounds against a recording stand-in for the audio context, run the real
 * `update()`, and read what it asked the output gain to become.
 */
interface Recorded {
  kind: string
  /** Every value given to `setTargetAtTime`, by parameter name. */
  targets: Map<string, number[]>
}

function recordingEngine(): { engine: AudioEngine; nodes: Recorded[] } {
  const nodes: Recorded[] = []

  const makeNode = (kind: string): unknown => {
    const record: Recorded = { kind, targets: new Map() }
    nodes.push(record)
    const store: Record<string, unknown> = {}
    const param = (name: string) => ({
      value: 0,
      setTargetAtTime(value: number) {
        const list = record.targets.get(name) ?? []
        list.push(value)
        record.targets.set(name, list)
      },
      setValueAtTime() {},
      linearRampToValueAtTime() {},
      exponentialRampToValueAtTime() {},
      cancelScheduledValues() {},
    })
    return new Proxy({}, {
      get(_target, prop: string) {
        if (prop === 'connect') return (destination: unknown) => destination
        if (prop === 'disconnect' || prop === 'start' || prop === 'stop') return () => {}
        // Anything else is either a property that was set (type, buffer) or an
        // audio parameter (gain, frequency, Q), made on first touch.
        if (!(prop in store)) store[prop] = param(prop)
        return store[prop]
      },
      set(_target, prop: string, value) {
        store[prop] = value
        return true
      },
    })
  }

  const context = new Proxy({}, {
    get(_target, prop: string) {
      if (prop === 'sampleRate') return 8000
      if (prop === 'currentTime') return 0
      if (prop === 'destination') return makeNode('destination')
      if (prop === 'createBuffer') {
        return (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) })
      }
      if (prop.startsWith('create')) return () => makeNode(prop)
      return undefined
    },
  })

  const engine = { context, master: makeNode('master') } as unknown as AudioEngine
  return { engine, nodes }
}

/** Each sound makes its output gain first, so it is the first gain node built. */
function outputTargets(nodes: Recorded[]): number[] {
  const output = nodes.find((node) => node.kind === 'createGain')
  return output?.targets.get('gain') ?? []
}

describe('the trims reach the speaker', () => {
  it('trims the fire in update(), not just in the helper', () => {
    const { engine, nodes } = recordingEngine()
    new FireSound(engine).update(0, true)
    const asked = outputTargets(nodes).at(-1)
    expect(asked).toBeCloseTo(0.75 * decibels(TRIM.fire), 6)
    expect(asked).toBeCloseTo(fireOutput(0.75), 6)
  })

  it('trims the wind in update()', () => {
    const { engine, nodes } = recordingEngine()
    new WindSound(engine).update(40, TOP_SPEED)
    const raw = windTargets(40, TOP_SPEED).gain
    const asked = outputTargets(nodes).at(-1)!
    expect(asked).toBeCloseTo(windOutput(raw), 6)
    expect(asked).toBeLessThan(raw)
  })

  it('trims the working rotor in update(), and leaves the parked one alone', () => {
    const working = recordingEngine()
    new RotorSound(working.engine).update(1, TOP_SPEED, 1)
    const raw = rotorTargets(1, TOP_SPEED, 1).gain
    const asked = outputTargets(working.nodes).at(-1)!
    expect(asked).toBeCloseTo(rotorOutput(raw), 6)
    expect(asked).toBeLessThan(raw)

    const parked = recordingEngine()
    new RotorSound(parked.engine).update(0, 0, 1)
    expect(outputTargets(parked.nodes).at(-1)).toBeCloseTo(rotorTargets(0, 0, 1).gain, 6)
  })
})
