/** One published version, described for players rather than programmers. */
export interface Release {
  version: string
  date: string
  notes: readonly string[]
}

/**
 * Every published version, newest first. The top entry is the version the game
 * shows in its corner, and a test holds it equal to the one in package.json.
 *
 * Add an entry and bump package.json on every publish — the label is how a
 * player (and the owner) can tell which build they are looking at.
 */
export const CHANGELOG: readonly Release[] = [
  {
    version: '0.5.0',
    date: '2026-10-15',
    notes: [
      'Levels: the first has just one animal; each level brings back everyone you saved plus one new face.',
      'The fire gets faster every level, and it gets later in the day — down to night, lit by the fire.',
      'An animal the fire reaches runs off for good. If every animal is lost, the game is over.',
      'Points per animal grow: 100 for the first, 200 for the second, and so on.',
      'A roster in the corner shows who is waiting, aboard, saved or lost.',
      'Soft landings with an animal aboard pay well, and the animal says something nice (or not).',
      'Water cools the helicopter: a temperature gauge, and a spray that lets you sit in the fire until the tank runs dry.',
      'Trees and rocks cast shadows.',
      'Upgrade shop after a clean level: extra animal slot, stronger motor, fire resistance, bigger water tank.',
      'Fixed sound sometimes not starting until you muted and unmuted.',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-10-13',
    notes: [
      'Radio calls sound like walkie-talkies, with a squelch and static.',
      'The controller sticks were swapped to feel better.',
      'Splinters fly when you clip the trees.',
      'Anonymous play counts were added.',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-10-08',
    notes: [
      'A copilot, Bram, works the winch and the water, and a second player can take his seat.',
      'The fire is a front that sweeps across the map and leaves burnt ground behind it.',
      'Hot air over the fire throws the helicopter about, and the fire itself is drawn as sparks.',
      'Fire wears the helicopter out: the more damage, the worse it flies.',
      'The helicopter is faster, and the voices are lower and in English only.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-09-19',
    notes: [
      'A big world of hills, a canyon and a forest of tall firs.',
      'Three named animals with their own voices and tempers, and the Chief on the radio fussing over his paint.',
      'A forest fire spreads toward the animals; you choose who to save first.',
      'Playable in the browser at a shared web address.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-09-10',
    notes: [
      'A helicopter you can fly with a keyboard or a controller.',
      'An animal to pick up and a pad to bring it to.',
      'Rotor, wind and animal-call sounds, made on the fly.',
    ],
  },
]

export const VERSION = CHANGELOG[0].version
