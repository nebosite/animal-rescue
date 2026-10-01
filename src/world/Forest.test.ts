import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { Fire } from '../game/Fire'
import { Terrain } from '../game/Terrain'
import { TreeCover } from '../game/TreeCover'
import { Forest } from './Forest'
import { Plain } from './Plain'

const terrain = new Terrain(420)
const cover = new TreeCover(terrain, [], 2500)

function meshesOf(forest: Forest): THREE.InstancedMesh[] {
  return forest.group.children.filter((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh)
}

/** The trunks, the lit crowns and the unlit burning ones, told apart by material. */
function parts(forest: Forest) {
  const meshes = meshesOf(forest)
  const crowns = meshes.filter((mesh) => mesh.geometry.type === 'BufferGeometry')
  return {
    trunks: meshes.find((mesh) => mesh.geometry.type === 'CylinderGeometry')!,
    lit: crowns.find((mesh) => mesh.material instanceof THREE.MeshStandardMaterial)!,
    unlit: crowns.find((mesh) => mesh.material instanceof THREE.MeshBasicMaterial)!,
  }
}

function colourOf(mesh: THREE.InstancedMesh, index: number): THREE.Color {
  const at = mesh.instanceColor!.array
  return new THREE.Color(at[index * 3], at[index * 3 + 1], at[index * 3 + 2])
}

/** Is this instance actually being drawn, or scaled away to nothing? */
function isDrawn(mesh: THREE.InstancedMesh, index: number): boolean {
  const matrix = new THREE.Matrix4()
  mesh.getMatrixAt(index, matrix)
  const te = matrix.elements
  return te[0] ** 2 + te[1] ** 2 + te[2] ** 2 + te[4] ** 2 + te[5] ** 2 + te[6] ** 2 > 1e-6
}

/** Is this colour a warm yellow-orange rather than a green? */
function isYellowOrange(colour: THREE.Color): boolean {
  return colour.r > 0.5 && colour.r > colour.g * 1.2 && colour.g > colour.b * 2
}

describe('Forest', () => {
  it('draws the wood in three instanced meshes: trunks, crowns, and burning crowns', () => {
    const forest = new Forest(cover)
    expect(meshesOf(forest)).toHaveLength(3)
    expect(parts(forest).lit.count).toBe(cover.trees.length)
  })

  it('starts green, lit, and with nothing in the burning mesh', () => {
    const { lit, unlit } = parts(new Forest(cover))
    const colour = colourOf(lit, 0)
    expect(colour.g).toBeGreaterThan(colour.r)
    expect(colour.g).toBeGreaterThan(colour.b)
    expect(isDrawn(lit, 0)).toBe(true)
    expect(isDrawn(unlit, 0)).toBe(false)
  })

  it('turns a burning crown bright yellow-orange, not autumn gold', () => {
    // Scorching the needles gently through gold was the first attempt, and
    // from the air a stand in the middle of catching read as autumn rather
    // than as being on fire.
    const forest = new Forest(cover)
    const { unlit } = parts(forest)
    forest.setAlight(3, 0.05)
    expect(isYellowOrange(colourOf(unlit, 3))).toBe(true)
    forest.setAlight(4, 0.4)
    expect(isYellowOrange(colourOf(unlit, 4))).toBe(true)
  })

  it('draws a burning crown unlit, so the sun cannot shade one side of a fire', () => {
    // Branches on fire are a light source, not a lit surface. A material is
    // lit or unlit for every instance that shares it, so a burning crown has
    // to move to a mesh of its own — and it must leave the lit one, or it is
    // drawn twice and the shaded copy shows through.
    const forest = new Forest(cover)
    const { lit, unlit } = parts(forest)
    forest.setAlight(7, 0.3)

    expect(isDrawn(unlit, 7)).toBe(true)
    expect(isDrawn(lit, 7)).toBe(false)
    expect(unlit.material).toBeInstanceOf(THREE.MeshBasicMaterial)
    expect(lit.material).toBeInstanceOf(THREE.MeshStandardMaterial)
  })

  it('puts a burnt-out crown back in the lit mesh as a black snag', () => {
    const forest = new Forest(cover)
    const { lit, unlit, trunks } = parts(forest)
    forest.setAlight(5, 0.9)
    forest.burnOut(5)

    expect(isDrawn(unlit, 5)).toBe(false)
    expect(isDrawn(lit, 5)).toBe(true)
    const colour = colourOf(lit, 5)
    expect(colour.r + colour.g + colour.b).toBeLessThan(0.15)
    expect(colourOf(trunks, 5).r + colourOf(trunks, 5).g).toBeLessThan(0.2)
  })

  it('leaves an unburnt trunk white, so the bark map is its whole colour', () => {
    const colour = colourOf(parts(new Forest(cover)).trunks, 0)
    expect(colour.r).toBeCloseTo(1, 3)
    expect(colour.g).toBeCloseTo(1, 3)
    expect(colour.b).toBeCloseTo(1, 3)
  })

  it('carries a bark texture with relief on it, so a trunk is not a brown tube', () => {
    const material = parts(new Forest(cover)).trunks.material as THREE.MeshStandardMaterial
    expect(material.map).toBeTruthy()
    expect(material.bumpMap).toBeTruthy()
    expect(material.map!.wrapS).toBe(THREE.RepeatWrapping)
  })

  it('grows the forest back green and lit for another shift', () => {
    const fresh = new TreeCover(terrain, [], 2500)
    const forest = new Forest(fresh)
    const { lit, unlit } = parts(forest)

    const fire = new Fire([{ x: 0, z: 0, radius: 200, age: 0 }])
    const caught = fresh.scorch(fire)
    expect(caught.length).toBeGreaterThan(3)
    for (const tree of caught) forest.setAlight(tree.index, 0.5)
    expect(isDrawn(unlit, caught[0].index)).toBe(true)

    fresh.regrow()
    forest.restore()
    const back = colourOf(lit, caught[0].index)
    expect(back.g).toBeGreaterThan(back.r)
    expect(isDrawn(lit, caught[0].index)).toBe(true)
    expect(isDrawn(unlit, caught[0].index)).toBe(false)
  })
})

describe('Plain', () => {
  it('lies just under the lowest ground, so the hills hide it everywhere they exist', () => {
    const lowest = terrain.lowestPoint()
    const plain = new Plain(lowest)
    expect(plain.mesh.position.y).toBeLessThan(lowest)
    expect(plain.mesh.position.y).toBeGreaterThan(lowest - 5)
  })

  it('reaches far past the fog, so it ends in haze and not at an edge', () => {
    const plain = new Plain(0)
    plain.mesh.geometry.computeBoundingBox()
    const box = plain.mesh.geometry.boundingBox!
    expect(box.max.x - box.min.x).toBeGreaterThan(10000)
  })
})

describe('Terrain.lowestPoint', () => {
  it('finds the canyon floor rather than some arbitrary low spot', () => {
    expect(terrain.lowestPoint()).toBeLessThan(0)
  })

  it('is close enough to the true minimum to lay the plain under the whole map', () => {
    // It is a sampled answer, so a finer probe than the one it uses can always
    // find ground a shade lower. What has to hold is that the plain built from
    // it ends up below every point of the land — otherwise the brown shows
    // through the floor of the canyon, which is the one place the player is
    // flying low and looking down.
    const under = new Plain(terrain.lowestPoint()).mesh.position.y
    for (let x = -420; x <= 420; x += 7) {
      for (let z = -420; z <= 420; z += 7) {
        expect(terrain.heightAt(x, z), `${x},${z}`).toBeGreaterThan(under)
      }
    }
  })
})
