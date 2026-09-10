import * as THREE from 'three'
import { HelicopterModel } from './HelicopterModel'
import { LandingPadModel } from './LandingPadModel'
import { LandingPad } from '../game/LandingPad'
import { AnimalModel } from './AnimalModel'

/**
 * The 3D world: scene, camera, lights, and the helicopter's body.
 *
 * Deliberately free of the renderer, so it can be built and exercised in a
 * plain Node test with no browser and no GL context. Rendering lives in
 * main.ts and stays dumb.
 */
export class World {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly helicopter = new HelicopterModel()
  readonly animal = new AnimalModel()
  readonly pickupPad = new LandingPad('Pickup pad', new THREE.Vector3(-18, 0, -55))
  readonly rescuePad = new LandingPad('Rescue pad', new THREE.Vector3(24, 0, -48))
  readonly pads: readonly LandingPad[] = [this.pickupPad, this.rescuePad]

  private readonly padModels = new Map<LandingPad, LandingPadModel>([
    [this.pickupPad, new LandingPadModel(this.pickupPad, PICKUP_RIM_COLOR)],
    [this.rescuePad, new LandingPadModel(this.rescuePad, RESCUE_RIM_COLOR)],
  ])

  constructor() {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(SKY_COLOR)
    this.scene.fog = new THREE.Fog(SKY_COLOR, 40, 260)

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000)

    this.scene.add(new THREE.AmbientLight(0xa8c0ff, 1.4))
    const sun = new THREE.DirectionalLight(0xfff1e0, 2.2)
    sun.position.set(30, 60, 20)
    this.scene.add(sun)

    this.scene.add(new THREE.GridHelper(300, 60, GRID_COLOR, GRID_COLOR))
    for (const model of this.padModels.values()) this.scene.add(model.group)
    this.scene.add(this.animal.group)
    this.scene.add(this.helicopter.group)
  }

  /** Light up whichever pad the helicopter is standing on, and only that one. */
  highlightPad(landedOn: LandingPad | null): void {
    for (const [pad, model] of this.padModels) model.setActive(pad === landedOn)
  }

  /**
   * Trail the helicopter from behind and above. Without this the helicopter
   * flies out of a fixed camera's view within a couple of seconds.
   */
  follow(position: THREE.Vector3): void {
    this.camera.position.set(position.x, position.y + 12, position.z + 30)
    this.camera.lookAt(position)
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
}

const SKY_COLOR = 0x1b2436
const PICKUP_RIM_COLOR = 0xd9a441
const RESCUE_RIM_COLOR = 0x5b8fd9
const GRID_COLOR = 0x2f3d57
