import * as THREE from 'three'

/**
 * The sun's shadow, kept on whatever the player is looking at.
 *
 * A shadow map is a picture of the scene from the sun, and its resolution is
 * spread over whatever it covers — spread over an 840-metre world it would be a
 * blur. So the map covers only a box around the helicopter and follows it,
 * which is all a chase camera can see in detail anyway; the fog hides the rest.
 *
 * The box is moved in whole texels. Slid smoothly, the shadow edges crawl and
 * shimmer as the sampling grid drifts across them, which in a forest reads as
 * every tree vibrating.
 */
export class ShadowRig {
  private readonly toSun = new THREE.Vector3()
  private readonly across = new THREE.Vector3()
  private readonly up = new THREE.Vector3()
  private readonly focus = new THREE.Vector3()

  constructor(
    private readonly sun: THREE.DirectionalLight,
    readonly halfWidth = HALF_WIDTH,
    mapSize = MAP_SIZE,
  ) {
    sun.castShadow = true
    sun.shadow.mapSize.set(mapSize, mapSize)
    const camera = sun.shadow.camera
    camera.left = -halfWidth
    camera.right = halfWidth
    camera.top = halfWidth
    camera.bottom = -halfWidth
    // Deep enough to catch a tall tree on a far hillside from a sun that may be low.
    camera.near = 1
    camera.far = SUN_DISTANCE + DEPTH
    camera.updateProjectionMatrix()
    // Tuned against the grass: the bias is what stops the ground shadowing
    // itself in stripes, and the normal bias is what stops it on slopes.
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.6

    this.toSun.copy(sun.position).normalize()
  }

  /** Which way the sun lies from the ground, as a unit vector. */
  get direction(): THREE.Vector3 {
    return this.toSun
  }

  /** Aim the sun along a new direction, e.g. as the day wears on. */
  setDirection(toSun: THREE.Vector3): void {
    this.toSun.copy(toSun).normalize()
  }

  /** Put the shadow box over this spot. */
  follow(x: number, y: number, z: number): void {
    // Snap on the light's own axes, one texel at a time.
    const texel = (2 * this.halfWidth) / this.sun.shadow.mapSize.x
    this.up.set(0, 1, 0)
    this.across.crossVectors(this.up, this.toSun).normalize()
    const lightUp = this.up.crossVectors(this.toSun, this.across).normalize()

    this.focus.set(x, y, z)
    const sideways = Math.round(this.focus.dot(this.across) / texel) * texel
    const vertical = Math.round(this.focus.dot(lightUp) / texel) * texel
    const depth = this.focus.dot(this.toSun)
    this.focus.copy(this.across).multiplyScalar(sideways)
    this.focus.addScaledVector(lightUp, vertical)
    this.focus.addScaledVector(this.toSun, depth)

    this.sun.target.position.copy(this.focus)
    this.sun.position.copy(this.focus).addScaledVector(this.toSun, SUN_DISTANCE)
    this.sun.target.updateMatrixWorld()
    this.sun.updateMatrixWorld()
  }
}

/** Half the width of the lit square around the helicopter, in world units. */
const HALF_WIDTH = 130
/** A little under 0.13 of a unit a texel across that box. */
const MAP_SIZE = 2048
const SUN_DISTANCE = 400
/** How far past the focus the shadow camera still sees. */
const DEPTH = 300
