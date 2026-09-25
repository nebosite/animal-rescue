/** How a character's radio voice blips: waveform, pitch, wobble, and pace. */
export interface VoiceProfile {
  wave: OscillatorType
  baseHz: number
  /** Fraction of pitch variation between blips, 0..1. */
  spread: number
  /** Blips per second. */
  rate: number
}

/** The sound an animal makes while waiting to be found. */
export interface CallProfile {
  wave: OscillatorType
  fromHz: number
  toHz: number
  seconds: number
  lowpassHz: number
  /** How many times the call repeats back to back. */
  repeats: number
}

export interface AnimalLook {
  coat: number
  accent: number
  scale: number
  ears: 'pointy' | 'round' | 'tufted'
  tail: 'bushy' | 'stub' | 'none'
}

export interface AnimalProfile {
  id: string
  name: string
  species: string
  /** Points for a smooth delivery. */
  value: number
  /** 0 is unbothered, 1 is a prima donna: how little rough handling earns a scold. */
  fussiness: number
  look: AnimalLook
  voice: VoiceProfile
  call: CallProfile
  lines: {
    greeting: string[]
    scold: string[]
    thanks: string[]
    /** Thanks after being scolded on the way — delivered, but not impressed. */
    grudging: string[]
    /** Shouted while running from the fire to somewhere new. */
    bolt: string[]
  }
}

export interface SpeakerProfile {
  name: string
  voice: VoiceProfile
}

/**
 * The animals, in the order they turn up. Each one is a character before it
 * is a pickup: the point is that the player wants to save *this* one.
 */
export const ROSTER: readonly AnimalProfile[] = [
  {
    id: 'pip',
    name: 'Pip',
    species: 'fox kit',
    value: 3,
    fussiness: 0.7,
    look: { coat: 0xe0742f, accent: 0xfff1e0, scale: 1.05, ears: 'pointy', tail: 'bushy' },
    voice: { wave: 'triangle', baseHz: 540, spread: 0.35, rate: 14 },
    call: { wave: 'sawtooth', fromHz: 950, toHz: 1400, seconds: 0.14, lowpassHz: 2600, repeats: 2 },
    lines: {
      greeting: ['Oh finally, finally— wait, is this thing safe?', 'Pip here! Go go go— but gently!'],
      scold: ['EEP! My tail nearly came off!', "I'm not cargo, I'm a FOX!", 'Warn me next time!'],
      thanks: ["That was... actually kind of fun. Don't tell anyone.", 'Pip, safe and sound! Mostly sound.'],
      grudging: ['I made it. My stomach is still up there somewhere.', 'Thanks. I think. Never again.'],
      bolt: ['NOPE nope nope nope— running!', "Too hot! I'm moving, find me again!"],
    },
  },
  {
    id: 'gus',
    name: 'Gus',
    species: 'bear cub',
    value: 2,
    fussiness: 0.15,
    look: { coat: 0x6b4a2e, accent: 0xd9b48a, scale: 1.55, ears: 'round', tail: 'stub' },
    voice: { wave: 'sine', baseHz: 150, spread: 0.12, rate: 6 },
    call: { wave: 'sine', fromHz: 190, toHz: 120, seconds: 0.5, lowpassHz: 500, repeats: 1 },
    lines: {
      greeting: ['Mmf. Wake me when we get there.', 'Oh. Hello. Snacks?'],
      scold: ['Hm? Something bumped.', 'Careful. I was dreaming about honey.'],
      thanks: ['Nice nap. Thanks.', "Zzz... oh. We're here. Neat."],
      grudging: ['Bumpy nap. Still a nap.', 'Hm. Next time, fewer bumps.'],
      bolt: ['Hm. Warm. Moving over there.', 'Fire. Ugh. Fine, I will walk.'],
    },
  },
  {
    id: 'duchess',
    name: 'Duchess',
    species: 'deer',
    value: 5,
    fussiness: 1,
    look: { coat: 0xb98a5a, accent: 0xf5ead8, scale: 1.5, ears: 'tufted', tail: 'stub' },
    voice: { wave: 'triangle', baseHz: 380, spread: 0.2, rate: 9 },
    call: { wave: 'triangle', fromHz: 720, toHz: 500, seconds: 0.35, lowpassHz: 1800, repeats: 1 },
    lines: {
      greeting: ['Finally. Mind the legs, they are insured.', 'You are late. Proceed — smoothly.'],
      scold: ['Excuse me. I am not luggage.', 'Unacceptable. My stylist will hear of this.', 'Slower. SLOWER.'],
      thanks: ['Adequate. You may tell people you carried the Duchess.', 'Hmph. I have had worse pilots. Barely.'],
      grudging: ['I shall be writing a letter.', 'That was a disgrace. I am, however, alive.'],
      bolt: ['A Duchess does not RUN. She relocates. Briskly.', 'This is intolerable. I am over there now.'],
    },
  },
  {
    id: 'mo',
    name: 'Mo',
    species: 'hedgehog',
    value: 1,
    fussiness: 0.45,
    look: { coat: 0x7c6b5a, accent: 0xe9d8c4, scale: 0.8, ears: 'round', tail: 'none' },
    voice: { wave: 'square', baseHz: 240, spread: 0.25, rate: 11 },
    call: { wave: 'square', fromHz: 430, toHz: 380, seconds: 0.11, lowpassHz: 1400, repeats: 3 },
    lines: {
      greeting: ['Hmph. About time.', "Don't touch the spines."],
      scold: ['OW. Spines, remember?', "I've had smoother rides in a wheelbarrow."],
      thanks: ['Fine. Thanks. Whatever.', 'Hmph. Not bad.'],
      grudging: ['Hmph.', 'Never doing that again.'],
      bolt: ['Ow ow ow hot hot hot.', 'Moving. Do not make me do this twice.'],
    },
  },
  {
    id: 'ollie',
    name: 'Ollie',
    species: 'owl',
    value: 4,
    fussiness: 0.55,
    look: { coat: 0x8f8478, accent: 0xf2ede4, scale: 1.0, ears: 'tufted', tail: 'none' },
    voice: { wave: 'sine', baseHz: 300, spread: 0.15, rate: 8 },
    call: { wave: 'sine', fromHz: 480, toHz: 400, seconds: 0.4, lowpassHz: 900, repeats: 2 },
    lines: {
      greeting: ['Ah, aviation. I have notes.', 'Ollie, ornithologist. Watch your rate of descent.'],
      scold: ['Your bank angle is excessive. I would know.', 'Hoo. That landing lacked finesse.'],
      thanks: ['Competent. I shall write a review.', 'Four stars. The approach was textbook.'],
      grudging: ['Two stars. Notes to follow.', 'I have flown better. I have wings.'],
      bolt: ['Relocating. Your response time is noted.', 'The fire beat you here. I have moved. Try again.'],
    },
  },
]

/** The boss on the radio. Cares about the animals, and about the paint. */
export const CHIEF: SpeakerProfile & {
  lines: {
    welcome: string[]
    hardLanding: string[]
    bump: string[]
    treetops: string[]
    scorched: string[]
    grounded: string[]
    repaired: string[]
    fireClosing: string[]
    shiftOver: string[]
  }
} = {
  name: 'Chief',
  voice: { wave: 'square', baseHz: 190, spread: 0.18, rate: 10 },
  lines: {
    welcome: ['Chief here. New paint on that bird. NEW. PAINT.', "Bring 'em home, and bring my helicopter home prettier than you found it."],
    hardLanding: ["THAT'S MY PAINT JOB!", 'Do you know what a skid costs? I do.', 'Landing, not crashing. Say it with me.'],
    bump: ['Was that a scratch? That sounded like a scratch.', 'The sky is very large. Try staying in it.'],
    treetops: [
      'Those are TREES. We fly ABOVE the trees.',
      'I can hear the branches from here. Climb!',
      'Pine sap. On my paint. Marvellous.',
    ],
    scorched: [
      'THE FIRE. NOT INTO THE FIRE. Over it or around it!',
      'That is my clear coat blistering. GET OUT OF THERE.',
      'Paint burns, pilot. Paint BURNS.',
    ],
    grounded: [
      "That's it — I'm flying her home myself. Hands off.",
      'Autopilot engaged. Sit there and think about what you have done.',
      "She's a cinder. Bringing her in. Do not touch anything.",
    ],
    repaired: [
      'Buffed out. Barely. Try to keep her shiny this time.',
      'New paint. Again. Go on, the animals are waiting.',
      "Good as new. I said NEW. Don't make me say it a third time.",
    ],
    fireClosing: [
      "The fire's nearly on {name}. That one first. Go!",
      '{name} has got flames on the doorstep. Move, pilot!',
      "Smoke over {name}'s spot. If you want the points, hurry.",
    ],
    shiftOver: [
      "That's the shift. {count} brought home. Not bad. Not great. Paint's okay.",
      'Shift over. {count} rescued. Go and get some sleep, I will wax the bird.',
    ],
  },
}

/**
 * The copilot: Bram, a hyper-intelligent ferret, who consults his own AI
 * assistant about everything and reports its findings with total confidence.
 * He works the winch and the water. A second player can take the seat, at
 * which point Bram becomes, to his considerable satisfaction, purely advisory.
 */
export const FERRET: SpeakerProfile & {
  lines: {
    welcome: string[]
    spotted: string[]
    winchReady: string[]
    winchHooked: string[]
    watered: string[]
    dry: string[]
    treetops: string[]
    inTheFire: string[]
    updraft: string[]
    takeover: string[]
    handback: string[]
    idle: string[]
  }
} = {
  name: 'Bram',
  voice: { wave: 'triangle', baseHz: 620, spread: 0.4, rate: 17 },
  lines: {
    welcome: [
      'Bram aboard. My assistant has read the manual. Both of us have opinions.',
      'Copilot Bram, ferret, seat belt fastened around all of me. Ready.',
      'My assistant calculates our odds at 94%. It would not show its working.',
    ],
    spotted: [
      'Assistant has {name}. Bearing: that way. It is very confident about that way.',
      'Got {name} on the scanner. Also three squirrels it insists are irrelevant.',
      '{name}, dead ahead-ish. My assistant says "ish" is within tolerance.',
    ],
    winchReady: [
      'Line is going down! Hold her steady, I am doing science.',
      'Winch away. Assistant recommends not moving. Assistant is a coward.',
      'Paying out! If you tilt I will be very brave and very loud.',
    ],
    winchHooked: [
      'HOOKED! Winding in! I am extremely good at this!',
      'Got them! Assistant is updating my personal best. It is a small file.',
      'Up they come! Tell the Chief the winch works. Tell him I said so.',
    ],
    watered: [
      'Water away! Take that, combustion!',
      'Dropped! Assistant logs that as "mildly heroic".',
      'Splash! The fire hates that. I asked it.',
    ],
    dry: [
      'Tank is dry! Base has more water. Base has all the water.',
      'Nothing left but ferret. Back to base if you want another drop.',
    ],
    treetops: [
      'Branches! BRANCHES! My assistant is screaming in binary!',
      'We are mowing the forest. Assistant rates this approach: no.',
    ],
    inTheFire: [
      'HOT HOT HOT! Assistant says the word is "ablaze"!',
      'We are IN it! My whiskers have opinions and they are all bad!',
    ],
    updraft: [
      'Thermal! Hold on, the fire is throwing us a party!',
      'Rising air! Assistant calls this "free altitude". Assistant is an optimist.',
    ],
    takeover: [
      'Player two has the winch! Bram is now purely advisory. Bram is THRILLED.',
      'Second pair of hands! I shall supervise. And narrate. Mostly narrate.',
    ],
    handback: [
      'Back on the winch. Do not worry, I have been practising in my head.',
      'I have the line again. Assistant, resume the encouraging noises.',
    ],
    idle: [
      'Assistant has written a poem about the smoke. It is not good.',
      'Did you know a ferret can fit through anything its skull fits through? Useful.',
      'Assistant is recalculating. It does that when it is nervous.',
      'I have named that hill. I shall not be telling you what.',
    ],
  },
}

/** How much rough flying it takes before the Chief comments on his paint. */
export const CHIEF_FUSSINESS = 0.35
