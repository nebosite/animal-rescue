/** Everything the world needs to dress for an hour of the day. Colours are 0xRRGGBB. */
export interface Sky {
  /** Height of the sun (or moon) above the horizon, degrees. */
  elevation: number
  sunColor: number
  sunIntensity: number
  ambientColor: number
  ambientIntensity: number
  hemiSky: number
  hemiGround: number
  hemiIntensity: number
  /** The sky, and the fog that fades the land into it. */
  skyColor: number
  /** How much brighter the fire's own light is made, so it carries the scene as the day goes. */
  fireGlow: number
}

/**
 * Each level is later in the day than the last: bright noon, afternoon, golden
 * hour, dusk, and from the fifth level on, night with nothing to see by but the
 * fire. Between keyframes nothing is blended — a level is one hour, and the
 * change arrives with the level so the player notices it.
 *
 * Pure numbers: the world turns them into lights and colours.
 */
export function skyForLevel(level: number): Sky {
  const index = Math.min(KEYFRAMES.length, Math.max(1, Math.floor(level))) - 1
  return KEYFRAMES[index]
}

/** True from the level the sun has gone and only the fire is left. */
export function isNight(level: number): boolean {
  return level >= KEYFRAMES.length
}

const KEYFRAMES: readonly Sky[] = [
  // 1. Noon: the bright, clear day the game opened with.
  { elevation: 62, sunColor: 0xfff3d9, sunIntensity: 2.7, ambientColor: 0xe4f1ff, ambientIntensity: 1.5, hemiSky: 0xaee0ff, hemiGround: 0x86b85a, hemiIntensity: 0.8, skyColor: 0x8fd3ff, fireGlow: 1 },
  // 2. Afternoon.
  { elevation: 42, sunColor: 0xffe8c0, sunIntensity: 2.5, ambientColor: 0xe4eeff, ambientIntensity: 1.35, hemiSky: 0xa6d6f5, hemiGround: 0x7fb056, hemiIntensity: 0.75, skyColor: 0x9bd0ee, fireGlow: 1.2 },
  // 3. Golden hour.
  { elevation: 20, sunColor: 0xffc07a, sunIntensity: 2.2, ambientColor: 0xf0d8c8, ambientIntensity: 1.0, hemiSky: 0xe8b890, hemiGround: 0x6d6a45, hemiIntensity: 0.6, skyColor: 0xf0b685, fireGlow: 1.6 },
  // 4. Dusk: the sun is on the horizon and the fire starts to matter.
  { elevation: 5, sunColor: 0xff7a45, sunIntensity: 1.3, ambientColor: 0x8a7090, ambientIntensity: 0.6, hemiSky: 0x7a6a9a, hemiGround: 0x3a3a30, hemiIntensity: 0.4, skyColor: 0x54405f, fireGlow: 2.4 },
  // 5. Night: a faint moon, and the glow of the fire on everything.
  { elevation: 48, sunColor: 0x8ea8ff, sunIntensity: 0.3, ambientColor: 0x2a3560, ambientIntensity: 0.45, hemiSky: 0x2a3a6a, hemiGround: 0x101410, hemiIntensity: 0.3, skyColor: 0x0b1226, fireGlow: 4 },
]
