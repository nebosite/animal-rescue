import * as THREE from 'three'

/**
 * A circle of ground the helicopter can land on.
 *
 * Knows only about geometry — whether a point is over it. Whether the
 * helicopter has actually *landed* also depends on altitude, which the
 * helicopter itself reports, so the two are combined by the caller.
 */
export class LandingPad {
  constructor(
    readonly label: string,
    readonly position: THREE.Vector3,
    readonly radius = 9,
  ) {}

  /** True when a point is over the pad, ignoring altitude entirely. */
  covers(point: THREE.Vector3): boolean {
    return Math.hypot(point.x - this.position.x, point.z - this.position.z) <= this.radius
  }

  /**
   * Which pad, if any, a helicopter is standing on. Being over a pad is not
   * enough — it has to be down on the ground.
   */
  static landedOn(pads: readonly LandingPad[], point: THREE.Vector3, isOnGround: boolean): LandingPad | null {
    if (!isOnGround) return null
    return pads.find((pad) => pad.covers(point)) ?? null
  }
}
