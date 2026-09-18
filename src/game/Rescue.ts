import { ROSTER, type AnimalProfile } from './AnimalProfile'
import type { Fire } from './Fire'
import type { LandingPad } from './LandingPad'
import type { Site, SiteFinder, SiteKind } from './SiteFinder'

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
  /** The last animal the fire chased off, for the radio. */
  lastBolted: Waiting | null = null

  private nextInRoster = 0
  private seed = 0
  private carriedSeconds = 0
  private carriedFrom: Site | null = null

  constructor(
    private readonly rescuePad: LandingPad,
    private readonly sites: SiteFinder,
    private readonly fire: Fire,
    private readonly roster: readonly AnimalProfile[] = ROSTER,
    private readonly slots = SLOTS,
  ) {
    this.restock()
  }

  /** The animal aboard, or the one the player should go for next. */
  get animal(): AnimalProfile {
    return this.carrying?.animal ?? this.waiting[0]?.animal ?? this.roster[0]
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
   * Time passes. Animals the fire has reached run for it — never hurt, just
   * somewhere else now, and a little less patient. Returns whoever bolted.
   */
  advance(dt: number): Waiting | null {
    this.lastBolted = null
    if (this.carrying) this.carriedSeconds += dt

    for (const w of this.waiting) {
      w.waitedSeconds += dt
      if (this.fire.intensityAt(w.site.x, w.site.z) < BOLT_AT) continue

      const refuge = this.sites.fleeFrom(w.site, this.fire, this.seed++, this.othersThan(w))
      if (!refuge) continue
      w.site = refuge
      w.credit = Math.max(1, w.credit - 1)
      this.lastBolted = w
      return w
    }
    return null
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
    this.waiting.splice(this.waiting.indexOf(nearby), 1)
    this.carrying = nearby
    this.carriedSeconds = 0
    this.carriedFrom = nearby.site
    return 'picked-up'
  }

  /** Rough handling while aboard costs a point of credit — but never the last one. */
  scold(): void {
    if (this.carrying && this.carrying.credit > 1) this.carrying.credit -= 1
  }

  /** Keep the map stocked with animals to find. */
  restock(): void {
    while (this.waiting.length < this.slots) {
      const kind = KINDS[this.nextInRoster % KINDS.length]
      const avoid = this.waiting.map((w) => w.site)
      const site = this.sites.find(kind, this.fire, this.seed++, avoid) ?? this.sites.find('clearing', this.fire, this.seed++, avoid)
      if (!site) return
      const animal = this.roster[this.nextInRoster % this.roster.length]
      this.nextInRoster += 1
      const credit = animal.value + site.difficulty - 1
      this.waiting.push({ animal, site, credit, initialCredit: credit, waitedSeconds: 0 })
    }
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
    if (impactSpeed < GENTLE_TOUCHDOWN) {
      credited += GENTLE_BONUS
      bonuses.push(`gentle +${GENTLE_BONUS}`)
    }

    this.lastDelivery = { animal: aboard.animal, site: from, credited, bonuses, scolded: aboard.credit < aboard.initialCredit }
    this.score += credited
    this.rescued += 1
    this.carrying = null
    this.carriedFrom = null
    this.restock()
    return 'delivered'
  }

  private othersThan(w: Waiting): Site[] {
    return this.waiting.filter((other) => other !== w).map((other) => other.site)
  }
}

/** How many animals are out there at once. */
const SLOTS = 3
/** Land within this of the animal to take it aboard. */
export const PICKUP_RADIUS = 13
/** Fire this intense at an animal's feet sends it running. */
const BOLT_AT = 0.25
/** Within this of the fire an animal counts as threatened. */
const WORRYING_RANGE = 70
const KINDS: readonly SiteKind[] = ['clearing', 'hilltop', 'fireline', 'canyon', 'ridge']
/** A brisk direct flight, a little under the helicopter's top speed. */
const PAR_SPEED = 30
const PAR_SLACK = 10
const QUICK_BONUS = 2
const GENTLE_BONUS = 1
const GENTLE_TOUCHDOWN = 3.5
