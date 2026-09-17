import * as THREE from 'three'

/**
 * An on-screen pointer to wherever the player should be going.
 *
 * When the target is in view it sits on it; when it is not — which, on a map
 * this size, is most of the time — it pins to the edge of the screen and
 * points the way, so there is never a moment of "which way do I even turn".
 */
export class TargetMarker {
  private readonly projected = new THREE.Vector3()

  constructor(
    private readonly element: HTMLElement,
    private readonly arrow: HTMLElement,
    private readonly label: HTMLElement,
  ) {}

  /** Place the marker for this frame. */
  update(target: THREE.Vector3, camera: THREE.Camera, width: number, height: number, text: string): void {
    this.projected.copy(target).project(camera)

    // Behind the camera, the projection mirrors; flip it so the arrow points
    // back the way you came instead of confidently pointing forward.
    const behind = this.projected.z > 1
    let x = behind ? -this.projected.x : this.projected.x
    let y = behind ? -this.projected.y : this.projected.y

    const onScreen = !behind && Math.abs(x) <= 1 && Math.abs(y) <= 1
    if (!onScreen) {
      // Push out to the frame and let the longest axis decide which edge.
      const longest = Math.max(Math.abs(x), Math.abs(y)) || 1
      x /= longest
      y /= longest
    }

    const marginX = (MARGIN / width) * 2
    const marginY = (MARGIN / height) * 2
    x = clamp(x, -1 + marginX, 1 - marginX)
    y = clamp(y, -1 + marginY, 1 - marginY)

    const left = ((x + 1) / 2) * width
    const top = ((1 - y) / 2) * height
    this.element.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
    this.element.dataset.where = onScreen ? 'in-view' : 'off-screen'

    // The arrow points from the middle of the screen toward the marker.
    this.arrow.style.transform = `rotate(${(Math.atan2(left - width / 2, height / 2 - top) * 180) / Math.PI}deg)`
    if (this.label.textContent !== text) this.label.textContent = text
  }
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

/** Keep the marker clear of the very edge of the frame. */
const MARGIN = 54
