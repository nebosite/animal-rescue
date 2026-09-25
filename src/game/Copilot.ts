/** Everything the copilot can see from his seat. */
export interface CopilotView {
  /** True when a second player is working the winch and the water. */
  takenOver: boolean
  carrying: boolean
  /** Close enough horizontally that the hook could reach the animal. */
  overAnimal: boolean
  /** How far above the animal's ground the helicopter is. */
  heightAboveAnimal: number
  speed: number
  hasWater: boolean
  /** Fire close enough to an animal to be worth a drop, and we are over it. */
  overThreateningFire: boolean
}

/** What the copilot does with his two controls this frame. */
export interface CopilotOrders {
  lowerWinch: boolean
  dropWater: boolean
}

/**
 * Bram, the copilot. He works the winch and the belly tank so the pilot never
 * has to take a hand off the controls — and hands both over the moment a
 * second player turns up.
 *
 * Only the decisions live here; what he *says* about them is in his profile.
 * Pure, so every judgement can be tested without a helicopter.
 */
export class Copilot {
  /** True while a second player has the seat. */
  takenOver = false

  /**
   * What he would do, flying himself. With a second player aboard he does
   * nothing at all — two people grabbing the same winch is not a co-op game,
   * it is an argument.
   */
  orders(view: CopilotView): CopilotOrders {
    if (view.takenOver) return { lowerWinch: false, dropWater: false }

    return {
      // Put the line down when there is someone to pick up, the helicopter is
      // low enough for the hook to reach and steady enough to hold it there.
      lowerWinch:
        !view.carrying &&
        view.overAnimal &&
        view.heightAboveAnimal <= WINCH_FROM &&
        view.speed <= STEADY_ENOUGH,
      // Spend water on fire that is actually threatening someone.
      dropWater: view.hasWater && view.overThreateningFire,
    }
  }
}

/** He will not pay out the line from higher than this. */
export const WINCH_FROM = 30
/** Nor while the helicopter is moving faster than this. */
export const STEADY_ENOUGH = 7
