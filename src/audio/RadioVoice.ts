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
 * bare Linux box. So the blips stay, as the thing that always works.
 *
 * Speech is English only. The choice between speech and blips is made per line,
 * but it only ever changes once in practice: while the browser's voice list is
 * still loading the answer is "speak", and it flips to blips only if the list
 * turns out to hold no English voice at all. Deciding once at construction
 * would read the opening lines in blips on every Chrome start, because the list
 * is empty then.
 */
export class RadioVoice {
  private readonly speech: SpeechVoices
  private readonly blips: Pick<VoiceBlips, 'speak'>

  constructor(
    engine: AudioEngine,
    reverb?: Reverb,
    ducker?: Ducker,
    /** Stand-ins for the two ways of speaking, so the choice between them can be tested. */
    parts?: { speech?: SpeechVoices; blips?: Pick<VoiceBlips, 'speak'> },
  ) {
    this.blips = parts?.blips ?? new VoiceBlips(engine, reverb, ducker)
    this.speech = parts?.speech ?? new SpeechVoices(
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

  speak(speaker: string, voice: VoiceProfile, text: string): void {
    if (this.speech.canSpeakEnglish) {
      this.speech.speak(speaker, voice, text)
      return
    }
    // If the verdict has just turned to blips, a spoken line may still be in
    // flight: it would talk over them, and its end event would then cut the
    // blips' duck short.
    this.speech.silence()
    this.blips.speak(voice, text)
  }

  /** Call every frame. */
  frame(): void {
    this.speech.checkLevel()
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
