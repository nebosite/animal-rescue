export type UpgradeId = 'slot' | 'motor' | 'fireproof' | 'tank'

export interface UpgradeInfo {
  id: UpgradeId
  title: string
  /** What the next level of it does, in the shop. */
  blurb: string
}

/**
 * What the pilot can buy between levels, and what they have bought.
 *
 * Paid for out of the score — the balance is the score less what has been
 * spent, so the score itself never goes down and a high score stays a high
 * score. Each upgrade has a few levels and each costs more than the last.
 *
 * Pure: it holds the levels and turns them into numbers; the helicopter, the
 * heat gauge, the tank and the rescue each read the number that is theirs.
 */
export class Upgrades {
  readonly levels: Record<UpgradeId, number> = { slot: 0, motor: 0, fireproof: 0, tank: 0 }
  spent = 0

  /** Ordered as the shop lists them. */
  readonly catalogue: readonly UpgradeInfo[] = CATALOGUE

  /** Points the next level of this costs, or null if it is already at the top. */
  price(id: UpgradeId): number | null {
    const owned = this.levels[id]
    return owned >= MAX_LEVEL ? null : BASE_PRICE * (owned + 1)
  }

  canBuy(id: UpgradeId, score: number): boolean {
    const price = this.price(id)
    return price !== null && score - this.spent >= price
  }

  /** Buy it if the score covers it. Returns whether it was bought. */
  buy(id: UpgradeId, score: number): boolean {
    if (!this.canBuy(id, score)) return false
    this.spent += this.price(id)!
    this.levels[id] += 1
    return true
  }

  /** What is left to spend. */
  balance(score: number): number {
    return score - this.spent
  }

  /** Animals that can be aboard at once. */
  get animalSlots(): number {
    return 1 + this.levels.slot
  }

  /** Multiplier on thrust and climb. */
  get enginePower(): number {
    return 1 + ENGINE_PER_LEVEL * this.levels.motor
  }

  /** Multiplier on how fast flame heats the machine: lower is tougher. */
  get heatRise(): number {
    return 1 - FIREPROOF_PER_LEVEL * this.levels.fireproof
  }

  /** Full loads the belly tank holds. */
  tankLoads(base: number): number {
    return base + TANK_LOADS_PER_LEVEL * this.levels.tank
  }

  /** Back to a stock helicopter, for a new game. */
  reset(): void {
    for (const id of Object.keys(this.levels) as UpgradeId[]) this.levels[id] = 0
    this.spent = 0
  }
}

const CATALOGUE: readonly UpgradeInfo[] = [
  { id: 'slot', title: 'Extra animal slot', blurb: 'carry one more animal at a time' },
  { id: 'motor', title: 'More powerful motor', blurb: '+15% thrust and climb' },
  { id: 'fireproof', title: 'Fire resistance', blurb: 'flame heats the machine 25% slower' },
  { id: 'tank', title: 'Extra water capacity', blurb: '+2 loads in the belly tank' },
]

export const MAX_LEVEL = 3
const BASE_PRICE = 200
const ENGINE_PER_LEVEL = 0.15
const FIREPROOF_PER_LEVEL = 0.25
const TANK_LOADS_PER_LEVEL = 2
