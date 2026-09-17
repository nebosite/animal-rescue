/** Everything the guidance needs to know about right now. */
export interface Situation {
  animalName: string
  species: string
  carrying: boolean
  needsRepair: boolean
  onGround: boolean
  /** Inside the target pad's circle, whatever the altitude. */
  overTarget: boolean
  /** Horizontal distance to the target, in metres. */
  range: number
  /** How far above the target's deck the helicopter is. */
  heightAboveTarget: number
  /** How fast it is moving over the ground. */
  speed: number
}

/** One instruction: what to do, and how to do it. */
export interface Guidance {
  task: string
  hint: string
  /** Which beacon the player should be steering at. */
  target: 'pickup' | 'base'
  /** True when the pilot should be lining up to land rather than travelling. */
  landing: boolean
}

/**
 * What the player should be doing this instant, in words.
 *
 * The map is 840 metres across and the animal is a small thing in a big
 * forest — without being told, a new player flies around and finds nothing.
 * This is the game explaining itself, one step at a time.
 *
 * Pure: it reads a situation and returns text, so every branch is testable
 * with no browser and no renderer.
 */
export function guidanceFor(situation: Situation): Guidance {
  const { animalName, species, carrying, range } = situation

  if (situation.needsRepair) {
    return {
      task: 'The Chief has taken the controls',
      hint: 'Too much damage — sit tight while he flies you back for repairs.',
      target: 'base',
      landing: false,
    }
  }

  const target = carrying ? 'base' : 'pickup'
  const task = carrying
    ? `Fly ${animalName} to the Rescue Base`
    : `Find ${animalName} the ${species}`

  return { task, hint: approachHint(situation, target), target, landing: range <= APPROACH_RANGE }
}

/** The right nudge for how far away, how high and how fast you are. */
function approachHint(situation: Situation, target: 'pickup' | 'base'): string {
  const { carrying, overTarget, onGround, range, heightAboveTarget, speed } = situation
  const beacon = target === 'pickup' ? 'amber' : 'blue'

  if (onGround && !overTarget) {
    return 'Hold A to lift off, then follow the beacon.'
  }

  if (range > APPROACH_RANGE) {
    const far = range > 250 ? 'Climb above the trees and ' : ''
    return `${far}follow the ${beacon} beacon — ${Math.round(range)} m to go.`
  }

  if (!overTarget) {
    return speed > BRISK
      ? 'Almost there — ease off and let it slow down.'
      : `Line up over the ${beacon} pad, then descend.`
  }

  if (heightAboveTarget > LANDING_HEIGHT) {
    return `You are over the pad — hold Z to come down (${Math.round(heightAboveTarget)} m up).`
  }

  return carrying
    ? `Touch down gently to hand ${situation.animalName} over.`
    : `Touch down gently to pick ${situation.animalName} up.`
}

/** Within this the pilot should be flying the approach, not travelling. */
const APPROACH_RANGE = 120
/** Above this the pilot still has real descending to do. */
const LANDING_HEIGHT = 6
/** Fast enough that arriving at it would overshoot. */
const BRISK = 12
