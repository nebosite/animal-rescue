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

  /**
   * End the dip now, whatever was scheduled.
   *
   * Synthesised speech has no length that can be worked out in advance, so it
   * ducks generously and calls this when it actually stops talking. Letting a
   * too-long duck expire on its own instead leaves the engine sitting low after
   * the voice has finished, which is heard as the sound having cut out.
   */
  release(): void {
    const now = this.context.currentTime
    this.until = now
    const gain = this.input.gain
    gain.cancelScheduledValues(now)
    gain.setTargetAtTime(1, now, RECOVER_SECONDS)
  }
}

/**
 * How far the beds drop while a voice is talking. Deep enough that the voice
 * is clearly on top, shallow enough that the engine is heard to keep running
 * underneath — the first cut (a third) read as the sound cutting out.
 */
const DUCKED = 0.55
const DIP_SECONDS = 0.05
const RECOVER_SECONDS = 0.18
