import { describe, expect, it } from 'vitest'
import { FIELD_LIMIT, Helicopter } from './Helicopter'
import { noInput, type FlightInput } from './FlightInput'

/** Fly with the given axes held for `seconds`, stepping at 60 Hz. */
function fly(helicopter: Helicopter, axes: Partial<FlightInput>, seconds: number): Helicopter {
  const input = { ...noInput(), ...axes }
  const steps = Math.round(seconds * 60)
  for (let i = 0; i < steps; i++) helicopter.update(input, 1 / 60)
  return helicopter
}

const fresh = () => new Helicopter()

describe('Helicopter flight model', () => {
  it('hovers in place with no input', () => {
    const start = fresh().position.clone()
    const helicopter = fly(fresh(), {}, 2)
    expect(helicopter.position.distanceTo(start)).toBeLessThan(1e-6)
    expect(helicopter.speed).toBeCloseTo(0)
  })

  it('flies forward along -Z when pitched forward from the initial heading', () => {
    const helicopter = fly(fresh(), { pitch: 1 }, 1)
    expect(helicopter.position.z).toBeLessThan(-5)
    expect(Math.abs(helicopter.position.x)).toBeLessThan(1e-6)
  })

  it('flies backward when pitched back', () => {
    expect(fly(fresh(), { pitch: -1 }, 1).position.z).toBeGreaterThan(5)
  })

  it('slides right and left with roll, without turning', () => {
    const right = fly(fresh(), { roll: 1 }, 1)
    expect(right.position.x).toBeGreaterThan(5)
    expect(right.heading).toBeCloseTo(0)
    expect(fly(fresh(), { roll: -1 }, 1).position.x).toBeLessThan(-5)
  })

  it('climbs and descends with collective', () => {
    const start = fresh().position.y
    expect(fly(fresh(), { collective: 1 }, 1).position.y).toBeGreaterThan(start + 3)
    expect(fly(fresh(), { collective: -1 }, 0.5).position.y).toBeLessThan(start)
  })

  it('leans before it moves: speed builds up rather than appearing instantly', () => {
    const early = fly(fresh(), { pitch: 1 }, 0.1).speed
    const later = fly(fresh(), { pitch: 1 }, 1.0).speed
    expect(early).toBeLessThan(later * 0.25)
  })

  it('keeps drifting after the stick is released, then slows down', () => {
    const helicopter = fly(fresh(), { pitch: 1 }, 1.5)
    const speedOnRelease = helicopter.speed
    const zOnRelease = helicopter.position.z

    fly(helicopter, {}, 0.5)
    expect(helicopter.position.z).toBeLessThan(zOnRelease)
    expect(helicopter.speed).toBeLessThan(speedOnRelease)
    expect(helicopter.speed).toBeGreaterThan(speedOnRelease * 0.3)

    fly(helicopter, {}, 6)
    expect(helicopter.speed).toBeLessThan(0.1)
  })

  it('reaches a top speed instead of accelerating forever', () => {
    // Kept short enough not to reach the field boundary, which would zero the speed.
    const helicopter = fly(fresh(), { pitch: 1 }, 3)
    const cruise = helicopter.speed
    fly(helicopter, { pitch: 1 }, 1)
    expect(helicopter.speed).toBeLessThan(cruise * 1.05)
    expect(cruise).toBeGreaterThan(38)
    expect(cruise).toBeLessThan(55)
  })

  it('yaw turns the nose right, and forward follows the nose', () => {
    const helicopter = fly(fresh(), { yaw: 1 }, 0.7)
    fly(helicopter, {}, 1) // let the yaw rate settle
    const heading = helicopter.heading
    expect(heading).toBeLessThan(-0.5) // a right turn is a negative rotation about +Y

    const before = helicopter.position.clone()
    fly(helicopter, { pitch: 1 }, 1)
    const moved = helicopter.position.clone().sub(before).setY(0).normalize()
    const nose = { x: -Math.sin(heading), z: -Math.cos(heading) }
    expect(moved.x * nose.x + moved.z * nose.z).toBeGreaterThan(0.98)
    expect(moved.x).toBeGreaterThan(0) // turned right from facing -Z means heading toward +X
  })

  it('does not fly faster diagonally than straight', () => {
    const straight = fly(fresh(), { pitch: 1 }, 3).speed
    const diagonal = fly(fresh(), { pitch: 1, roll: 1 }, 3).speed
    expect(diagonal).toBeLessThanOrEqual(straight * 1.001)
  })

  it('pitches nose-down when flying forward and levels out when released', () => {
    const helicopter = fly(fresh(), { pitch: 1 }, 1)
    expect(helicopter.pitch).toBeGreaterThan(0.3)
    fly(helicopter, {}, 1.5)
    expect(Math.abs(helicopter.pitch)).toBeLessThan(0.01)
  })

  it('banks into a turn even with no sideways input', () => {
    const helicopter = fly(fresh(), { yaw: 1 }, 1)
    expect(helicopter.roll).toBeGreaterThan(0.15)
  })

  it('cannot sink through the ground', () => {
    const helicopter = fly(fresh(), { collective: -1 }, 5)
    expect(helicopter.position.y).toBeGreaterThanOrEqual(2)
    expect(helicopter.isOnGround).toBe(true)
  })

  it('reports the touchdown exactly once', () => {
    const helicopter = fresh()
    const input = { ...noInput(), collective: -1 }
    let landings = 0
    for (let i = 0; i < 300; i++) {
      helicopter.update(input, 1 / 60)
      if (helicopter.justLanded) landings++
    }
    expect(helicopter.isOnGround).toBe(true)
    expect(landings).toBe(1)
  })

  it('reports how hard it touched down', () => {
    const hard = fresh()
    const soft = fresh()
    let hardImpact = 0
    let softImpact = 0
    for (let i = 0; i < 300; i++) {
      hard.update({ ...noInput(), collective: -1 }, 1 / 60)
      if (hard.justLanded) hardImpact = hard.impactSpeed
      // A fifth of the collective: the feathered descent a careful pilot uses.
      soft.update({ ...noInput(), collective: -0.2 }, 1 / 60)
      if (soft.justLanded) softImpact = soft.impactSpeed
    }
    expect(hard.isOnGround).toBe(true)
    expect(soft.isOnGround).toBe(true)
    expect(hardImpact).toBeGreaterThan(6)
    expect(softImpact).toBeLessThan(4)
  })

  it('grips the ground: landed, it will not slide off under stick input', () => {
    const helicopter = fly(fresh(), { collective: -1 }, 3)
    const parked = helicopter.position.clone()
    fly(helicopter, { pitch: 1, roll: 1 }, 2)
    expect(helicopter.position.distanceTo(parked)).toBeLessThan(0.01)
    expect(helicopter.isOnGround).toBe(true)
  })

  it('lifts off from the ground and can then fly again', () => {
    const helicopter = fly(fresh(), { collective: -1 }, 3)
    fly(helicopter, { collective: 1 }, 1)
    expect(helicopter.isOnGround).toBe(false)
    const z = helicopter.position.z
    fly(helicopter, { pitch: 1 }, 1)
    expect(helicopter.position.z).toBeLessThan(z - 3)
  })

  it('stays inside the field and reports the bump', () => {
    const helicopter = fresh()
    let bumped = false
    const input = { ...noInput(), roll: 1 }
    for (let i = 0; i < 60 * 60; i++) {
      helicopter.update(input, 1 / 60)
      bumped ||= helicopter.justBumped
    }
    expect(helicopter.position.x).toBeLessThanOrEqual(FIELD_LIMIT)
    expect(bumped).toBe(true)
  })

  it('is dragged down and slowed by clipping something solid', () => {
    const helicopter = fly(fresh(), { pitch: 1 }, 3)
    const cruising = helicopter.speed
    expect(cruising).toBeGreaterThan(20)

    // Plough through foliage for half a second. The real loop moves first and
    // then discovers what it hit, so the strike follows the update.
    const input = { ...noInput(), pitch: 1 }
    for (let i = 0; i < 30; i++) {
      helicopter.update(input, 1 / 60)
      helicopter.strikeObstacle(1 / 60)
    }
    expect(helicopter.justStruck).toBe(true)
    expect(helicopter.speed).toBeLessThan(cruising * 0.6)
  })

  it('forgets a strike as soon as it is clear again', () => {
    const helicopter = fresh()
    helicopter.strikeObstacle(1 / 60)
    expect(helicopter.justStruck).toBe(true)
    helicopter.update(noInput(), 1 / 60)
    expect(helicopter.justStruck).toBe(false)
  })

  it('can fly back out of foliage rather than being trapped in it', () => {
    const helicopter = fresh()
    const input = { ...noInput(), collective: 1 }
    for (let i = 0; i < 30; i++) {
      helicopter.update(input, 1 / 60)
      helicopter.strikeObstacle(1 / 60)
    }
    const climbing = helicopter.position.y
    for (let i = 0; i < 60; i++) helicopter.update(input, 1 / 60)
    expect(helicopter.position.y).toBeGreaterThan(climbing + 5)
  })

  it('is lifted and shoved by air doing something of its own', () => {
    const calm = fly(fresh(), {}, 1)
    const buffeted = fresh()
    for (let i = 0; i < 60; i++) {
      buffeted.update(noInput(), 1 / 60)
      buffeted.applyAirCurrent(40, 30, -20, 1 / 60)
    }
    expect(buffeted.position.y).toBeGreaterThan(calm.position.y + 5)
    expect(buffeted.position.x).toBeGreaterThan(calm.position.x + 3)
    expect(buffeted.position.z).toBeLessThan(calm.position.z - 2)
  })

  it('rocks visibly in rough air, and the rocking survives the lean easing', () => {
    const helicopter = fresh()
    for (let i = 0; i < 30; i++) {
      helicopter.update(noInput(), 1 / 60)
      helicopter.applyAirCurrent(0, 34, -28, 1 / 60)
    }
    // Regression: folding this into pitch/roll let the lean easing erase it.
    expect(Math.abs(helicopter.shakeRoll)).toBeGreaterThan(0.15)
    expect(Math.abs(helicopter.shakePitch)).toBeGreaterThan(0.15)
    expect(Math.abs(helicopter.shakeRoll)).toBeLessThanOrEqual(0.44)
  })

  it('settles again once the air smooths out', () => {
    const helicopter = fresh()
    helicopter.update(noInput(), 1 / 60)
    helicopter.applyAirCurrent(0, 40, 40, 1 / 60)
    expect(Math.abs(helicopter.shakeRoll)).toBeGreaterThan(0.1)
    fly(helicopter, {}, 3)
    expect(Math.abs(helicopter.shakeRoll)).toBeLessThan(0.01)
    expect(Math.abs(helicopter.shakePitch)).toBeLessThan(0.01)
  })

  it('rests on the ground it is told about, not a fixed floor', () => {
    const hilltop = fresh()
    for (let i = 0; i < 600; i++) hilltop.update({ ...noInput(), collective: -1 }, 1 / 60, 60)
    expect(hilltop.isOnGround).toBe(true)
    expect(hilltop.position.y).toBeCloseTo(62, 1)
    expect(hilltop.altitudeAboveGround).toBeCloseTo(0, 1)

    const valley = fresh()
    for (let i = 0; i < 600; i++) valley.update({ ...noInput(), collective: -1 }, 1 / 60, -30)
    expect(valley.isOnGround).toBe(true)
    expect(valley.position.y).toBeCloseTo(-28, 1)
  })

  it('is pushed up when the ground rises underneath it', () => {
    const helicopter = fresh()
    for (let i = 0; i < 120; i++) helicopter.update(noInput(), 1 / 60, 0)
    const before = helicopter.position.y
    // Fly over a hill that rises to 40: the skids ride up over it.
    for (let i = 0; i < 120; i++) helicopter.update(noInput(), 1 / 60, 40)
    expect(helicopter.position.y).toBeGreaterThan(before)
    expect(helicopter.position.y).toBeCloseTo(42, 1)
  })

  it('works harder when climbing and leaning than when hovering', () => {
    expect(fly(fresh(), {}, 1).effort).toBeCloseTo(0, 2)
    expect(fly(fresh(), { pitch: 1, collective: 1 }, 1).effort).toBeGreaterThan(0.5)
  })
})
