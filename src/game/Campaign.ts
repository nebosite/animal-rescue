import { ROSTER, type AnimalProfile } from './AnimalProfile'

/** How a level ended up. */
export type LevelOutcome = 'next' | 'over'

/**
 * The run as a whole: which level, who is in the party, how fast the fire is.
 *
 * Level one is a single animal. Each level you bring everyone home who you
 * saved last time, plus one new face; anyone the fire took is gone. A level
 * with nobody saved ends the run. Pure bookkeeping — `Rescue` does the
 * rescuing and the fire does the burning; this only decides what comes next.
 */
export class Campaign {
  level = 1
  party: AnimalProfile[]

  /** How many roster animals have been introduced, saved or not. */
  private introduced = 1

  constructor(private readonly roster: readonly AnimalProfile[] = ROSTER) {
    this.party = [roster[0]]
  }

  /** How fast the fire runs, as a multiple of the first level's. */
  get firePace(): number {
    return 1 + (this.level - 1) * PACE_PER_LEVEL
  }

  /**
   * Close the level out. With at least one animal saved, the party for the
   * next is those animals plus the next new one (until the roster runs out).
   */
  finishLevel(saved: readonly AnimalProfile[]): LevelOutcome {
    if (saved.length === 0) return 'over'
    this.level += 1
    this.party = [...saved]
    if (this.introduced < this.roster.length) this.party.push(this.roster[this.introduced++])
    return 'next'
  }

  /** Back to level one, one animal. */
  restart(): void {
    this.level = 1
    this.introduced = 1
    this.party = [this.roster[0]]
  }
}

/** The fire is a little faster each level: 8% of level one's pace. */
const PACE_PER_LEVEL = 0.08
