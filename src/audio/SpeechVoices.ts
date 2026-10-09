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
  // The roster runs from Gus at 150 Hz to Bram at 620. Mapped across the low
  // half of the synthesiser's pitch range, which stops short of 0 because the
  // bottom end is unintelligible on some engines.
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
 * Each speaker is pinned to one of the installed *English* voices by a hash of
 * their name, so the Chief sounds like the Chief for the rest of a session once
 * the list has loaded — matching on voice names is hopeless, since no two
 * machines have the same list, and "pick the first English one" gives every
 * character the same voice, which is worse than blips.
 *
 * English only, because a voice is chosen from whatever the machine has and a
 * machine with Japanese voices installed used to read the Chief's jokes in
 * Japanese. Where the list is empty (Chrome fills it in late) the line is still
 * said, with the language set, so the browser picks its own English default.
 *
 * Speech does not go through the AudioContext, so two things have to be done by
 * hand that the rest of the mix gets for free: the master volume has to be
 * applied to each utterance, and the ambient beds have to be ducked from the
 * utterance's own start and end events rather than from a known duration.
 */
export class SpeechVoices {
  private readonly synth: SpeechLike | null
  private installed: ReadonlyArray<SpeechSynthesisVoice> = []
  /**
   * The utterance being spoken now. Cancelling one fires its end or error event
   * *after* the next has been queued, and that late event used to un-duck the
   * beds in the middle of the new line.
   */
  private current: SpeechSynthesisUtterance | null = null
  /**
   * Set when a machine that reported no voices at all proved unable to speak.
   * Without it "the list is empty" would mean "speak" for ever, and a bare
   * Linux box would get a silent radio instead of the blips.
   */
  private broken = false
  private watchdog: ReturnType<typeof setTimeout> | null = null

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
      // Voices turned up after all, so the earlier failure was just slowness.
      if (this.installed.length > 0) this.broken = false
    })
  }

  /**
   * True when a line can be read aloud without risking a foreign voice. An empty
   * list means the browser has not told us yet, not that there is nothing: it
   * is judged as "no English" only once the list is known and has none — or,
   * for a list that never arrives, once a line has failed to speak.
   */
  get canSpeakEnglish(): boolean {
    if (!this.synth || this.broken) return false
    return this.installed.length === 0 || this.english().length > 0
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
    // Forget the old line before cancelling it, so its late end event is stale.
    this.current = null
    this.stopWatchdog()
    this.synth.cancel()
    if (volume <= 0) {
      // Nothing new is coming to end the duck, and the cancelled line no longer
      // counts, so let the beds back up here.
      this.onTalking(false)
      return
    }

    const settings = speechFor(voice)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.pitch = settings.pitch
    utterance.rate = settings.rate
    utterance.volume = volume

    const picked = this.voiceFor(speaker)
    if (picked) utterance.voice = picked
    // Always set, so even with no voice chosen the engine is asked for English
    // rather than whatever the operating system's language happens to be.
    utterance.lang = picked?.lang || FALLBACK_LANGUAGE

    utterance.onstart = () => {
      if (this.current !== utterance) return
      this.stopWatchdog()
      this.onTalking(true)
    }
    utterance.onend = () => this.finish(utterance)
    utterance.onerror = (event) => {
      // With no voices on record, an engine that cannot speak at all is the
      // bare-machine case. A cancelled line is just us moving on.
      if (this.current === utterance && this.installed.length === 0 && UNABLE_TO_SPEAK.includes(event?.error)) {
        this.broken = true
      }
      this.finish(utterance)
    }
    this.current = utterance
    this.synth.speak(utterance)

    // An engine with nothing to say it with can also just never start.
    if (this.installed.length === 0) {
      this.watchdog = setTimeout(() => {
        if (this.current !== utterance) return
        this.broken = true
        this.silence()
      }, START_TIMEOUT_MS)
    }
  }

  /**
   * Call every frame. An utterance is given its volume once, when it starts, and
   * the master gain never reaches it, so turning the volume down or off in the
   * middle of a line would otherwise let the rest of it play.
   */
  checkLevel(): void {
    if (this.current && this.level() <= 0) this.silence()
  }

  /** Stop talking — between shifts, say. */
  silence(): void {
    this.current = null
    this.stopWatchdog()
    this.synth?.cancel()
    this.onTalking(false)
  }

  /** A line ended or failed. Only the current one is allowed to say so. */
  private finish(utterance: SpeechSynthesisUtterance): void {
    if (this.current !== utterance) return
    this.current = null
    this.stopWatchdog()
    this.onTalking(false)
  }

  private stopWatchdog(): void {
    if (this.watchdog === null) return
    clearTimeout(this.watchdog)
    this.watchdog = null
  }

  /** Installed voices that speak English, any accent. */
  private english(): SpeechSynthesisVoice[] {
    return this.installed.filter((voice) => isEnglish(voice.lang))
  }

  /**
   * One English voice per speaker, chosen by a hash of the name so it is
   * stable, and spread across the list so two characters rarely collide.
   */
  private voiceFor(speaker: string): SpeechSynthesisVoice | null {
    const english = this.english()
    if (english.length === 0) return null
    // Prefer the local voices: the remote ones need a round trip, and a radio
    // line that arrives two seconds after the subtitle is worse than none.
    const local = english.filter((voice) => voice.localService)
    const pool = local.length > 0 ? local : english
    return pool[hash(speaker) % pool.length]
  }
}

/**
 * Whether a BCP 47 language tag is English. Some platforms report `en_US`, and a
 * voice with no tag at all is not trusted: an unlabelled voice is how a foreign
 * one slips through.
 */
function isEnglish(lang: string | undefined): boolean {
  if (!lang) return false
  return lang.replace('_', '-').toLowerCase().split('-')[0] === 'en'
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
/**
 * Half of what they were (0.45 to 1.75), because the voices came out too high
 * to sit under the helicopter. Still kept well off 0, which is unintelligible
 * on some engines, and wide enough that all seven characters stay distinct.
 */
const MIN_PITCH = 0.225
const MAX_PITCH = 0.875
/** What a line is said in when no voice has been chosen. */
const FALLBACK_LANGUAGE = 'en-US'
/**
 * How long a line may take to start before an engine with no reported voices is
 * written off. Generous, because Chrome's first line can be slow while it loads
 * its list; a late `voiceschanged` undoes the verdict anyway.
 */
const START_TIMEOUT_MS = 5000
/** Errors that mean the engine has nothing to speak with, not that we cancelled. */
const UNABLE_TO_SPEAK: ReadonlyArray<string | undefined> = [
  'synthesis-unavailable', 'synthesis-failed', 'language-unavailable', 'voice-unavailable',
]
/** And how fast they talk: blips per second, mapped to speech rate. */
const SLOW_BLIPS = 6
const FAST_BLIPS = 17
const MIN_RATE = 0.85
const MAX_RATE = 1.45
