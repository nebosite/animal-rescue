/**
 * A gain stage for the ambient beds that dips while someone is talking, the
 * way a radio call pushes the engine down under it.
 *
 * Without this the voices are simply masked: measured against a running rotor
 * and wind bed, blips at their old level changed the output by 1%.
 */
export class Ducker {
  /** Beds connect here. */
  readonly input: GainNode
  private until = 0

  constructor(private readonly context: AudioContext, destination: AudioNode) {
    this.input = context.createGain()
    this.input.gain.value = 1
    this.input.connect(destination)
  }

  /** Dip for `seconds`, then come back. Overlapping calls extend the dip. */
  duck(seconds: number): void {
    const now = this.context.currentTime
    const end = Math.max(this.until, now + seconds)
    this.until = end

    const gain = this.input.gain
    gain.cancelScheduledValues(now)
    gain.setTargetAtTime(DUCKED, now, DIP_SECONDS)
    // Hold the dip until the talking stops, then ease back up.
    gain.setTargetAtTime(DUCKED, end, 0.001)
    gain.setTargetAtTime(1, end + 0.01, RECOVER_SECONDS)
  }
}

/** How far the beds drop while a voice is talking. */
const DUCKED = 0.32
const DIP_SECONDS = 0.05
const RECOVER_SECONDS = 0.25
