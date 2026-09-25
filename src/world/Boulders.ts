import * as THREE from 'three'
import type { Terrain } from '../game/Terrain'

/**
 * Rocks strewn where the ground is broken — mostly down the canyon, where the
 * hills have been stripped back to bedrock.
 *
 * One instanced mesh of lumpy low-poly stones, each squashed and turned
 * differently so a few hundred of them do not read as the same rock repeated.
 * Scattered deterministically, so the canyon is the same canyon every run.
 */
export class Boulders {
  readonly group = new THREE.Group()
  readonly count: number

  constructor(terrain: Terrain, attempts = ATTEMPTS) {
    const placed: Array<{ x: number; z: number; y: number; scale: number; squash: number; spin: number; tilt: number }> = []
    const edge = terrain.halfSize - MARGIN

    for (let i = 0; i < attempts; i++) {
      const x = (random(i, 1) * 2 - 1) * edge
      const z = (random(i, 2) * 2 - 1) * edge
      const rockiness = terrain.rockinessAt(x, z)
      // Bedrock country gets stones; soft hills get almost none.
      if (random(i, 3) > rockiness * rockiness) continue

      placed.push({
        x, z,
        y: terrain.heightAt(x, z),
        scale: MIN_SIZE + random(i, 4) * (MAX_SIZE - MIN_SIZE),
        squash: 0.45 + random(i, 5) * 0.5,
        spin: random(i, 6) * Math.PI * 2,
        tilt: (random(i, 7) - 0.5) * 0.5,
      })
    }

    this.count = placed.length

    // Detail 0 is a twenty-sided lump — enough to catch the light as stone
    // without another thousand triangles per rock.
    const rocks = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }),
      Math.max(1, this.count),
    )

    const transform = new THREE.Object3D()
    const tint = new THREE.Color()
    placed.forEach((rock, index) => {
      // Sunk a little, so they sit in the ground rather than on it.
      transform.position.set(rock.x, rock.y - rock.scale * rock.squash * 0.35, rock.z)
      transform.scale.set(rock.scale, rock.scale * rock.squash, rock.scale * (0.8 + random(index, 8) * 0.5))
      transform.rotation.set(rock.tilt, rock.spin, rock.tilt * 0.6)
      transform.updateMatrix()
      rocks.setMatrixAt(index, transform.matrix)

      tint.copy(STONE_PALE).lerp(STONE_DARK, random(index, 9))
      rocks.setColorAt(index, tint)
    })

    rocks.instanceMatrix.needsUpdate = true
    if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true
    rocks.frustumCulled = false
    this.group.add(rocks)
  }
}

/** Deterministic 0..1 for the nth rock's kth property. */
function random(index: number, channel: number): number {
  let h = Math.imul(index + 1, 0x7feb352d) ^ Math.imul(channel + 11, 0x846ca68b)
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35)
  return ((h ^ (h >>> 13)) >>> 0) / 4294967295
}

const ATTEMPTS = 14000
const MARGIN = 10
const MIN_SIZE = 1.6
const MAX_SIZE = 7.5

const STONE_PALE = new THREE.Color(0xc9bda8)
const STONE_DARK = new THREE.Color(0x8a7a66)
