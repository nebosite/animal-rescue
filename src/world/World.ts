import * as THREE from 'three'
import { HelicopterModel } from './HelicopterModel'

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
    this.scene.add(this.helicopter.group)
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
const GRID_COLOR = 0x2f3d57
