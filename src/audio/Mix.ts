/** Decibels to a linear gain factor: −6 dB is about half, −20 dB a tenth. */
export function decibels(db: number): number {
  return 10 ** (db / 20)
}

/**
 * How far each bed is pulled down from its natural level, in dB. One place, so
 * retuning the balance is changing a number rather than hunting for constants.
 *
 * Speech is read aloud outside the audio graph, so no meter can see it and the
 * only way to make characters easier to hear is to make everything else
 * quieter. The fire and the rotor were drowning the radio.
 *
 * Wind follows the rotor: it was tuned to sit under it, and cutting the rotor
 * alone would leave the weather louder than the machine.
 */
export const TRIM = {
  fire: -15,
  rotor: -5,
  wind: -5,
}
