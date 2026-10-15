import type { AnimalProfile } from './AnimalProfile'
import type { Campaign } from './Campaign'
import type { Rescue } from './Rescue'

/** Where an animal stands this run. */
export type RosterStatus = 'unmet' | 'waiting' | 'aboard' | 'saved' | 'lost'

export interface RosterEntry {
  animal: AnimalProfile
  status: RosterStatus
}

/**
 * Who is where, for the HUD: every animal in the roster with what has become
 * of them. Read from the rescue and the campaign, owns nothing.
 *
 * Someone lost on an earlier level stays lost; someone saved earlier is
 * waiting again on this level (they come back with the party) until they are
 * brought home once more.
 */
export function rosterBoard(roster: readonly AnimalProfile[], rescue: Rescue, campaign: Campaign): RosterEntry[] {
  return roster.map((animal) => ({ animal, status: statusOf(animal, rescue, campaign) }))
}

function statusOf(animal: AnimalProfile, rescue: Rescue, campaign: Campaign): RosterStatus {
  if (rescue.aboard.some((w) => w.animal === animal)) return 'aboard'
  if (rescue.saved.includes(animal)) return 'saved'
  if (rescue.lost.some((w) => w.animal === animal) || campaign.gone.includes(animal)) return 'lost'
  if (rescue.waiting.some((w) => w.animal === animal)) return 'waiting'
  return 'unmet'
}
