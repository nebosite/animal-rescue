import type { VoiceProfile } from '../game/AnimalProfile'

/** How one character should be read out by the browser's speech synthesiser. */
export interface SpeechSettings {
  pitch: number
  rate: number
}

/**
 * The slice of the Web Speech API this class uses, so it can be faked in a test.
 */
export interface SpeechLike {
  speak(utterance: SpeechSynthesisUtterance): void
  cancel(): void
  getVoices(): ReadonlyArray<SpeechSynthesisVoice>
  addEventListener?(type: 'voiceschanged', listener: () => void): void
}

/**
 * Turns a character's blip profile into pitch and pace for a real synthesised
 * voice, so Gus still rumbles and Bram still gabbles.
 *
 * Pure, so the mapping can be checked without a browser — and the browser is
 * the whole difficulty here: every machine has a different set of installed
 * voices, so the only thing that can be relied on to carry a character is the
 * pitch and the speed we ask for.
 */
export function speechFor(voice: VoiceProfile): SpeechSettings {
  // The roster runs from Gus at 150 Hz to Bram at 620. Mapped across most of
  // the synthesiser's useful pitch range, which stops short of 0 and 2 because
  // both ends are unintelligible on some engines.
  const low = clamp((voice.baseHz - LOW_HZ) / (HIGH_HZ - LOW_HZ), 0, 1)
  // Blips per second runs 6 to 17 and means much the same thing: how fast this
  // character talks.
  const hurry = clamp((voice.rate - SLOW_BLIPS) / (FAST_BLIPS - SLOW_BLIPS), 0, 1)
  return {
    pitch: MIN_PITCH + (MAX_PITCH - MIN_PITCH) * low,
    rate: MIN_RATE + (MAX_RATE - MIN_RATE) * hurry,
  }
}

/**
 * Radio voices read aloud by the browser.
 *
 * Each speaker is pinned to one of the installed voices by a hash of their
 * name, so the Chief always sounds like the Chief within a session — matching
 * on voice names is hopeless, since no two machines have the same list, and
 * "pick the first English one" gives every character the same voice, which is
 * worse than blips.
 *
 * Speech does not go through the AudioContext, so two things have to be done by
 * hand that the rest of the mix gets for free: the master volume has to be
 * applied to each utterance, and the ambient beds have to be ducked from the
 * utterance's own start and end events rather than from a known duration.
 */
export class SpeechVoices {
  private readonly synth: SpeechLike | null
  private installed: ReadonlyArray<SpeechSynthesisVoice> = []

  constructor(
    /** What the mix is set to, 0..1, and whether it is muted. */
    private readonly level: () => number,
    /** Dip the beds while talking, and let them back up afterwards. */
    private readonly onTalking: (talking: boolean) => void = () => {},
    synth: SpeechLike | null = browserSpeech(),
  ) {
    this.synth = synth
    if (!synth) return

    this.installed = synth.getVoices()
    // Chrome has no voices at all until it has fetched the list, and answers
    // the first call with an empty array. Without this the first few lines of
    // every session come out in the default voice.
    synth.addEventListener?.('voiceschanged', () => {
      this.installed = this.synth?.getVoices() ?? []
    })
  }

  /** True when the browser can actually read a line out. */
  get available(): boolean {
    return this.synth !== null
  }

  /** How many installed voices there are to hand out. */
  get voiceCount(): number {
    return this.installed.length
  }

  /**
   * Say a line. Cuts off whatever was being said first: the radio panel only
   * shows one line at a time, and a backlog of speech that lags behind the
   * text on screen is worse than a line missed.
   */
  speak(speaker: string, voice: VoiceProfile, text: string): void {
    if (!this.synth) return
    const volume = this.level()
    this.synth.cancel()
    if (volume <= 0) return

    const settings = speechFor(voice)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.pitch = settings.pitch
    utterance.rate = settings.rate
    utterance.volume = volume

    const picked = this.voiceFor(speaker)
    if (picked) utterance.voice = picked

    utterance.onstart = () => this.onTalking(true)
    utterance.onend = () => this.onTalking(false)
    utterance.onerror = () => this.onTalking(false)
    this.synth.speak(utterance)
  }

  /** Stop talking — between shifts, say. */
  silence(): void {
    this.synth?.cancel()
    this.onTalking(false)
  }

  /**
   * One installed voice per speaker, chosen by a hash of the name so it is
   * stable, and spread across the list so two characters rarely collide.
   */
  private voiceFor(speaker: string): SpeechSynthesisVoice | null {
    if (this.installed.length === 0) return null
    // Prefer the local voices: the remote ones need a round trip, and a radio
    // line that arrives two seconds after the subtitle is worse than none.
    const local = this.installed.filter((voice) => voice.localService)
    const pool = local.length > 0 ? local : this.installed
    return pool[hash(speaker) % pool.length]
  }
}

function browserSpeech(): SpeechLike | null {
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return null
  return speechSynthesis
}

/** Deterministic non-negative integer from a name. */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (h ^ (h >>> 15)) >>> 0
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

/** The pitch range the roster's blip voices span. */
const LOW_HZ = 150
const HIGH_HZ = 620
/** Kept off both ends of the synthesiser's range, which are unintelligible. */
const MIN_PITCH = 0.45
const MAX_PITCH = 1.75
/** And how fast they talk: blips per second, mapped to speech rate. */
const SLOW_BLIPS = 6
const FAST_BLIPS = 17
const MIN_RATE = 0.85
const MAX_RATE = 1.45
