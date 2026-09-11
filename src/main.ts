import * as THREE from 'three'
import { World } from './world/World'
import { Helicopter } from './game/Helicopter'
import { Controls } from './game/Controls'
import { Hud } from './ui/Hud'
import { LandingPad } from './game/LandingPad'
import { Rescue } from './game/Rescue'
import { Handling } from './game/Handling'
import { Announcer } from './game/Announcer'
import { CHIEF_FUSSINESS } from './game/AnimalProfile'
import { AudioEngine } from './audio/AudioEngine'
import { Soundscape } from './audio/Soundscape'
import { VolumeControl } from './ui/VolumeControl'
import { RadioPanel } from './ui/RadioPanel'

const world = new World()
const helicopter = new Helicopter()

const controls = new Controls()
controls.attach(window)

const hud = new Hud(
  document.getElementById('status')!,
  document.getElementById('score')!,
  document.getElementById('controls-hint')!,
)
const rescue = new Rescue(world.pickupPad, world.rescuePad)
const handling = new Handling()
const announcer = new Announcer()

// Sound can only begin after a key press or click, so the soundscape is built
// the moment the browser lets the engine start.
const audio = new AudioEngine()
audio.armOnGesture(window)
let soundscape: Soundscape | null = null

const radio = new RadioPanel(
  document.getElementById('radio')!,
  document.getElementById('radio-speaker')!,
  document.getElementById('radio-text')!,
  (line) => soundscape?.voice.speak(line.voice, line.text),
)

audio.onStart(() => {
  soundscape = new Soundscape(audio)
  presentAnimal()
  radio.say(announcer.welcome())
})
new VolumeControl(
  audio,
  document.getElementById('mute') as HTMLButtonElement,
  document.getElementById('volume') as HTMLInputElement,
)

if (import.meta.env.DEV) {
  // Dev-only handle so a browser-driving test can listen to the mix.
  ;(window as unknown as { __animalRescue: unknown }).__animalRescue = {
    audio,
    helicopter,
    controls,
    rescue,
    get soundscape() { return soundscape },
  }
}

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

const timer = new THREE.Timer()
// Connecting to the document makes the timer reset when the tab regains focus,
// instead of resuming with one huge delta.
timer.connect(document)

presentAnimal()

renderer.setAnimationLoop(() => {
  timer.update()
  // Cap dt so a long stall cannot teleport the helicopter across the map.
  const dt = Math.min(timer.getDelta(), 0.1)

  helicopter.update(controls.poll(), dt)
  world.helicopter.moveTo(helicopter.position)
  world.helicopter.setAttitude(helicopter.heading, helicopter.pitch, helicopter.roll)
  world.helicopter.spin(dt)
  world.follow(helicopter.position, helicopter.heading, dt)

  const landedPad = LandingPad.landedOn(world.pads, helicopter.position, helicopter.isOnGround)
  world.highlightPad(landedPad)

  // Judged before the pickup or delivery is processed, so a landing is blamed
  // on whoever was actually aboard during it: the passenger, or the paint.
  handling.setFussiness(rescue.carrying ? rescue.animal.fussiness : CHIEF_FUSSINESS)
  const rough = handling.update(helicopter, dt)
  if (rough) {
    if (rescue.carrying) {
      rescue.scold()
      radio.say(announcer.scolded(rescue.animal))
    } else {
      const line = announcer.chiefOnRoughFlying(rough)
      if (line) radio.say(line)
    }
  }

  switch (rescue.landedOn(landedPad)) {
    case 'picked-up':
      hud.flash(`${rescue.animal.name.toUpperCase()} ABOARD — TO THE RESCUE PAD`)
      soundscape?.pickedUp()
      radio.say(announcer.pickedUp(rescue.animal))
      break
    case 'delivered': {
      const { animal, credited } = rescue.lastDelivery!
      hud.flash(`${animal.name.toUpperCase()} RESCUED!  +${credited}`)
      soundscape?.delivered()
      radio.say(announcer.delivered(animal, credited))
      presentAnimal()
      break
    }
  }

  placeAnimal()
  soundscape?.frame(helicopter, rescue.animalWaiting ? WAITING_SPOT : null, dt)
  radio.update(dt)
  hud.showGamepad(controls.usingGamepad)
  hud.update(standingStatus(landedPad), rescue.score)

  renderer.render(world.scene, world.camera)
})

/** Dress the model and the beacon as whichever animal is up next. */
function presentAnimal(): void {
  world.animal.applyLook(rescue.animal.look)
  soundscape?.beacon.setCall(rescue.animal.call)
}

/**
 * Draw the animal wherever it currently is: waiting on the pad, or slung under
 * the helicopter. A slung load hangs well below the skids, so it is only drawn
 * once the helicopter is high enough for it to clear the ground — which means
 * it appears as you lift off and tucks away as you settle.
 */
function placeAnimal(): void {
  if (rescue.carrying) {
    world.animal.setScale(CARRY_SCALE)
    const slingDrop = world.animal.height + SKID_CLEARANCE
    world.animal.moveTo(PLACE.copy(helicopter.position).setY(helicopter.position.y - slingDrop))
    world.animal.setVisible(helicopter.position.y - slingDrop > 0)
    return
  }

  world.animal.setScale(WAITING_SCALE)
  world.animal.moveTo(WAITING_SPOT)
  world.animal.setVisible(rescue.animalWaiting)
}

function standingStatus(landedPad: LandingPad | null): string {
  if (landedPad) return `LANDED — ${landedPad.label.toUpperCase()}`
  if (rescue.carrying) return `CARRYING ${rescue.animal.name.toUpperCase()}`
  // Controller-only players never press a key, so tell them sound is waiting on one.
  if (!audio.started) return 'PRESS ANY KEY OR CLICK FOR SOUND'
  return `${rescue.animal.name.toUpperCase()} THE ${rescue.animal.species.toUpperCase()} IS WAITING — FOLLOW THE CALL`
}

// Reused so the render loop is not allocating a vector every frame.
const PLACE = new THREE.Vector3()
// Small enough to look like wildlife next to the helicopter rather than a
// rival vehicle, while still readable from the chase camera.
const WAITING_SCALE = 0.8
const CARRY_SCALE = 0.55
/** The skids reach about 1.55 below the helicopter; the load hangs a little clear of them. */
const SKID_CLEARANCE = 1.0
// Stood off to the side of the H, so the helicopter does not park on top of it.
const PAD_DECK_OFFSET = new THREE.Vector3(-4.6, 0.25, 1.8)
// Where the waiting animal stands in the world — also where its call comes from.
const WAITING_SPOT = world.pickupPad.position.clone().add(PAD_DECK_OFFSET)
