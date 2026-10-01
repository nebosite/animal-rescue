import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { Fire } from '../game/Fire'
import { Terrain } from '../game/Terrain'
import { TreeCover } from '../game/TreeCover'
import { FireParticles } from './FireParticles'

const terrain = new Terrain(420)
const camera = new THREE.PerspectiveCamera(60, 1.6, 0.5, 2400)

/** A forest with nothing in it, for testing the ground fire on its own. */
const bare = new TreeCover(terrain, [], 0)

/** Where every spark actually is, skipping the ones scaled away to nothing. */
function shown(sparks: FireParticles): THREE.Vector3[] {
  const out: THREE.Vector3[] = []
  const matrix = new THREE.Matrix4()
  for (let i = 0; i < sparks.mesh.count; i++) {
    sparks.mesh.getMatrixAt(i, matrix)
    const te = matrix.elements
    const sizeSq = te[0] ** 2 + te[1] ** 2 + te[2] ** 2 + te[4] ** 2 + te[5] ** 2 + te[6] ** 2
    if (sizeSq < 1e-6) continue
    out.push(new THREE.Vector3(te[12], te[13], te[14]))
  }
  return out
}

/** Run the system the way the frame loop does. */
function burn(sparks: FireParticles, seconds: number, step = 1 / 60): void {
  for (let t = 0; t < seconds; t += step) sparks.update(t, step, camera)
}

describe('FireParticles', () => {
  it('draws nothing at all when nothing is alight', () => {
    const sparks = new FireParticles(new Fire([]), bare, terrain, 200)
    burn(sparks, 2)
    expect(shown(sparks)).toHaveLength(0)
  })

  it('lifts sparks off a burning patch', () => {
    const fire = new Fire([{ x: 0, z: 0, radius: 40, age: 0 }])
    const sparks = new FireParticles(fire, bare, terrain, 400)
    burn(sparks, 2)

    const lit = shown(sparks)
    expect(lit.length).toBeGreaterThan(200)
    // All of them over the fire, give or take the drift the flow allows.
    for (const spark of lit) expect(Math.hypot(spark.x, spark.z)).toBeLessThan(60)
  })

  it('puts no fire on ground the front has already burnt through', () => {
    // An old patch has eaten its middle and burns as a ring. Sparks rising out
    // of the dead black centre would undo the whole point of the wake.
    const fire = new Fire([{ x: 0, z: 0, radius: 60, age: 400 }])
    const hollow = fire.hollowOf(fire.patches[0]) * 60
    const sparks = new FireParticles(fire, bare, terrain, 500)
    burn(sparks, 3)

    const lit = shown(sparks)
    expect(lit.length).toBeGreaterThan(200)
    const inside = lit.filter((spark) => Math.hypot(spark.x, spark.z) < hollow * 0.7)
    expect(inside).toHaveLength(0)
  })

  it('still burns right through the middle of a young patch', () => {
    const fire = new Fire([{ x: 0, z: 0, radius: 40, age: 0 }])
    const sparks = new FireParticles(fire, bare, terrain, 500)
    burn(sparks, 3)
    expect(shown(sparks).some((spark) => Math.hypot(spark.x, spark.z) < 12)).toBe(true)
  })

  it('rises from the branches of burning trees, not from their feet', () => {
    const trees = new TreeCover(terrain, [], 2500)
    const blaze = new Fire([{ x: 0, z: 0, radius: 70, age: 0 }])
    const caught = trees.scorch(blaze)
    expect(caught.length).toBeGreaterThan(3)

    // No patches at all, so every spark has to come off a branch.
    const sparks = new FireParticles(new Fire([]), trees, terrain, 400)
    const lit = (() => { burn(sparks, 2); return shown(sparks) })()
    expect(lit.length).toBeGreaterThan(200)

    const lowestCrown = Math.min(...trees.burning.map((tree) => tree.crownBottom))
    const started = lit.filter((spark) => spark.y < lowestCrown - 2)
    // Nothing below the lowest branch anywhere in the stand: the fire is in
    // the crowns, which is where a crown fire is.
    expect(started).toHaveLength(0)
  })

  it('spreads wider the higher it gets, because the flow is pushing it', () => {
    // The sparks share one Perlin field and are pushed harder the further they
    // have risen, so a column leans and braids instead of going straight up.
    const fire = new Fire([{ x: 0, z: 0, radius: 25, age: 0 }])
    const sparks = new FireParticles(fire, bare, terrain, 900)
    burn(sparks, 4)

    const lit = shown(sparks)
    const ground = terrain.heightAt(0, 0)
    const low = lit.filter((spark) => spark.y - ground < 3)
    const high = lit.filter((spark) => spark.y - ground > 5)
    expect(low.length).toBeGreaterThan(10)
    expect(high.length).toBeGreaterThan(10)

    const spread = (of: THREE.Vector3[]) =>
      Math.sqrt(of.reduce((sum, spark) => sum + spark.x ** 2 + spark.z ** 2, 0) / of.length)
    expect(spread(high)).toBeGreaterThan(spread(low))
  })

  it('keeps every spark alive: none is left stuck where it was born', () => {
    const fire = new Fire([{ x: 0, z: 0, radius: 30, age: 0 }])
    const sparks = new FireParticles(fire, bare, terrain, 300)
    burn(sparks, 1)
    const before = shown(sparks).map((spark) => spark.y)
    burn(sparks, 1)
    const after = shown(sparks).map((spark) => spark.y)
    expect(after).not.toEqual(before)
  })

  it('follows the fire when it moves on', () => {
    const fire = new Fire([{ x: -200, z: 0, radius: 30, age: 0 }])
    const sparks = new FireParticles(fire, bare, terrain, 300)
    burn(sparks, 3)
    for (const spark of shown(sparks)) expect(spark.x).toBeLessThan(-100)

    // The old patch burns out and a new one catches somewhere else entirely.
    const moved = new Fire([{ x: 250, z: 100, radius: 30, age: 0 }])
    const next = new FireParticles(moved, bare, terrain, 300)
    burn(next, 3)
    for (const spark of shown(next)) expect(spark.x).toBeGreaterThan(150)
  })
})
