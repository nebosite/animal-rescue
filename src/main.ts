import * as THREE from 'three'
import { World } from './world/World'

const world = new World()

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
document.body.appendChild(renderer.domElement)

function fitToWindow(): void {
  const { innerWidth: width, innerHeight: height } = window
  renderer.setSize(width, height)
  world.resize(width, height)
}

fitToWindow()
window.addEventListener('resize', fitToWindow)

renderer.setAnimationLoop(() => {
  renderer.render(world.scene, world.camera)
})
