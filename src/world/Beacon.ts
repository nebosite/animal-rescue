import * as THREE from 'three'

/**
 * A pillar of light standing over a landing site, so it can be found from the
 * far side of the map.
 *
 * Deliberately exempt from fog and depth-writing: the whole point is to be
 * visible at 600 metres through haze and over a ridge. It fades out with
 * height rather than ending in a hard edge, and breathes slowly so the eye
 * catches it against a static landscape.
 */
export class Beacon {
  readonly group = new THREE.Group()
  private readonly column: THREE.Mesh
  private readonly ring: THREE.Mesh
  private readonly columnMaterial: THREE.MeshBasicMaterial
  private readonly ringMaterial: THREE.MeshBasicMaterial

  constructor(position: THREE.Vector3, color: number) {
    this.group.position.copy(position)

    const geometry = new THREE.CylinderGeometry(RADIUS, RADIUS * 1.5, HEIGHT, 16, 1, true)
    geometry.translate(0, HEIGHT / 2, 0)
    fadeUpward(geometry)

    this.columnMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    })
    this.column = new THREE.Mesh(geometry, this.columnMaterial)
    this.group.add(this.column)

    // A ring on the deck: what to aim the skids at once you are close.
    this.ringMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    })
    this.ring = new THREE.Mesh(new THREE.RingGeometry(RING_INNER, RING_OUTER, 40), this.ringMaterial)
    this.ring.rotation.x = -Math.PI / 2
    this.ring.position.y = 0.4
    this.group.add(this.ring)
  }

  /**
   * Breathe, so it reads as a signal rather than scenery — and get out of the
   * way up close, because a beacon over the pad you are standing on is just a
   * wall across the view. The ring stays: that is what you aim the skids at.
   */
  update(elapsed: number, viewer: THREE.Vector3): void {
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * PULSE_RATE)
    const distance = Math.hypot(viewer.x - this.group.position.x, viewer.z - this.group.position.z)
    const nearness = 1 - Math.min(1, Math.max(0, (distance - FADE_NEAR) / (FADE_FAR - FADE_NEAR)))

    this.columnMaterial.opacity = (0.34 + 0.26 * pulse) * (1 - nearness)
    this.column.visible = this.columnMaterial.opacity > 0.01

    this.ringMaterial.opacity = 0.45 + 0.4 * pulse
    const spread = 1 + 0.08 * pulse
    this.ring.scale.set(spread, spread, 1)
    this.column.scale.set(1 + 0.04 * pulse, 1, 1 + 0.04 * pulse)
  }
}

/** Paint the column's vertex alpha so it dissolves toward the top. */
function fadeUpward(geometry: THREE.CylinderGeometry): void {
  const position = geometry.attributes.position
  const colors = new Float32Array(position.count * 4)
  for (let i = 0; i < position.count; i++) {
    const alpha = 1 - Math.min(1, position.getY(i) / HEIGHT)
    colors.set([1, 1, 1, alpha * alpha], i * 4)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4))
}

const HEIGHT = 190
const RADIUS = 2.4
const RING_INNER = 9
const RING_OUTER = 12
const PULSE_RATE = 2.1
/** Gone by the time you are on the pad, full strength once properly away. */
const FADE_NEAR = 45
const FADE_FAR = 130
