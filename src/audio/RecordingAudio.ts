import type { AudioEngine } from './AudioEngine'

/**
 * A stand-in for the audio context that builds nothing and records everything,
 * so the sounds that cannot run in Node (they need a real AudioContext) can
 * still be driven through their real code and asked what they did.
 *
 * Test support only: nothing in the game imports this.
 */
export interface Call {
  /** The audio parameter it was made on ('gain', 'frequency'), or '' for the node itself. */
  param: string
  method: string
  args: number[]
}

export interface RecordedNode {
  kind: string
  calls: Call[]
  /** Every value given to `setTargetAtTime`, by parameter name. */
  targets: Map<string, number[]>
  /** Plain properties that were set on the node: type, loop, buffer. */
  props: Record<string, unknown>
  /** The audio parameters it was asked for, so a plain `.value =` can be read back. */
  params: Map<string, { value: number }>
}

export interface RecordingAudio {
  engine: AudioEngine
  nodes: RecordedNode[]
  /** Moves the audio clock on. */
  clock: { time: number }
  /** Nodes of one kind, in the order they were made. */
  all(kind: string): RecordedNode[]
}

const PARAM_METHODS = [
  'setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime',
  'setTargetAtTime', 'cancelScheduledValues',
]

export function recordingAudio(): RecordingAudio {
  const nodes: RecordedNode[] = []
  const clock = { time: 0 }

  const makeNode = (kind: string): unknown => {
    const record: RecordedNode = { kind, calls: [], targets: new Map(), props: {}, params: new Map() }
    nodes.push(record)
    const store: Record<string, unknown> = {}

    const param = (name: string) => {
      // A GainNode's gain starts at 1, which matters: code that forgets to set a
      // resting value will find 1 here, as it would in a browser.
      const made: Record<string, unknown> & { value: number } = { value: name === 'gain' ? 1 : 0 }
      for (const method of PARAM_METHODS) {
        made[method] = (...args: number[]) => {
          record.calls.push({ param: name, method, args })
          if (method === 'setTargetAtTime') {
            const list = record.targets.get(name) ?? []
            list.push(args[0])
            record.targets.set(name, list)
          }
        }
      }
      record.params.set(name, made)
      return made
    }

    return new Proxy({}, {
      get(_target, prop: string) {
        if (prop === 'connect') return (destination: unknown) => destination
        if (prop === 'disconnect') return () => {}
        if (prop === 'start' || prop === 'stop') {
          return (...args: number[]) => record.calls.push({ param: '', method: prop, args })
        }
        // Anything else is either a property that was set (type, buffer) or an
        // audio parameter (gain, frequency, Q), made on first touch.
        if (!(prop in store)) store[prop] = param(prop)
        return store[prop]
      },
      set(_target, prop: string, value) {
        store[prop] = value
        record.props[prop] = value
        return true
      },
    })
  }

  const context = new Proxy({}, {
    get(_target, prop: string) {
      if (prop === 'sampleRate') return 8000
      if (prop === 'currentTime') return clock.time
      if (prop === 'destination') return makeNode('destination')
      if (prop === 'createBuffer') {
        return (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) })
      }
      if (prop.startsWith('create')) return () => makeNode(prop)
      return undefined
    },
  })

  const engine = { context, master: makeNode('master') } as unknown as AudioEngine
  return { engine, nodes, clock, all: (kind) => nodes.filter((node) => node.kind === kind) }
}
