import * as THREE from 'three'
import { HelicopterModel } from './HelicopterModel'
import { LandingPadModel } from './LandingPadModel'
import { LandingPad } from '../game/LandingPad'
import { AnimalModel } from './AnimalModel'
import { Terrain } from '../game/Terrain'
import { TerrainMesh } from './TerrainMesh'
import { Forest } from './Forest'
import { FIELD_LIMIT } from '../game/Helicopter'

/**
 * The 3D world: the land, the forest, the pads, the camera and the lights.
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
  readonly animal = new AnimalModel()

  readonly rescuePad: LandingPad
  readonly pickupPad: LandingPad
  readonly pads: readonly LandingPad[]

  private cameraPlaced = false
  private readonly padModels: Map<LandingPad, LandingPadModel>

  constructor() {
    // The base sits on a low shelf; the animals wait on a high one, so every
    // run is a climb out and a descent home.
    const base = this.levelSpot(-250, 250, 'lowest')
    const high = this.levelSpot(255, -245, 'highest')

    this.rescuePad = new LandingPad('Rescue base', base, PAD_RADIUS)
    this.pickupPad = new LandingPad('Pickup point', high, PAD_RADIUS)
    this.pads = [this.pickupPad, this.rescuePad]

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(SKY_COLOR)
    this.scene.fog = new THREE.Fog(SKY_COLOR, FOG_NEAR, FOG_FAR)

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.5, 2400)

    this.scene.add(new THREE.AmbientLight(0xa8c0ff, 1.1))
    const sun = new THREE.DirectionalLight(0xffe9cf, 2.3)
    sun.position.set(180, 420, 120)
    this.scene.add(sun)
    // A dim bounce from below keeps canyon walls from going pure black.
    const bounce = new THREE.HemisphereLight(0x6f86b5, 0x2a2418, 0.55)
    this.scene.add(bounce)

    this.scene.add(new TerrainMesh(this.terrain).mesh)

    this.padModels = new Map([
      [this.pickupPad, new LandingPadModel(this.pickupPad, PICKUP_RIM_COLOR)],
      [this.rescuePad, new LandingPadModel(this.rescuePad, RESCUE_RIM_COLOR)],
    ])
    for (const model of this.padModels.values()) this.scene.add(model.group)

    const clearings = this.pads.map((pad) => ({ x: pad.position.x, z: pad.position.z, radius: pad.radius * 2.2 }))
    this.scene.add(new Forest(this.terrain, clearings).group)

    this.scene.add(this.animal.group)
    this.scene.add(this.helicopter.group)
  }

  /** Light up whichever pad the helicopter is standing on, and only that one. */
  highlightPad(landedOn: LandingPad | null): void {
    for (const [pad, model] of this.padModels) model.setActive(pad === landedOn)
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

  /**
   * Find the highest or lowest landable ground near a point, level it, and
   * return the levelled position. Searching rather than hard-coding means the
   * pads sit on real features of the hills instead of wherever a number landed.
   */
  private levelSpot(nearX: number, nearZ: number, want: 'highest' | 'lowest'): THREE.Vector3 {
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
    const spot = best ?? { x: nearX, z: nearZ, height: 0 }
    const level = this.terrain.levelAt(spot.x, spot.z, PAD_RADIUS + 6)
    return new THREE.Vector3(spot.x, level, spot.z)
  }
}

const SKY_COLOR = 0x1b2436
const FOG_NEAR = 160
const FOG_FAR = 1100
const PAD_RADIUS = 11
const PICKUP_RIM_COLOR = 0xd9a441
const RESCUE_RIM_COLOR = 0x5b8fd9

/** How far around the requested spot to look for a good pad site. */
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
