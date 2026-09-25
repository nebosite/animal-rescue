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
  readonly winchLine = new WinchLine()
  readonly waterDrop = new WaterDrop()

  private cameraPlaced = false
  private readonly fireField: FireField
  private readonly baseBeacon: Beacon
  private readonly padModels: Map<LandingPad, LandingPadModel>

  constructor(slots = 3) {
    // The base sits on a low shelf. The high ground opposite is where the wind
    // pushes the fire, and where the animals are mostly waiting.
    const base = this.levelSpot(-250, 250, 'lowest')
    const high = this.findSpot(255, -245, 'highest')

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
    const sun = new THREE.DirectionalLight(0xfff3d9, 2.7)
    sun.position.set(180, 420, 120)
    this.scene.add(sun)
    const bounce = new THREE.HemisphereLight(0xaee0ff, 0x86b85a, 0.8)
    this.scene.add(bounce)

    this.scene.add(new TerrainMesh(this.terrain).mesh)

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

    // The fire lies across the run to the high ground and creeps toward it, so
    // every trip is a decision and every wait has a clock.
    this.fire = Fire.frontBetween(base, high)
    this.fireField = new FireField(this.fire, this.terrain)
    this.scene.add(this.fireField.group)

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
    this.scene.add(this.helicopter.group)
  }

  /** Light up the base pad while the helicopter is standing on it. */
  highlightPad(landedOn: LandingPad | null): void {
    for (const [pad, model] of this.padModels) model.setActive(pad === landedOn)
  }

  /** Flicker the flames, roll the smoke, pulse the beacons, fall the water. */
  updateEffects(elapsed: number, dt: number, viewer: THREE.Vector3): void {
    this.fireField.update(elapsed)
    this.baseBeacon.update(elapsed, viewer)
    for (const flare of this.flares) flare.update(elapsed, viewer)
    this.waterDrop.update(dt)
  }

  /** Blacken every tree the fire has just been through. */
  burnTrees(): number {
    const caught = this.treeCover.scorch(this.fire)
    if (caught.length === 0) return 0
    for (const tree of caught) this.forest.burn(tree.index)
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
