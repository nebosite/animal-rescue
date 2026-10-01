import type { VoiceProfile } from '../game/AnimalProfile'
import type { AudioEngine } from './AudioEngine'
import type { Ducker } from './Ducker'
import type { Reverb } from './Reverb'
import { SpeechVoices } from './SpeechVoices'
import { VoiceBlips } from './VoiceBlips'

/**
 * Whoever is on the radio, read out by the browser if it can — and blipped in
 * the old Animal-Crossing way if it cannot.
 *
 * Real voices are worth the trouble because the lines are jokes, and a joke
 * read aloud lands where a joke in blips plus subtitles does not. But speech
 * synthesis is the least dependable thing in a browser: it is absent on some,
 * silent until a gesture on others, and has no installed voices at all on a
 * bare Linux box. So the blips stay, as the thing that always works, and the
 * decision is made once at construction rather than per line — a session that
 * alternates between the two sounds broken.
 */
export class RadioVoice {
  private readonly speech: SpeechVoices
  private readonly blips: VoiceBlips

  constructor(engine: AudioEngine, reverb?: Reverb, ducker?: Ducker) {
    this.blips = new VoiceBlips(engine, reverb, ducker)
    this.speech = new SpeechVoices(
      // Speech bypasses the AudioContext entirely, so the master volume and
      // the mute button have to be applied to the utterance by hand.
      () => (engine.muted ? 0 : engine.volume),
      // And the beds have to be ducked from the utterance's own start and end,
      // since there is no buffer length to work the timing out from.
      (talking) => {
        if (talking) ducker?.duck(DUCK_WHILE_TALKING)
        else ducker?.release()
      },
    )
  }

  /** True when lines are being read aloud rather than blipped. */
  get speaking(): boolean {
    return this.speech.available
  }

  speak(speaker: string, voice: VoiceProfile, text: string): void {
    if (this.speech.available) this.speech.speak(speaker, voice, text)
    else this.blips.speak(voice, text)
  }

  /** Shut up — between shifts, say. */
  silence(): void {
    this.speech.silence()
  }
}

/**
 * How long a duck is held before the utterance's end event arrives. Generous,
 * because an utterance that outlives its duck pops the engine back up in the
 * middle of a sentence; `Ducker.release` ends it the moment speaking stops, so
 * being generous costs nothing.
 */
const DUCK_WHILE_TALKING = 12
