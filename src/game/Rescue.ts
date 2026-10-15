import { ROSTER, type AnimalProfile } from './AnimalProfile'
import type { Fire } from './Fire'
import type { LandingPad } from './LandingPad'
import type { Site, SiteFinder } from './SiteFinder'

/** An animal out in the landscape, waiting to be found. */
export interface Waiting {
  animal: AnimalProfile
  site: Site
  /** Points it will credit on delivery: value plus site difficulty, less scoldings. */
  credit: number
  /** What the credit was before any scolding, to tell a rough trip from a smooth one. */
  initialCredit: number
  /** How long it has been out there. */
  waitedSeconds: number
}

/** What just happened, when landing changed the state of the rescue. */
export type RescueEvent = 'picked-up' | 'delivered'

/** The record of a delivery, for the thank-you and the score flash. */
export interface Delivery {
  animal: AnimalProfile
  site: Site
  credited: number
  /** Extra points and why, e.g. "quick +2". */
  bonuses: string[]
  /** True if the animal was scolded on the way — it will not be gracious. */
  scolded: boolean
  /** True if the touchdown at base was soft enough to earn the gentle bonus. */
  gentle: boolean
}

/**
 * The rescue loop, now with choices in it. Several animals wait at different
 * places in the landscape at once; the fire creeps toward them and any it
 * reaches bolts to a new spot; the player picks who to fetch first, flies
 * there, lands close enough, and brings them home for their value plus a
 * little for the difficulty of where they were — and more again for being
 * quick and gentle about it.
 *
 * Knows nothing about meshes or input. It is told where the helicopter landed
 * and how hard, and decides whether anything happened, so the same call every
 * frame while parked is harmless.
 */
export class Rescue {
  score = 0
  rescued = 0
  readonly waiting: Waiting[] = []
  carrying: Waiting | null = null
  lastDelivery: Delivery | null = null
  /** The last animal the fire ran off, for the radio. */
  lastLost: Waiting | null = null
  /** Everyone the fire has taken from this level — gone for good. */
  readonly lost: Waiting[] = []
  /** Everyone delivered this level; they are the party for the next. */
  readonly saved: AnimalProfile[] = []

  private seed = 0
  private carriedSeconds = 0
  private carriedFrom: Site | null = null
  private carriedByWinch = false

  constructor(
    private readonly rescuePad: LandingPad,
    private readonly sites: SiteFinder,
    private readonly fire: Fire,
    party: readonly AnimalProfile[] = ROSTER.slice(0, 1),
    private readonly roster: readonly AnimalProfile[] = ROSTER,
  ) {
    this.stock(party)
  }

  /** The animal aboard, or the one the player should go for next. */
  get animal(): AnimalProfile {
    return this.carrying?.animal ?? this.waiting[0]?.animal ?? this.saved[0] ?? this.roster[0]
  }

  /** Points the aboard animal will credit if delivered now. */
  get credit(): number {
    return this.carrying?.credit ?? 0
  }

  /** How close the fire is to a waiting animal. */
  threatTo(waiting: Waiting): number {
    return this.fire.distanceToNearest(waiting.site.x, waiting.site.z)
  }

  /** The animal the fire is closest to, if any is within worrying range. */
  mostThreatened(): Waiting | null {
    let worst: Waiting | null = null
    for (const w of this.waiting) {
      if (this.threatTo(w) > WORRYING_RANGE) continue
      if (!worst || this.threatTo(w) < this.threatTo(worst)) worst = w
    }
    return worst
  }

  /** Who to fly to: the one the fire is about to reach, else the nearest. */
  recommended(from: { x: number; z: number }): Waiting | null {
    const threatened = this.mostThreatened()
    if (threatened) return threatened
    let nearest: Waiting | null = null
    let best = Infinity
    for (const w of this.waiting) {
      const distance = Math.hypot(w.site.x - from.x, w.site.z - from.z)
      if (distance < best) { best = distance; nearest = w }
    }
    return nearest
  }

  /**
   * Time passes. An animal the fire reaches runs for the hills and is gone —
   * never hurt, but out of reach, and not coming back. Returns whoever left.
   */
  advance(dt: number): Waiting | null {
    this.lastLost = null
    if (this.carrying) this.carriedSeconds += dt

    for (const w of this.waiting) {
      w.waitedSeconds += dt
      if (this.fire.intensityAt(w.site.x, w.site.z) < BOLT_AT) continue

      this.waiting.splice(this.waiting.indexOf(w), 1)
      this.lost.push(w)
      this.lastLost = w
      return w
    }
    return null
  }

  /** Nobody left to fetch or carry: every animal this level is home or gone. */
  get levelOver(): boolean {
    return this.waiting.length === 0 && this.carrying === null
  }

  /**
   * Report a landing: where, and how hard. Landing near a waiting animal takes
   * it aboard; landing on the base with one aboard delivers it.
   */
  landedOn(pad: LandingPad | null, position: { x: number; y: number; z: number }, onGround: boolean, impactSpeed = 0): RescueEvent | null {
    if (!onGround) return null

    if (this.carrying) {
      if (pad !== this.rescuePad) return null
      return this.deliver(impactSpeed)
    }

    const nearby = this.waiting.find((w) => Math.hypot(w.site.x - position.x, w.site.z - position.z) <= PICKUP_RADIUS)
    if (!nearby) return null
    this.take(nearby, false)
    return 'picked-up'
  }

  /**
   * Take an animal aboard on the winch, without ever touching down. Harder
   * than landing — the helicopter has to hold a low, steady hover while
   * someone else works the line — so it pays.
   */
  winchUp(position: { x: number; z: number }, hookHeight: number, speed: number): RescueEvent | null {
    if (this.carrying) return null
    if (speed > WINCH_STEADY) return null

    const below = this.waiting.find((w) =>
      Math.hypot(w.site.x - position.x, w.site.z - position.z) <= WINCH_REACH &&
      hookHeight - w.site.y <= HOOK_GRAB &&
      hookHeight - w.site.y >= -HOOK_SLACK,
    )
    if (!below) return null
    this.take(below, true)
    return 'picked-up'
  }

  private take(waiting: Waiting, byWinch: boolean): void {
    this.waiting.splice(this.waiting.indexOf(waiting), 1)
    this.carrying = waiting
    this.carriedSeconds = 0
    this.carriedFrom = waiting.site
    this.carriedByWinch = byWinch
  }

  /**
   * Another level, with this party. The score carries on; nothing else does.
   * The fire has to be relit before this is called, or the animals are placed
   * around a front that has already crossed the map.
   */
  startLevel(party: readonly AnimalProfile[]): void {
    this.waiting.length = 0
    this.lost.length = 0
    this.saved.length = 0
    this.carrying = null
    this.lastDelivery = null
    this.lastLost = null
    this.seed = 0
    this.carriedSeconds = 0
    this.carriedFrom = null
    this.carriedByWinch = false
    this.stock(party)
  }

  /** A whole new game: no points, no history. */
  reset(party: readonly AnimalProfile[]): void {
    this.score = 0
    this.rescued = 0
    this.startLevel(party)
  }

  /** Rough handling while aboard costs a little credit — but never the animal's base value. */
  scold(): void {
    if (!this.carrying) return
    this.carrying.credit = Math.max(this.rankOf(this.carrying.animal) * POINTS_PER_RANK, this.carrying.credit - SCOLD_COST)
  }

  /**
   * Put each party member out in the landscape, in the fire's path — that is
   * the premise: they are running from the front and you are the only way out.
   * They are spread across bands of distance from the flames, the first of
   * them far enough out to leave a new pilot time to learn the machine.
   */
  private stock(party: readonly AnimalProfile[]): void {
    party.forEach((animal, i) => {
      const aheadBy = BANDS[i % BANDS.length]
      const avoid = this.waiting.map((w) => w.site)
      const site = this.sites.findAhead(this.fire, aheadBy, this.seed++, avoid)
        ?? this.sites.find('clearing', this.fire, this.seed++, avoid)
      if (!site) return
      const credit = this.rankOf(animal) * POINTS_PER_RANK + (site.difficulty - 1) * POINTS_PER_DIFFICULTY
      this.waiting.push({ animal, site, credit, initialCredit: credit, waitedSeconds: 0 })
    })
  }

  /** 1 for the first animal ever met, 2 for the second, and so on. */
  private rankOf(animal: AnimalProfile): number {
    return Math.max(0, this.roster.indexOf(animal)) + 1
  }

  private deliver(impactSpeed: number): RescueEvent {
    const aboard = this.carrying!
    const bonuses: string[] = []
    let credited = aboard.credit

    // Par is a brisk direct flight; beating it is worth something.
    const from = this.carriedFrom ?? aboard.site
    const distance = Math.hypot(from.x - this.rescuePad.position.x, from.z - this.rescuePad.position.z)
    if (this.carriedSeconds <= distance / PAR_SPEED + PAR_SLACK) {
      credited += QUICK_BONUS
      bonuses.push(`quick +${QUICK_BONUS}`)
    }
    const gentle = impactSpeed < GENTLE_TOUCHDOWN
    if (gentle) {
      credited += GENTLE_BONUS
      bonuses.push(`gentle +${GENTLE_BONUS}`)
    }
    if (this.carriedByWinch) {
      credited += WINCH_BONUS
      bonuses.push(`winched +${WINCH_BONUS}`)
    }

    this.lastDelivery = { animal: aboard.animal, site: from, credited, bonuses, scolded: aboard.credit < aboard.initialCredit, gentle }
    this.score += credited
    this.rescued += 1
    this.saved.push(aboard.animal)
    this.carrying = null
    this.carriedFrom = null
    this.carriedByWinch = false
    return 'delivered'
  }

}

/** Each animal is worth its place in the roster times this: 100, 200, 300... */
const POINTS_PER_RANK = 100
/** Scores are in hundreds now, so the old one-point extras are tens. */
const POINTS_PER_DIFFICULTY = 10
const SCOLD_COST = 10
/** Land within this of the animal to take it aboard. */
export const PICKUP_RADIUS = 13
/** Fire this intense at an animal's feet sends it running. */
const BOLT_AT = 0.25
/** Within this of the fire an animal counts as threatened. */
const WORRYING_RANGE = 70
/**
 * How far ahead of the flames each animal waits, in the order they are placed.
 * The first is well out, so level one is a lesson and not a panic; the second
 * is inside WORRYING_RANGE on purpose, so from level two somebody is always the
 * one the Chief is shouting about.
 */
const BANDS: readonly number[] = [150, 55, 300]
/**
 * A brisk direct flight, a little under the helicopter's top speed (about 69).
 * It was 30 when the top speed was 46, and moves with it: left alone, beating
 * par would stop being worth anything.
 */
const PAR_SPEED = 45
const PAR_SLACK = 10
const QUICK_BONUS = 20
/** A feather-soft touchdown with a passenger aboard is the best thing a pilot can do for them. */
const GENTLE_BONUS = 50
const GENTLE_TOUCHDOWN = 3.5
/** Winching is the hard way up, and pays like it. */
const WINCH_BONUS = 30
/** How far off the animal the hook can be and still catch it. */
export const WINCH_REACH = 11
/** And how far above or below its feet. */
const HOOK_GRAB = 4
const HOOK_SLACK = 7
/** The hover has to be this steady for the line to catch. */
const WINCH_STEADY = 7
