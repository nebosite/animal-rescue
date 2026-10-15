import * as THREE from 'three'
import { HelicopterModel } from './HelicopterModel'
import { LandingPadModel } from './LandingPadModel'
import { LandingPad } from '../game/LandingPad'
import { AnimalModel } from './AnimalModel'
import { Terrain } from '../game/Terrain'
import { TerrainMesh } from './TerrainMesh'
import { Forest } from './Forest'
import { Boulders } from './Boulders'
import { TreeCover } from '../game/TreeCover'
import { Fire } from '../game/Fire'
import { FireField } from './FireField'
import { Beacon } from './Beacon'
import { WinchLine } from './WinchLine'
import { WaterDrop } from './WaterDrop'
import { Debris } from './Debris'
import { FireParticles } from './FireParticles'
import { GroundShadow } from './GroundShadow'
import { ShadowRig } from './ShadowRig'
import { Plain } from './Plain'
import { SiteFinder } from '../game/SiteFinder'
import { FIELD_LIMIT } from '../game/Helicopter'

/**
 * The 3D world: the land, the forest, the fire, the base, the camera and the
 * lights — and the bodies of the animals out in it.
 *
 * Deliberately free of the renderer, so it can be built and exercised in a
 * plain Node test with no browser and no GL context. Rendering lives in
 * main.ts and stays dumb.
 */
export class World {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly terrain = new Terrain(FIELD_LIMIT)
  readonly helicopter = new HelicopterModel()
  /** The animal slung under the helicopter. */
  readonly animal = new AnimalModel()
  /** One body per animal out in the landscape. */
  readonly waitingAnimals: AnimalModel[] = []
  /** One flare per animal out in the landscape, so each can be found. */
  readonly flares: Beacon[] = []

  readonly rescuePad: LandingPad
  readonly pads: readonly LandingPad[]
  readonly fire: Fire
  readonly treeCover: TreeCover
  readonly sites: SiteFinder

  readonly forest: Forest
  readonly terrainMesh: TerrainMesh
  readonly winchLine = new WinchLine()
  readonly waterDrop = new WaterDrop()
  /** Needles and bark knocked out of the canopy by a clumsy approach. */
  readonly debris = new Debris()
  readonly sun: THREE.DirectionalLight
  /** Keeps the sun's shadow box over the helicopter; trees cast onto the land through it. */
  readonly shadows: ShadowRig
  /** The helicopter's own shadow, for reading height on the way down. */
  readonly shadow: GroundShadow

  private cameraPlaced = false
  private readonly fireField: FireField
  private readonly sparks: FireParticles
  private readonly baseBeacon: Beacon
  private readonly padModels: Map<LandingPad, LandingPadModel>

  constructor(slots = 3) {
    // The base sits on a low shelf in the sheltered corner, as far from the
    // fire's edge as the map allows.
    const base = this.levelSpot(-250, 250, 'lowest')

    this.rescuePad = new LandingPad('Rescue base', base, PAD_RADIUS)
    this.pads = [this.rescuePad]

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(SKY_COLOR)
    this.scene.fog = new THREE.Fog(SKY_COLOR, FOG_NEAR, FOG_FAR)

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.5, 2400)

    // A bright, clear day: the game is meant to be playful, and a dusk palette
    // read as gloomy in play-testing. The fire still carries against it because
    // the flames are additive and the smoke is dark.
    this.scene.add(new THREE.AmbientLight(0xe4f1ff, 1.5))
    this.sun = new THREE.DirectionalLight(0xfff3d9, 2.7)
    this.sun.position.set(180, 420, 120)
    this.scene.add(this.sun, this.sun.target)
    this.shadows = new ShadowRig(this.sun)
    const bounce = new THREE.HemisphereLight(0xaee0ff, 0x86b85a, 0.8)
    this.scene.add(bounce)

    this.terrainMesh = new TerrainMesh(this.terrain)
    this.scene.add(this.terrainMesh.mesh)

    // The country beyond the hills, lying at the bottom of the valley so it is
    // buried everywhere the hills exist and takes over exactly where they stop.
    this.scene.add(new Plain(this.terrain.lowestPoint()).mesh)

    this.shadow = new GroundShadow(this.terrain)
    this.scene.add(this.shadow.mesh)

    this.padModels = new Map([[this.rescuePad, new LandingPadModel(this.rescuePad, RESCUE_RIM_COLOR)]])
    for (const model of this.padModels.values()) this.scene.add(model.group)

    // A generous clearing round the base: somewhere to descend into that is not
    // a hole in the canopy you have to find first.
    this.treeCover = new TreeCover(this.terrain, [{ x: base.x, z: base.z, radius: PAD_RADIUS * 3.4 }])
    this.forest = new Forest(this.treeCover)
    this.scene.add(this.forest.group)
    this.scene.add(new Boulders(this.terrain).group)

    this.baseBeacon = new Beacon(base, RESCUE_RIM_COLOR)
    this.scene.add(this.baseBeacon.group)

    // The fire is already burning along the whole far edge when the shift
    // starts, and the wind drives it across the map toward the base. The high
    // country goes first and everything alive is somewhere between the front
    // and home, running ahead of it — which is the entire situation the game
    // is about. The base is downwind too, so nobody is ever trapped behind it.
    this.fire = Fire.sweepingIn(FIRE_WIND, FIELD_LIMIT)
    this.fireField = new FireField(this.fire, this.terrain)
    this.scene.add(this.fireField.group)

    // Built after the forest and the fire, because it is fed by both.
    this.sparks = new FireParticles(this.fire, this.treeCover, this.terrain)
    this.scene.add(this.sparks.mesh)

    this.sites = new SiteFinder(this.terrain, this.treeCover, base)

    for (let i = 0; i < slots; i++) {
      const model = new AnimalModel()
      this.waitingAnimals.push(model)
      this.scene.add(model.group)
      const flare = new Beacon(new THREE.Vector3(), PICKUP_RIM_COLOR, FLARE_HEIGHT, FLARE_RING)
      this.flares.push(flare)
      this.scene.add(flare.group)
    }

    this.scene.add(this.animal.group)
    this.scene.add(this.winchLine.group)
    this.scene.add(this.waterDrop.group)
    this.scene.add(this.debris.group)
    this.scene.add(this.helicopter.group)
  }

  /** Light up the base pad while the helicopter is standing on it. */
  highlightPad(landedOn: LandingPad | null): void {
    for (const [pad, model] of this.padModels) model.setActive(pad === landedOn)
  }

  /**
   * Flicker the flames, boil the burning trees, roll the smoke, pulse the
   * beacons, fall the water and tumble the debris. Every frame — unlike
   * `burnTrees`, which decides *what* is on fire and can afford to be lazy
   * about it. Fire that moves four times a second looks like a slide show.
   */
  updateEffects(elapsed: number, dt: number, viewer: THREE.Vector3): void {
    this.fireField.update(elapsed)
    this.sparks.update(elapsed, dt, this.camera)
    this.baseBeacon.update(elapsed, viewer)
    for (const flare of this.flares) flare.update(elapsed, viewer)
    this.waterDrop.update(dt)
    this.debris.update(dt)
  }

  /**
   * Back to the top of a shift: the front on the far edge again, the forest
   * green, the ground unburnt. Everything here is state the landscape itself
   * accumulated; the score, the clock and the machine are reset by whoever
   * owns those.
   */
  reset(): void {
    this.fire.relight()
    this.treeCover.regrow()
    this.forest.restore()
    this.terrainMesh.unscorch()
  }

  /**
   * Move everything the fire has touched one step further along: the ground it
   * has crossed goes black, trees it has just reached catch, trees already
   * alight burn down, and the ones that are spent become snags.
   *
   * `dt` is the time since the *last call*, not since the last frame — this is
   * deliberately run every so often rather than every frame, since none of
   * these answers change quickly.
   */
  burnTrees(dt: number): number {
    for (const patch of this.fire.patches) {
      const hollow = this.fire.hollowOf(patch)
      if (hollow > 0) this.terrainMesh.scorch(patch.x, patch.z, patch.radius * hollow)
    }

    const caught = this.treeCover.scorch(this.fire)
    const spent = this.treeCover.advance(dt)

    // Redrawn every step while they burn, so the char and the glow move.
    for (const tree of this.treeCover.burning) {
      this.forest.setAlight(tree.index, TreeCover.burnProgress(tree))
    }
    for (const tree of spent) this.forest.burnOut(tree.index)

    if (caught.length === 0 && spent.length === 0 && this.treeCover.burning.length === 0) return 0
    this.forest.commitBurns()
    return caught.length
  }

  /**
   * Trail the helicopter from behind its tail and above, swinging round as it
   * turns. The camera eases toward where it wants to be rather than snapping,
   * so a hard turn shows a little of the helicopter's side — that lag is a
   * large part of what makes the turn feel like one. The first call snaps so
   * there is no fly-in at load. It is also kept above the land, or flying
   * along a canyon would bury the view in the wall behind you.
   */
  follow(position: THREE.Vector3, heading: number, dt: number): void {
    const sinH = Math.sin(heading)
    const cosH = Math.cos(heading)

    // The tail points (+sin h, +cos h) in the ground plane.
    CAMERA_GOAL.set(
      position.x + sinH * CAMERA_BACK,
      position.y + CAMERA_UP,
      position.z + cosH * CAMERA_BACK,
    )
    if (this.cameraPlaced) {
      this.camera.position.lerp(CAMERA_GOAL, 1 - Math.exp(-CAMERA_FOLLOW * dt))
    } else {
      this.camera.position.copy(CAMERA_GOAL)
      this.cameraPlaced = true
    }

    const floor = this.terrain.heightAt(this.camera.position.x, this.camera.position.z) + CAMERA_CLEARANCE
    if (this.camera.position.y < floor) this.camera.position.y = floor

    LOOK_AT.set(
      position.x - sinH * LOOK_AHEAD,
      position.y + LOOK_UP,
      position.z - cosH * LOOK_AHEAD,
    )
    this.camera.lookAt(LOOK_AT)
  }

  /**
   * Match the camera to a new viewport. Zero-height viewports happen during
   * layout and would otherwise produce a NaN aspect that blanks the screen.
   */
  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  /** Find the highest or lowest landable ground near a point, and level it for a pad. */
  private levelSpot(nearX: number, nearZ: number, want: 'highest' | 'lowest'): THREE.Vector3 {
    const spot = this.findSpot(nearX, nearZ, want)
    const level = this.terrain.levelAt(spot.x, spot.z, PAD_RADIUS + 6)
    return new THREE.Vector3(spot.x, level, spot.z)
  }

  /**
   * The highest or lowest landable, canyon-free ground near a point. Searching
   * rather than hard-coding means things sit on real features of the hills
   * instead of wherever a number landed.
   */
  private findSpot(nearX: number, nearZ: number, want: 'highest' | 'lowest'): THREE.Vector3 {
    let best: { x: number; z: number; height: number } | null = null

    for (let x = nearX - SEARCH_RANGE; x <= nearX + SEARCH_RANGE; x += SEARCH_STEP) {
      for (let z = nearZ - SEARCH_RANGE; z <= nearZ + SEARCH_RANGE; z += SEARCH_STEP) {
        if (Math.abs(x) > FIELD_LIMIT - 40 || Math.abs(z) > FIELD_LIMIT - 40) continue
        if (this.terrain.canyonDepthAt(x, z) > 0.2) continue
        if (!this.terrain.isLandable(x, z)) continue

        const height = this.terrain.heightAt(x, z)
        const better = best === null || (want === 'highest' ? height > best.height : height < best.height)
        if (better) best = { x, z, height }
      }
    }

    // Flat, landable ground is plentiful, but fall back to the centre of the
    // search rather than failing if this map ever has none.
    const spot = best ?? { x: nearX, z: nearZ, height: this.terrain.heightAt(nearX, nearZ) }
    return new THREE.Vector3(spot.x, spot.height, spot.z)
  }
}

const SKY_COLOR = 0x8fd3ff
const FOG_NEAR = 180
const FOG_FAR = 1150
const PAD_RADIUS = 11
/**
 * Which way the fire travels. The base sits low in the -x half, so a westward
 * wind puts the front on the far +x edge with the whole map — the high
 * country, the canyon, the base itself — downwind of it.
 */
const FIRE_WIND = { x: -1, z: 0 }
const PICKUP_RIM_COLOR = 0xd9a441
const RESCUE_RIM_COLOR = 0x5b8fd9
/** Animal flares are shorter than the base beacon: findable, not skyline. */
const FLARE_HEIGHT = 110
const FLARE_RING = 8

/** How far around the requested spot to look for a good site. */
const SEARCH_RANGE = 90
const SEARCH_STEP = 6

/** Chase camera: how far behind the tail and above it sits, and how quickly it catches up. */
const CAMERA_BACK = 30
const CAMERA_UP = 12
const CAMERA_FOLLOW = 5
/** Never let the land come closer than this to the lens. */
const CAMERA_CLEARANCE = 4
/** The camera looks a little ahead of the nose, so turns reveal where you are going. */
const LOOK_AHEAD = 6
const LOOK_UP = 1.5

// Reused each frame so following allocates nothing.
const CAMERA_GOAL = new THREE.Vector3()
const LOOK_AT = new THREE.Vector3()
