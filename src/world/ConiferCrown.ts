import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * The branch work of a fir, as one merged geometry ready to be instanced.
 *
 * A cone is the wrong shape for these trees. A mature forest fir carries its
 * needles in a crown of drooping tiers at the top and is a bare pole for most
 * of its height, and from the air that is what tells you how tall a stand is
 * and where the gaps between trunks are. It is also what makes a burning one
 * read properly: the fire eats the skirt first and the bare spar is left.
 *
 * Built in a unit box — the crown fills y 0..1 and reaches out to radius 1 —
 * so `Forest` can scale one geometry to whatever each tree needs. Everything
 * is open-ended and low-segment on purpose: there are five thousand of these
 * on screen, and a cap nobody can see from outside costs as much as a branch.
 */
export class ConiferCrown {
  readonly geometry: THREE.BufferGeometry

  constructor(tiers = TIERS, perTier = PER_TIER) {
    const parts: THREE.BufferGeometry[] = []

    // The leader: a thin spire up the middle, so the silhouette still comes to
    // a point and the crown is not a bare hub with sticks coming out of it.
    const spire = new THREE.ConeGeometry(SPIRE_RADIUS, 1, 5, 1, true)
    spire.translate(0, 0.5, 0)
    parts.push(spire)

    const place = new THREE.Object3D()
    for (let tier = 0; tier < tiers; tier++) {
      // Where up the crown this ring of branches sits.
      const up = (tier + 0.4) / tiers
      // Widest at the bottom, tapering to nothing at the tip. The power keeps
      // the taper convex, which is what makes it read as a fir rather than a
      // Christmas tree made of triangles.
      const reach = Math.max(MIN_REACH, (1 - up) ** 0.72)

      for (let branch = 0; branch < perTier; branch++) {
        // Twisted tier to tier, so the rings do not line up into vertical ribs.
        const around = (branch / perTier) * Math.PI * 2 + tier * TIER_TWIST
        const spray = new THREE.ConeGeometry(reach * THICKNESS, reach, 4, 1, true)
        // A cone grows up its own +Y with the apex on top. Put the fat end at
        // the origin, then lay it over so it points outward and droops.
        spray.translate(0, reach / 2, 0)

        place.position.set(0, up, 0)
        // Euler XYZ applies Z first, so the roll lays the branch down and the
        // yaw then swings it round to its place on the ring.
        place.rotation.set(0, -around, -Math.PI / 2 - DROOP)
        // Squashed across its own thickness: a flat spray of needles, not a
        // twig. The squash is in local X, which the roll turns into world Y.
        place.scale.set(FLATNESS, 1, 1)
        place.updateMatrix()
        spray.applyMatrix4(place.matrix)
        parts.push(spray)
      }
    }

    this.geometry = mergeGeometries(parts, false)!
    for (const part of parts) part.dispose()
  }
}

/** Rings of branches up the crown, and how many in each ring. */
const TIERS = 4
const PER_TIER = 5
/** Radians each ring is turned relative to the one below it. */
const TIER_TWIST = 0.62
/** How thick a branch is relative to its length. */
const THICKNESS = 0.3
/** How much a branch is squashed vertically into a flat spray. */
const FLATNESS = 0.5
/** How far a branch hangs below horizontal, radians. */
const DROOP = 0.33
/** The topmost ring still has some needles on it. */
const MIN_REACH = 0.16
/** The central leader's thickness. */
const SPIRE_RADIUS = 0.17
