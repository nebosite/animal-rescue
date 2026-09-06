import * as THREE from 'three'

/**
 * The 3D world: scene + camera, with no renderer and no WebGL.
 *
 * Keeping this free of the renderer is deliberate — it means the world can be
 * constructed and exercised in a plain Node test, with no browser or GL context.
 * Rendering lives in main.ts and stays dumb.
 */
export class World {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera

  constructor() {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(SKY_COLOR)
    this.scene.fog = new THREE.Fog(SKY_COLOR, 40, 260)

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000)
    this.camera.position.set(0, 18, 34)
    this.camera.lookAt(0, 0, 0)

    // A bare ground grid: enough to prove perspective is real, and nothing more.
    this.scene.add(new THREE.GridHelper(300, 60, GRID_COLOR, GRID_COLOR))
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
