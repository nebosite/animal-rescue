import * as THREE from 'three'
import type { Fire } from '../game/Fire'
import type { Terrain } from '../game/Terrain'
import type { Tree, TreeCover } from '../game/TreeCover'
import { PerlinNoise } from './PerlinNoise'

/** One spark, from the branch it left to the smoke it becomes. */
interface Spark {
  /** Where it was born, and where its path is measured from. */
  x: number
  y: number
  z: number
  /** 0 just born, 1 gone. */
  life: number
  /** Lives per second — how fast this one burns through. */
  pace: number
  /** How far it climbs over its life, and how hard the flow pushes it about. */
  rise: number
  swirl: number
  size: number
  /** Offsets into the noise field, so no two sparks read the same flow. */
  offsetX: number
  offsetZ: number
}

/**
 * The fire itself: sparks lifting off the burning branches and twisting away
 * upward through a Perlin flow field.
 *
 * The flow is the point. Each spark samples the same drifting noise field at
 * its own height as it rises, so neighbouring sparks are pushed the same way at
 * the same moment and the whole column *twists together* — it braids, leans,
 * and shears off downwind as one thing. Sparks given independent random drift
 * look like confetti; sparks sharing a flow field look like fire. The field
 * itself slides downward through the sparks over time, which is what makes the
 * twist travel up the column rather than sitting still in the air.
 *
 * Sparks are born on the burning trees by preference — that is where a crown
 * fire actually is — and on the flame band otherwise, so the front still reads
 * where it is crossing grass or bare rock.
 *
 * One pool, allocated once. A spark that reaches the end of its life is reborn
 * somewhere new rather than collected, so this never allocates in flight.
 */
export class FireParticles {
  readonly mesh: THREE.InstancedMesh

  private readonly sparks: Spark[] = []
  private readonly noise = new PerlinNoise(11)
  private readonly transform = new THREE.Object3D()
  private readonly tint = new THREE.Color()
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0)
  /** Where the next spark should be born, reused so emitting allocates nothing. */
  private readonly born = { x: 0, y: 0, z: 0 }
  private seed = 0

  constructor(
    private readonly fire: Fire,
    private readonly cover: TreeCover,
    private readonly terrain: Terrain,
    count = SPARKS,
  ) {
    for (let i = 0; i < count; i++) {
      this.sparks.push({
        x: 0, y: 0, z: 0,
        // Staggered across their whole lives at the start, so the fire does not
        // begin with every spark leaving the ground on the same frame.
        life: random(i, 1),
        pace: 0,
        rise: 0,
        swirl: 0,
        size: 0,
        offsetX: 0,
        offsetZ: 0,
      })
    }

    this.mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: softSpark(),
        transparent: true,
        depthWrite: false,
        // Alpha blended rather than additive, for the reason the rest of the
        // fire is: the sky here is a bright pale blue, and adding anything to
        // it saturates straight to white.
        //
        // And unfogged, because fog mixes a fragment *toward the sky colour*
        // before the blend, which turns a distant ember into a pale blue fleck.
        fog: false,
        side: THREE.DoubleSide,
      }),
      count,
    )
    this.mesh.frustumCulled = false
    for (let i = 0; i < count; i++) this.mesh.setMatrixAt(i, this.hidden)
  }

  /**
   * Age every spark, twist it through the flow, and respawn the spent ones.
   *
   * `facing` is the camera: the sparks are flat quads turned to face it, which
   * is the cheapest way to make a few thousand of them read as volume.
   */
  update(elapsed: number, dt: number, facing: THREE.Camera): void {
    const burning = this.cover.burning
    const patches = this.fire.patches
    const alight = burning.length > 0 || patches.length > 0

    for (let i = 0; i < this.sparks.length; i++) {
      const spark = this.sparks[i]
      spark.life += spark.pace * dt

      if (spark.life >= 1 || spark.pace === 0) {
        if (!alight) {
          this.mesh.setMatrixAt(i, this.hidden)
          continue
        }
        this.ignite(spark, burning)
      }

      const climbed = spark.rise * spark.life
      // Sampled at the height the spark has actually reached, not at the branch
      // it left — that is the difference between a column that twists along its
      // length and one that leans a fixed amount. The field slides down through
      // the sparks with time, so the twist travels upward.
      const sampleX = (spark.x + spark.offsetX) * FLOW_SCALE
      const sampleY = (spark.y + climbed) * FLOW_SCALE - elapsed * FLOW_SPEED
      const sampleZ = (spark.z + spark.offsetZ) * FLOW_SCALE
      const pushX = this.noise.at(sampleX, sampleY, sampleZ)
      const pushZ = this.noise.at(sampleX + 31.7, sampleY, sampleZ + 19.3)

      // The push grows as the spark rises: tight to the branch where it is
      // still fed, wandering freely by the time it is smoke.
      const wander = spark.swirl * spark.life * spark.life
      this.transform.position.set(
        spark.x + pushX * wander,
        spark.y + climbed,
        spark.z + pushZ * wander,
      )
      this.transform.quaternion.copy(facing.quaternion)
      // Up to size almost at once, held while it is burning, then gone. A
      // symmetrical swell was the first try and it spent half of every spark
      // growing, so the base of the column was thin and the top was fat —
      // which is a smoke plume, not a fire.
      const envelope = Math.min(1, spark.life / BLOOMS_BY) * (1 - smoothStep(FADES_FROM, 1, spark.life))
      const size = spark.size * envelope * (1 + spark.life * GROWS)
      this.transform.scale.set(size, size, size)
      this.transform.updateMatrix()
      this.mesh.setMatrixAt(i, this.transform.matrix)
      this.mesh.setColorAt(i, this.colourOf(spark.life))
    }

    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  /**
   * White-hot at the branch, through yellow and orange to a dull red, and
   * finally to the dark of smoke. The whole life of a fire in one ramp, which
   * is what gives the column its gradient from root to tip.
   */
  private colourOf(life: number): THREE.Color {
    if (life < YELLOW_UNTIL) return this.tint.copy(CORE).lerp(YELLOW, life / YELLOW_UNTIL)
    if (life < RED_UNTIL) return this.tint.copy(YELLOW).lerp(DEEP, (life - YELLOW_UNTIL) / (RED_UNTIL - YELLOW_UNTIL))
    return this.tint.copy(DEEP).lerp(SMOKE, (life - RED_UNTIL) / (1 - RED_UNTIL))
  }

  /** Put a spark back on something that is actually alight. */
  private ignite(spark: Spark, burning: readonly Tree[]): void {
    const roll = random(this.seed++, 2)
    // Crown fire by preference: the branches are where the fire is, and where
    // the player is looking. The flame band gets the rest, so the front still
    // reads as a line where it is crossing grass or bare rock.
    const inTheCrown = burning.length > 0 && (roll < FROM_TREES || this.fire.patches.length === 0)
    if (inTheCrown) {
      this.onBranch(burning[Math.floor(random(this.seed++, 3) * burning.length) % burning.length])
    } else {
      this.onGround()
    }

    // A spark off a burning crown is thrown clear and climbs away; one off the
    // ground is part of the bed the fire is made of, so it stays squat, broad
    // and short-lived. The same particle doing both jobs made the ground fire
    // look like a thin smoke haze instead of a line of flame.
    const lift = inTheCrown ? 1 : GROUND_RISE
    const fatten = inTheCrown ? 1 : GROUND_SIZE

    spark.x = this.born.x
    spark.y = this.born.y
    spark.z = this.born.z
    spark.life = 0
    spark.pace = 1 / (LIFE_SECONDS * (0.6 + random(this.seed++, 4) * 0.8) * lift)
    spark.rise = RISE * lift * (0.6 + random(this.seed++, 5) * 0.9)
    spark.swirl = SWIRL * lift * (0.5 + random(this.seed++, 6) * 1.1)
    spark.size = SIZE * fatten * (0.6 + random(this.seed++, 7) * 0.9)
    spark.offsetX = random(this.seed++, 8) * 90
    spark.offsetZ = random(this.seed++, 9) * 90
  }

  /** Somewhere in the branch work of a burning tree. */
  private onBranch(tree: Tree): void {
    const around = random(this.seed++, 10) * Math.PI * 2
    // Biased outward: the needles are at the ends of the branches, and that is
    // where a crown actually burns.
    const out = Math.sqrt(random(this.seed++, 11)) * CANOPY_SPREAD * tree.scale
    // Low in the crown at first — fire climbs a tree from its skirt upward.
    const up = random(this.seed++, 12) ** 0.7
    this.born.x = tree.x + Math.cos(around) * out
    this.born.y = tree.crownBottom + tree.crownHeight * up
    this.born.z = tree.z + Math.sin(around) * out
  }

  /** Somewhere on the burning band of a patch, for ground the trees have left. */
  private onGround(): void {
    const patches = this.fire.patches
    const patch = patches[Math.floor(random(this.seed++, 13) * patches.length) % patches.length]
    const hollow = this.fire.hollowOf(patch)
    const across = hollow + Math.sqrt(random(this.seed++, 14)) * (1 - hollow)
    const around = random(this.seed++, 15) * Math.PI * 2
    const x = patch.x + Math.cos(around) * across * patch.radius
    const z = patch.z + Math.sin(around) * across * patch.radius
    this.born.x = x
    this.born.y = this.terrain.heightAt(x, z) + 1
    this.born.z = z
  }
}

/** Deterministic 0..1 for the nth draw on channel k. */
function smoothStep(from: number, to: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

function random(index: number, channel: number): number {
  let h = Math.imul(index + 1, 0x27d4eb2d) ^ Math.imul(channel + 7, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35)
  return ((h ^ (h >>> 13)) >>> 0) / 4294967295
}

/**
 * A soft round blob, white with the shape in its alpha, built from an array —
 * no canvas, because the world is constructed in a plain Node test with no DOM.
 * The per-spark colour multiplies into it.
 */
function softSpark(size = SPARK_TEXTURE): THREE.DataTexture {
  const pixels = new Uint8Array(size * size * 4)
  const middle = (size - 1) / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const away = Math.min(1, Math.hypot(x - middle, y - middle) / middle)
      // Bright and solid at the heart, falling away smoothly to nothing — a
      // hard-edged dot reads as a pixel, not as an ember.
      const solid = (1 - away) ** 1.8
      const at = (y * size + x) * 4
      pixels[at] = 255
      pixels[at + 1] = 255
      pixels[at + 2] = 255
      pixels[at + 3] = Math.round(255 * solid)
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat)
  texture.needsUpdate = true
  return texture
}

const SPARKS = 6000
const SPARK_TEXTURE = 32
/** Seconds a spark lives, before the per-spark variation. */
const LIFE_SECONDS = 2.1
/** How far one climbs over its life, and how far the flow can push it sideways. */
const RISE = 20
const SWIRL = 7
/** How much bigger a spark gets by the end of its life, as it becomes smoke. */
const GROWS = 0.7
/** A spark is full size by this far into its life, and gone by the end. */
const BLOOMS_BY = 0.12
const FADES_FROM = 0.62
const SIZE = 5.5
/** How far out across a crown sparks are born, as a share of the canopy radius. */
const CANOPY_SPREAD = 3.1
/**
 * How a ground spark differs from one off a branch: it climbs a third as far,
 * lives proportionally as briefly, and is half again as broad — a bed of flame
 * rather than something thrown off the top of a tree.
 */
const GROUND_RISE = 0.34
const GROUND_SIZE = 1.5
/** The share of sparks born on burning branches rather than on the ground. */
const FROM_TREES = 0.55
/**
 * How tightly the flow field is sampled — a long wavelength, so a whole stand
 * of trees is inside one swirl and leans together — and how fast it slides
 * downward through the sparks, which sends the twist travelling up the column.
 */
const FLOW_SCALE = 0.016
const FLOW_SPEED = 0.55

/**
 * Where up a spark's life each colour is reached. Most of a spark is *fire*:
 * the first ramp spent its last 40% going to near-black, and since a spark also
 * grows as it ages, the biggest and most visible particles were all smoke. The
 * column read as a bonfire being put out.
 */
const YELLOW_UNTIL = 0.34
const RED_UNTIL = 0.82
/** White-hot, yellow, deep orange-red, and the ash grey it ends on. */
const CORE = new THREE.Color(0xfff3c4)
const YELLOW = new THREE.Color(0xffc233)
const DEEP = new THREE.Color(0xd63c0a)
const SMOKE = new THREE.Color(0x6f6058)
