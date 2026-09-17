/** Everything the guidance needs to know about right now. */
export interface Situation {
  /** The animal aboard, or the one the player should go for next. */
  animalName: string
  species: string
  /** Where that animal is waiting — "a hilltop". Unused while carrying. */
  siteLabel: string
  carrying: boolean
  needsRepair: boolean
  onGround: boolean
  /** Close enough to the target to land and have it count, whatever the altitude. */
  overTarget: boolean
  /** Horizontal distance to the target, in metres. */
  range: number
  /** How far above the target's ground the helicopter is. */
  heightAboveTarget: number
  /** How fast it is moving over the ground. */
  speed: number
  /** How many other animals are out there besides the target. */
  othersWaiting: number
  /** An animal the fire is about to reach, if any. */
  fireClosingOn: string | null
  shiftOver: boolean
  /** Seconds left on the shift, when it is nearly over; otherwise null. */
  closingSeconds: number | null
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
 * The map is 840 metres across and the animals are small things in a big
 * forest — without being told, a new player flies around and finds nothing.
 * This is the game explaining itself, one step at a time, and now also
 * pointing out who needs fetching first when the fire is closing in.
 *
 * Pure: it reads a situation and returns text, so every branch is testable
 * with no browser and no renderer.
 */
export function guidanceFor(situation: Situation): Guidance {
  const { animalName, species, siteLabel, carrying, range, othersWaiting } = situation

  if (situation.shiftOver) {
    return { task: 'Shift over', hint: 'Press R to fly another one.', target: 'base', landing: false }
  }

  if (situation.needsRepair) {
    return {
      task: 'The Chief has taken the controls',
      hint: 'Too much damage — sit tight while he flies you back for repairs.',
      target: 'base',
      landing: false,
    }
  }

  const target = carrying ? 'base' : 'pickup'
  const more = othersWaiting > 0 ? ` (+${othersWaiting} more waiting)` : ''
  const task = carrying
    ? `Fly ${animalName} to the Rescue Base${more}`
    : `Find ${animalName} the ${species} on ${siteLabel}${more}`

  return { task, hint: prefix(situation) + approachHint(situation, target), target, landing: range <= APPROACH_RANGE }
}

/** Anything urgent goes in front of the ordinary hint. */
function prefix(situation: Situation): string {
  const parts: string[] = []
  if (situation.closingSeconds !== null) parts.push(`${Math.ceil(situation.closingSeconds)} seconds left`)
  if (situation.fireClosingOn && !situation.carrying) {
    parts.push(situation.fireClosingOn === situation.animalName
      ? `The fire is closing on ${situation.animalName}`
      : `The fire is closing on ${situation.fireClosingOn}`)
  }
  return parts.length ? parts.join(' — ') + ' — ' : ''
}

/** The right nudge for how far away, how high and how fast you are. */
function approachHint(situation: Situation, target: 'pickup' | 'base'): string {
  const { animalName, carrying, overTarget, onGround, range, heightAboveTarget, speed } = situation
  const beacon = target === 'pickup' ? 'amber' : 'blue'
  const spot = target === 'pickup' ? animalName : 'the pad'

  if (onGround && !overTarget) {
    return 'hold A to lift off, then follow the beacon.'
  }

  if (range > APPROACH_RANGE) {
    const far = range > 250 ? 'climb above the trees and ' : ''
    return `${far}follow the ${beacon} beacon — ${Math.round(range)} m to go.`
  }

  if (!overTarget) {
    return speed > BRISK
      ? 'almost there — ease off and let it slow down.'
      : `line up over ${spot}, then descend.`
  }

  if (heightAboveTarget > LANDING_HEIGHT) {
    return `you are over ${spot} — hold Z to come down (${Math.round(heightAboveTarget)} m up).`
  }

  return carrying
    ? `touch down gently to hand ${animalName} over.`
    : `touch down gently to pick ${animalName} up.`
}

/** Within this the pilot should be flying the approach, not travelling. */
const APPROACH_RANGE = 120
/** Above this the pilot still has real descending to do. */
const LANDING_HEIGHT = 6
/** Fast enough that arriving at it would overshoot. */
const BRISK = 12
