import * as THREE from 'three'

/** A rectangle of screen the marker must stay off, in CSS pixels. */
export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * An on-screen pointer to wherever the player should be going.
 *
 * When the target is in view it sits on it; when it is not — which, on a map
 * this size, is most of the time — it pins to the edge of the screen and
 * points the way, so there is never a moment of "which way do I even turn".
 *
 * It is then shoved clear of the HUD panels by the shortest route. The first
 * version treated the panels as full-width bands across the top and bottom of
 * the screen, which worked only while they were short: as soon as the bottom
 * left grew a volume slider, the free band between the two closed to fifteen
 * pixels and every marker piled into it, directly on top of the panels it was
 * supposed to be avoiding. Pushing out of the actual rectangles makes no
 * assumption about the layout, so moving a panel cannot break it again.
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
  update(target: THREE.Vector3, camera: THREE.Camera, width: number, height: number, text: string, avoid: readonly Box[] = []): void {
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
    // inside the screen. Its size depends on the label and the text scale, so
    // measure rather than assume.
    const halfWidth = this.label.parentElement!.offsetWidth / 2 + MARGIN
    const halfHeight = this.label.parentElement!.offsetHeight / 2 + MARGIN
    const place = clearOfPanels(
      clamp(((x + 1) / 2) * width, halfWidth, width - halfWidth),
      clamp(((1 - y) / 2) * height, halfHeight, height - halfHeight),
      halfWidth, halfHeight, avoid, width, height,
    )

    this.element.style.transform = `translate(${Math.round(place.left)}px, ${Math.round(place.top)}px)`
    this.element.dataset.where = onScreen ? 'in-view' : 'off-screen'

    // The arrow points from the middle of the screen toward the marker.
    this.arrow.style.transform =
      `rotate(${(Math.atan2(place.left - width / 2, height / 2 - place.top) * 180) / Math.PI}deg)`
    if (this.label.textContent !== text) this.label.textContent = text
  }
}

/**
 * Shove a marker off the HUD panels, by whichever short move leaves it
 * overlapping least.
 *
 * Escaping one panel at a time by the nearest edge is not enough: with a
 * status banner stacked on top of the radio, the cheapest way out of the radio
 * is upward into the banner and the cheapest way out of the banner is back
 * down into the radio, so the marker oscillates between them and lands on both.
 * Every move is therefore scored against *all* the panels, and the best
 * position found is the one returned — which can never be worse than where the
 * marker started.
 *
 * Exported so it can be checked without a browser: it is pure geometry, and it
 * is the part that actually decides whether the HUD is readable.
 */
export function clearOfPanels(
  left: number,
  top: number,
  halfWidth: number,
  halfHeight: number,
  avoid: readonly Box[],
  width: number,
  height: number,
): { left: number; top: number } {
  const covered = (at: { left: number; top: number }) =>
    avoid.reduce((sum, box) => sum + overlapArea(at, halfWidth, halfHeight, box), 0)

  let best = { left, top }
  let bestCover = covered(best)
  if (bestCover === 0) return best

  for (let pass = 0; pass < PASSES && bestCover > 0; pass++) {
    let found: { left: number; top: number; cover: number; moved: number } | null = null

    for (const box of avoid) {
      const ways = [
        { left: box.left - halfWidth, top: best.top },
        { left: box.right + halfWidth, top: best.top },
        { left: best.left, top: box.top - halfHeight },
        { left: best.left, top: box.bottom + halfHeight },
      ]
      for (const way of ways) {
        if (way.left < halfWidth || way.left > width - halfWidth) continue
        if (way.top < halfHeight || way.top > height - halfHeight) continue
        const cover = covered(way)
        const moved = Math.hypot(way.left - left, way.top - top)
        // Clear screen first; among equally clear places, the nearest to where
        // the marker actually wanted to be.
        if (!found || cover < found.cover || (cover === found.cover && moved < found.moved)) {
          found = { ...way, cover, moved }
        }
      }
    }

    if (!found || found.cover >= bestCover) break
    best = { left: found.left, top: found.top }
    bestCover = found.cover
  }

  return best
}

/** How much of a marker at this place is hidden behind a panel. */
function overlapArea(at: { left: number; top: number }, halfWidth: number, halfHeight: number, box: Box): number {
  const across = Math.min(at.left + halfWidth, box.right) - Math.max(at.left - halfWidth, box.left)
  const down = Math.min(at.top + halfHeight, box.bottom) - Math.max(at.top - halfHeight, box.top)
  if (across <= 0 || down <= 0) return 0
  return across * down
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

const PASSES = 6
/** Breathing room between a marker and whatever it is being kept off. */
const MARGIN = 10
