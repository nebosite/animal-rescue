/** One burning patch of forest. */
export interface FirePatch {
  /**
   * Stable for the life of the patch. Spent patches are retired from the
   * middle of the list as the front marches on, so a patch's place in the
   * array means nothing — anything keeping per-patch state across frames (the
   * drawing does) must key off this.
   */
  id: number
  x: number
  z: number
  radius: number
  /** Seconds since it caught. Old patches burn hollow and leave a ring. */
  age: number
  /**
   * How many new patches have caught from this one. Nothing drawn depends on
   * it; it is what keeps the front a line. Embers go to whichever leading
   * patch has thrown fewest, so the whole width has to advance a step before
   * any part of it advances twice — without that the fire picks a direction
   * and shoots across the map as a single tendril.
   */
  children: number
}

/**
 * The forest fire: a front of burning patches sweeping in from one side of the
 * country, and the column of heat and smoke standing over each one.
 *
 * It is a hazard to the machine, never to anything alive — nothing is hurt on
 * screen. Flying into it wrecks the paint, the rotor and eventually the
 * airframe, and that is the whole of its violence.
 *
 * It genuinely travels. New patches catch at the *leading edge* rather than
 * anywhere in the burn, and patches that have eaten their fuel are retired, so
 * over a shift the fire crosses most of the map instead of fattening where it
 * started. That is what makes the animals' plight change while you watch: they
 * are always ahead of it, and the gap closes.
 *
 * Pure geometry, no renderer: the flight loop asks how hot a point is, and the
 * visuals ask the same question to decide where to draw flames.
 */
export class Fire {
  /** How long the fire has been burning, seconds. */
  age = 0
  /** Which way the wind is pushing the front, as a unit vector. */
  readonly spread: { x: number; z: number }

  private readonly live: FirePatch[]
  /** The front as the shift starts, kept so another shift can relight it. */
  private readonly opening: readonly Omit<FirePatch, 'id' | 'children'>[]
  private sinceSpawn = 0
  private spawned = 0
  private nextId = 0

  constructor(
    patches: readonly Omit<FirePatch, 'id' | 'children'>[],
    spread: { x: number; z: number } = { x: 0, z: -1 },
    /** Patches are kept inside this half-width, so the fire cannot walk off the map. */
    private readonly halfField = Infinity,
  ) {
    this.opening = patches.map((patch) => ({ ...patch }))
    this.live = patches.map((patch) => ({ ...patch, id: this.nextId++, children: 0 }))
    const length = Math.hypot(spread.x, spread.z) || 1
    this.spread = { x: spread.x / length, z: spread.z / length }
  }

  get patches(): readonly FirePatch[] {
    return this.live
  }

  /**
   * A load of water on the front. It knocks the flames back where it lands —
   * shrinking what it hits and ageing it toward burnt-out — rather than
   * putting the fire out, which no one bucket ever does. Returns how much fire
   * it actually took out, so the copilot can say whether it was worth it.
   */
  douse(x: number, z: number, radius: number): number {
    let knocked = 0
    for (const patch of this.live) {
      const distance = Math.hypot(x - patch.x, z - patch.z)
      if (distance > radius + patch.radius) continue

      // Full effect on a direct hit, tailing off toward the edge of the drop.
      const overlap = 1 - smoothStep(0, radius + patch.radius, distance)
      const before = patch.radius
      patch.radius = Math.max(MIN_DOUSED_RADIUS, patch.radius * (1 - DOUSE_SHRINK * overlap))
      patch.age += DOUSE_AGES * overlap
      knocked += before - patch.radius
    }
    return knocked
  }

  /**
   * Back to the moment the shift began: the same front on the same edge with
   * the same wind, and nothing burnt yet. The scorched ground and the dead
   * trees are not the fire's to undo — whoever owns those puts them back.
   */
  relight(): void {
    this.live.length = 0
    this.nextId = 0
    this.age = 0
    this.sinceSpawn = 0
    this.spawned = 0
    for (const patch of this.opening) this.live.push({ ...patch, id: this.nextId++, children: 0 })
  }

  /** Start a fresh patch burning — a spot fire, or a test's blaze. */
  addPatch(patch: Omit<FirePatch, 'age' | 'id' | 'children'> & { age?: number }): void {
    if (this.live.length >= MAX_PATCHES) return
    this.live.push({ ...patch, age: patch.age ?? 0, id: this.nextId++, children: 0 })
  }

  /**
   * Let the fire grow: every patch widens toward its limit, spent patches are
   * retired, and every so often a new patch catches at the leading edge, so
   * the front creeps across the country toward wherever the animals are
   * waiting. Deterministic, so the same map always burns the same way and can
   * be learned.
   */
  advance(dt: number): void {
    this.age += dt
    for (const patch of this.live) {
      patch.radius = Math.min(MAX_RADIUS, patch.radius + GROWTH_PER_SECOND * dt)
      patch.age += dt
    }
    this.retireSpent()

    this.sinceSpawn += dt
    while (this.sinceSpawn >= SPAWN_EVERY && this.live.length < MAX_PATCHES) {
      this.sinceSpawn -= SPAWN_EVERY
      this.ignite()
    }
  }

  /**
   * Drop patches that have burned everything they had.
   *
   * Without this the fire is a growing stain rather than a front: the oldest
   * patches keep a ring of flame for ever, the patch budget fills with ground
   * the fire crossed minutes ago, and nothing new can catch ahead of it. The
   * scorched land and the dead trees stay behind regardless — those belong to
   * the terrain and the forest, not to the patch.
   */
  private retireSpent(): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      if (this.live[i].age >= BURNS_OUT_AFTER) this.live.splice(i, 1)
    }
  }

  /** A new patch catches at the downwind edge of the leading fire. */
  private ignite(): void {
    if (this.live.length === 0) return

    // Only the leading patches throw embers forward — letting any patch spawn
    // is why the front used to fatten where it stood instead of travelling —
    // and among those, the one that has thrown fewest, so the line advances
    // all along its width instead of growing a tendril.
    const lead = this.leadingEdge()
    const front = this.live.filter((patch) => this.downwind(patch.x, patch.z) + patch.radius >= lead - LEAD_BAND)
    const pool = front.length > 0 ? front : this.live
    const parent = pool.reduce((fewest, patch) =>
      patch.children < fewest.children || (patch.children === fewest.children && patch.id < fewest.id) ? patch : fewest)
    parent.children += 1

    const jitter = (hash(this.spawned, 1) - 0.5) * SPREAD_CONE
    const cos = Math.cos(jitter)
    const sin = Math.sin(jitter)
    const dirX = this.spread.x * cos - this.spread.z * sin
    const dirZ = this.spread.x * sin + this.spread.z * cos
    const radius = MIN_NEW_RADIUS + hash(this.spawned, 2) * (MAX_RADIUS * 0.5 - MIN_NEW_RADIUS)
    // New fire catches at the burning edge of the old, not at its dead centre.
    const reach = parent.radius * 0.85 + radius * 0.6
    const edge = this.halfField - radius * 0.5
    this.live.push({
      id: this.nextId++,
      x: clamp(parent.x + dirX * reach, -edge, edge),
      z: clamp(parent.z + dirZ * reach, -edge, edge),
      radius,
      age: 0,
      children: 0,
    })
    this.spawned += 1
  }

  /** How far along the wind a point lies. */
  private downwind(x: number, z: number): number {
    return x * this.spread.x + z * this.spread.z
  }

  /** How far along the wind the furthest flame has reached. */
  private leadingEdge(): number {
    let lead = -Infinity
    for (const patch of this.live) lead = Math.max(lead, this.downwind(patch.x, patch.z) + patch.radius)
    return lead
  }

  /**
   * How far ahead of the leading edge a point is, along the wind. Positive
   * means the fire has not got here yet but is coming for it — which is
   * exactly where an animal running from the front would be standing.
   */
  aheadOfFront(x: number, z: number): number {
    const lead = this.leadingEdge()
    if (lead === -Infinity) return Infinity
    return this.downwind(x, z) - lead
  }

  /**
   * How fiercely a point is burning, 0 outside the fire and 1 in the flames.
   * Overlapping patches do not stack past 1.
   *
   * A young patch burns right through. An old one has eaten its own fuel and
   * burns as a ring — the flame is a front advancing outward, with smouldering
   * black ground behind it. That is what a forest fire looks like from the air,
   * and it is what makes flying *behind* the front survivable.
   */
  intensityAt(x: number, z: number): number {
    let hottest = 0
    for (const patch of this.live) {
      const dx = x - patch.x
      const dz = z - patch.z
      const squared = dx * dx + dz * dz
      // Squared compare first: the fire is asked this thousands of times a
      // frame and almost every answer is "not this patch".
      if (squared >= patch.radius * patch.radius) continue
      hottest = Math.max(hottest, this.flameAt(patch, Math.sqrt(squared) / patch.radius))
    }
    return hottest
  }

  /** How far out a patch has burned itself hollow, as a fraction of its radius. */
  hollowOf(patch: FirePatch): number {
    return MAX_HOLLOW * smoothStep(0, HOLLOW_AFTER, patch.age)
  }

  /** True where the fire has already passed: black ground, no flame worth the name. */
  isBurntOut(x: number, z: number): boolean {
    for (const patch of this.live) {
      const hollow = patch.radius * this.hollowOf(patch)
      if (hollow <= 0) continue
      const dx = x - patch.x
      const dz = z - patch.z
      if (dx * dx + dz * dz < hollow * hollow) return true
    }
    return false
  }

  /**
   * The heat at a point within one patch, given how far across it you are.
   *
   * A patch is a solid blaze when it catches and a ring of flame once it has
   * eaten its middle, so this blends between the two shapes with age rather
   * than switching — switching would put a hard inner edge on a young patch
   * that has no hollow to have an edge around.
   */
  private flameAt(patch: FirePatch, across: number): number {
    if (across >= 1) return 0
    const maturity = smoothStep(0, HOLLOW_AFTER, patch.age)

    // Young: hot right through, easing to nothing at the rim.
    const closeness = 1 - across
    const solid = closeness * closeness * (3 - 2 * closeness)

    // Old: a band of flame near the rim, embers behind it. The embers are
    // faded out by the same outer lip as the flame, so the very rim reaches
    // nothing — otherwise the edge of a patch is a step from ember to air.
    const hollow = MAX_HOLLOW * maturity
    let ring = EMBER
    if (across > hollow) {
      const t = (across - hollow) / (1 - hollow)
      const risen = smoothStep(0, BAND_FEATHER, t)
      const falling = 1 - smoothStep(1 - BAND_FEATHER, 1, t)
      ring = falling * (EMBER + (1 - EMBER) * risen)
    }

    return solid * (1 - maturity) + ring * maturity
  }

  /**
   * How much heat the helicopter is taking, 0..1. The column thins with
   * height, so climbing over the fire is a real option — and a real decision,
   * because the top of the column is a long way up.
   */
  heatAt(x: number, z: number, altitudeAboveGround: number): number {
    const intensity = this.intensityAt(x, z)
    if (intensity <= 0) return 0
    const height = Math.max(0, altitudeAboveGround)
    if (height >= COLUMN_HEIGHT) return 0
    const thinning = 1 - height / COLUMN_HEIGHT
    return intensity * thinning * thinning
  }

  /**
   * How much fire-heated air stands over a point, 0..1.
   *
   * Deliberately *not* the flame intensity: the whole burn is a chimney, not
   * just the line of flame. Ground the front has already crossed is black,
   * baking and pouring heat upward, and the air keeps rising a little past
   * the rim. Driving the weather off flame intensity made the middle of every
   * mature patch — most of the fire's area — almost perfectly calm, which is
   * why none of this could be felt.
   */
  private chimneyAt(x: number, z: number): number {
    let most = 0
    for (const patch of this.live) {
      const outer = patch.radius + THERMAL_SPILL
      const dx = x - patch.x
      const dz = z - patch.z
      const squared = dx * dx + dz * dz
      if (squared >= outer * outer) continue
      most = Math.max(most, 1 - smoothStep(patch.radius * THERMAL_CORE, outer, Math.sqrt(squared)))
      if (most >= 1) return 1
    }
    return most
  }

  /**
   * Rising air over the fire, in units per second squared. Strongest a third
   * of the way up the column and gone at the top, so flying over a fire is
   * never simply a matter of having the altitude.
   */
  updraftAt(x: number, z: number, altitudeAboveGround: number): number {
    const chimney = this.chimneyAt(x, z)
    if (chimney <= 0) return 0
    const height = Math.max(0, altitudeAboveGround)
    if (height >= COLUMN_HEIGHT) return 0

    const up = height / COLUMN_HEIGHT
    const profile = Math.sin(Math.min(1, up / UPDRAFT_PEAK) * Math.PI * 0.5) * (1 - up)
    return chimney * UPDRAFT_FORCE * profile
  }

  /** How rough the air is here, 0..1, for shaking the machine about. */
  roughnessAt(x: number, z: number, altitudeAboveGround: number): number {
    const chimney = this.chimneyAt(x, z)
    if (chimney <= 0) return 0
    const height = Math.max(0, altitudeAboveGround)
    if (height >= COLUMN_HEIGHT) return 0
    // Rough right to the top of the column, unlike the lift, which peters out:
    // it is the last place you want the machine to go quiet and smooth.
    return chimney * (1 - 0.55 * (height / COLUMN_HEIGHT))
  }

  /** Is this point somewhere the helicopter is actively being damaged? */
  isBurning(x: number, z: number, altitudeAboveGround: number): boolean {
    return this.heatAt(x, z, altitudeAboveGround) > SINGEING
  }

  /** Distance to the nearest flame, for warning the pilot before it hurts. */
  distanceToNearest(x: number, z: number): number {
    let nearest = Infinity
    for (const patch of this.live) {
      nearest = Math.min(nearest, Math.hypot(x - patch.x, z - patch.z) - patch.radius)
    }
    return Math.max(0, nearest)
  }

  /**
   * A fire already burning along one edge of the country when the shift
   * starts, with the wind driving it straight across. `wind` is the direction
   * it travels, so a wind of (-1, 0) means a front standing on the +x edge and
   * coming west.
   *
   * This is the shape the game is about: everything alive is on the unburnt
   * side, running ahead of the front, and the only question is who you reach
   * first. The line spans the whole field, so there is no slipping round the
   * end of it. There is no need to cross it either — the base is downwind,
   * ahead of the fire like the animals are — so the front is a clock chasing
   * everyone home rather than a wall across the road. Crossing it is the
   * shortcut you take when it has got ahead of you.
   *
   * The wind is deliberately square to an axis. Everything that asks "is this
   * spot in the fire's path" measures against the leading edge along the wind,
   * and that only means anything while the front is a line across the wind —
   * a front bent round a corner has its tips furthest downwind and would
   * report the middle of the map as already passed.
   */
  static sweepingIn(
    wind: { x: number; z: number },
    halfField: number,
    options: { patches?: number; radius?: number; inset?: number } = {},
  ): Fire {
    const count = options.patches ?? 15
    const radius = options.radius ?? 46
    const inset = options.inset ?? 40

    const length = Math.hypot(wind.x, wind.z) || 1
    const alongX = wind.x / length
    const alongZ = wind.z / length
    const acrossX = -alongZ
    const acrossZ = alongX

    // Upwind edge of the field: the line starts as far back as it can.
    const originX = -alongX * (halfField - inset)
    const originZ = -alongZ * (halfField - inset)
    const edge = halfField - radius * 0.5

    const patches: Array<Omit<FirePatch, 'id' | 'children'>> = []
    for (let i = 0; i < count; i++) {
      // -1..1 across the front.
      const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1
      // A ragged line: a real front is not a ruler, and the kinks are what
      // put some animals closer to it than others from the first second.
      const wander = Math.sin(i * 2.399) * 34
      patches.push({
        x: clamp(originX + acrossX * t * edge + alongX * wander, -edge, edge),
        z: clamp(originZ + acrossZ * t * edge + alongZ * wander, -edge, edge),
        // Thickest in the middle of the front, tapering at its ends.
        radius: radius * (0.65 + 0.35 * Math.cos((t * Math.PI) / 2)),
        age: 0,
      })
    }
    return new Fire(patches, { x: alongX, z: alongZ }, halfField)
  }
}

/** Deterministic 0..1 for the nth ignition's kth property. */
function hash(index: number, channel: number): number {
  let h = Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(channel + 3, 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35)
  return ((h ^ (h >>> 13)) >>> 0) / 4294967295
}

/** Smooth 0→1 ramp between two edges. */
function smoothStep(from: number, to: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

/** Below this the helicopter is merely warm, not burning. */
const SINGEING = 0.02
/** How hot the burnt-out middle of an old patch stays. */
const EMBER = 0.16
/**
 * How much of an old patch's radius has burned hollow, and how long that
 * takes. Well inside a five-minute shift, so the ring and the black ground
 * behind it are something the player actually sees rather than a property of
 * a fire left burning for an hour.
 */
const MAX_HOLLOW = 0.68
const HOLLOW_AFTER = 34
/**
 * How much of the burning band is feathered at each lip. Wide enough that the
 * front is a few metres of rising heat rather than a wall you cross in one
 * frame — which is both truer and fairer to fly near.
 */
const BAND_FEATHER = 0.5
/**
 * Lift over the burn, in units per second squared. Stronger than full
 * collective at its peak, on purpose: the fire should be able to take the
 * helicopter somewhere the pilot did not choose.
 */
const UPDRAFT_FORCE = 60
/** Where up the column the lift is strongest, as a fraction of its height. */
const UPDRAFT_PEAK = 0.35
/** The chimney is at full strength inside this much of a patch's radius... */
const THERMAL_CORE = 0.55
/** ...and spills this far past its rim before it dies away. */
const THERMAL_SPILL = 26
/** What one load of water does to a patch it lands squarely on. */
const DOUSE_SHRINK = 0.45
/** And how much older — nearer burnt out — it leaves it. */
const DOUSE_AGES = 26
/** A doused patch never quite vanishes; something always keeps smouldering. */
const MIN_DOUSED_RADIUS = 9
/** How high the heat column reaches above the ground. */
export const COLUMN_HEIGHT = 85

/** A patch widens by this much a second until it hits the limit. */
const GROWTH_PER_SECOND = 0.35
const MAX_RADIUS = 64
const MIN_NEW_RADIUS = 22
/**
 * Seconds between new patches catching. Brisk, because the front has to cross
 * most of an 840-metre map inside a five-minute shift for the animals' plight
 * to change while the player watches.
 */
const SPAWN_EVERY = 4.0
/**
 * How long a patch burns before it has eaten everything and goes out. The
 * black ground and the dead trees stay; only the live flame is retired. This
 * is what keeps the burn a travelling front rather than a spreading stain.
 */
const BURNS_OUT_AFTER = 60
/** How far back from the leading edge still counts as "the front", for spawning. */
const LEAD_BAND = 70
/** The drawing pre-allocates for this many; the fire never exceeds it. */
export const MAX_PATCHES = 44
/** How far off the wind a new patch may catch, radians, total width. */
const SPREAD_CONE = 1.7
