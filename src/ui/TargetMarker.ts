import * as THREE from 'three'

/** Screen space the marker must stay out of — the HUD panels — in CSS pixels from each edge. */
export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

/**
 * An on-screen pointer to wherever the player should be going.
 *
 * When the target is in view it sits on it; when it is not — which, on a map
 * this size, is most of the time — it pins to the edge of the screen and
 * points the way, so there is never a moment of "which way do I even turn".
 * The edge it pins to is inset past the HUD, so a pinned marker never lands
 * on top of the score or under the radio.
 */
export class TargetMarker {
  private readonly projected = new THREE.Vector3()

  constructor(
    private readonly element: HTMLElement,
    private readonly arrow: HTMLElement,
    private readonly label: HTMLElement,
  ) {}

  /** Take the marker off the screen entirely. */
  hide(): void {
    if (this.element.dataset.where !== 'hidden') this.element.dataset.where = 'hidden'
  }

  /** Mark this as the one the player should go for, or as under threat. */
  emphasise(primary: boolean, urgent: boolean): void {
    const p = primary ? 'true' : 'false'
    const u = urgent ? 'true' : 'false'
    if (this.element.dataset.primary !== p) this.element.dataset.primary = p
    if (this.element.dataset.urgent !== u) this.element.dataset.urgent = u
  }

  /** Place the marker for this frame. */
  update(target: THREE.Vector3, camera: THREE.Camera, width: number, height: number, text: string, insets: Insets = NO_INSETS): void {
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

    // Convert to pixels, then keep the whole marker — not just its centre —
    // inside the frame the HUD leaves free. Its size depends on the label and
    // the text scale, so measure rather than assume.
    const halfWidth = this.label.parentElement!.offsetWidth / 2 + MARGIN
    const halfHeight = this.label.parentElement!.offsetHeight / 2 + MARGIN
    let left = ((x + 1) / 2) * width
    let top = ((1 - y) / 2) * height
    left = clamp(left, insets.left + halfWidth, width - insets.right - halfWidth)
    top = clamp(top, insets.top + halfHeight, height - insets.bottom - halfHeight)

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

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 }
/** Breathing room between a marker and the edge of whatever frame it is given. */
const MARGIN = 10
