import * as THREE from 'three'

/**
 * The country beyond the map: a vast flat plain lying at the altitude of the
 * lowest ground, stretching away past the fog in every direction.
 *
 * It exists because the edge of a 840-metre world is a cliff into the sky, and
 * from any height at all you could see it. The land simply stopped and the
 * horizon was a straight line of nothing — which says "this is a box" louder
 * than anything else in the game. A plain at the bottom of the valley is hidden
 * under the hills everywhere the hills exist, and takes over exactly where they
 * run out, so the world reads as a range of hills in a wider country.
 *
 * It takes the fog, so it washes out to the sky colour at distance rather than
 * ending in a hard brown edge of its own.
 */
export class Plain {
  readonly mesh: THREE.Mesh

  constructor(altitude: number, reach = REACH) {
    const ground = new THREE.PlaneGeometry(reach, reach, 1, 1)
    // Built in the XY plane; lay it down so Y is up.
    ground.rotateX(-Math.PI / 2)

    this.mesh = new THREE.Mesh(
      ground,
      new THREE.MeshStandardMaterial({ color: PLAIN_COLOR, roughness: 1, metalness: 0 }),
    )
    // A little below the lowest ground rather than exactly level with it. Two
    // reasons: at the one point where the two are the same height they would
    // z-fight, and the altitude handed in is a *sampled* minimum, so the true
    // floor of the canyon is a few centimetres lower than anyone measured.
    // Either way the result is a brown patch showing through the canyon floor,
    // and two metres on a map with a hundred of relief costs nothing.
    this.mesh.position.y = altitude - CLEARANCE
    this.mesh.renderOrder = -1
  }
}

/**
 * Wide enough to reach well past the far fog from the top of the map, so the
 * plain always ends in haze rather than at a visible edge.
 */
const REACH = 40000
const CLEARANCE = 2
/** Dry plain beyond the hills: the land the fire is heading out across. */
const PLAIN_COLOR = new THREE.Color(0x8f6b43)
