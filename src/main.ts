import * as THREE from 'three'
import { World } from './world/World'
import { Helicopter } from './game/Helicopter'
import { Controls } from './game/Controls'
import { Hud } from './ui/Hud'
import { LandingPad } from './game/LandingPad'
import { Rescue } from './game/Rescue'
import { Handling } from './game/Handling'
import { Announcer } from './game/Announcer'
import { guidanceFor } from './game/Objective'
import { TargetMarker } from './ui/TargetMarker'
import { Airframe } from './game/Airframe'
import { Autopilot } from './game/Autopilot'
import { Cooldown } from './game/Cooldown'
import { CHIEF_FUSSINESS } from './game/AnimalProfile'
import { AudioEngine } from './audio/AudioEngine'
import { Soundscape } from './audio/Soundscape'
import { VolumeControl } from './ui/VolumeControl'
import { RadioPanel } from './ui/RadioPanel'

const world = new World()
const helicopter = new Helicopter()
// Start on the base pad, which is wherever the hills put it.
helicopter.position.set(world.rescuePad.position.x, world.rescuePad.position.y + 8, world.rescuePad.position.z)

const controls = new Controls()
controls.attach(window)

const hud = new Hud(
  document.getElementById('status')!,
  document.getElementById('score')!,
  document.getElementById('controls-hint')!,
  document.getElementById('compass')!,
  document.getElementById('range')!,
  document.getElementById('integrity-bar')!,
  document.getElementById('integrity')!,
  document.getElementById('objective')!,
  document.getElementById('objective-task')!,
  document.getElementById('objective-hint')!,
)
const targetMarker = new TargetMarker(
  document.getElementById('target-marker')!,
  document.getElementById('target-arrow')!,
  document.getElementById('target-label')!,
)
const rescue = new Rescue(world.pickupPad, world.rescuePad)
const handling = new Handling()
const announcer = new Announcer()
const airframe = new Airframe()
const autopilot = new Autopilot()
// The Chief shouts about the fire and the trees, but not sixty times a second.
const fireWarning = new Cooldown(4)
const treeWarning = new Cooldown(6)

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
    world,
    airframe,
    autopilot,
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

  const ground = world.terrain.heightAt(helicopter.position.x, helicopter.position.z)
  burn(ground, dt)

  // Once the machine is wrecked the pilot loses the controls and the Chief
  // flies it home — the game's way of saying "enough" without destroying it.
  const flying = airframe.needsRepair
    ? autopilot.update(helicopter, world.rescuePad.position, ground)
    : controls.poll()
  helicopter.update(flying, dt, ground)
  clipTrees(dt)

  world.helicopter.moveTo(helicopter.position)
  world.helicopter.setAttitude(helicopter.heading, helicopter.pitch, helicopter.roll)
  world.helicopter.spin(dt)
  world.follow(helicopter.position, helicopter.heading, dt)
  world.updateEffects(timer.getElapsed(), helicopter.position)

  const landedPad = LandingPad.landedOn(world.pads, helicopter.position, helicopter.isOnGround)
  world.highlightPad(landedPad)

  // Judged before the pickup or delivery is processed, so a landing is blamed
  // on whoever was actually aboard during it: the passenger, or the paint.
  judgeFlying(landedPad, dt)

  switch (rescue.landedOn(landedPad)) {
    case 'picked-up':
      hud.flash(`${rescue.animal.name.toUpperCase()} ABOARD — TO THE RESCUE BASE`)
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
  guide()
  soundscape?.frame(helicopter, rescue.animalWaiting ? WAITING_SPOT : null, dt)
  radio.update(dt)
  hud.showGamepad(controls.usingGamepad)
  hud.setIntegrity(airframe.integrity)
  hud.update(standingStatus(landedPad), rescue.score)

  renderer.render(world.scene, world.camera)
})

/** Take fire damage, and repair on the base pad. */
function burn(ground: number, dt: number): void {
  fireWarning.advance(dt)

  const wasGrounded = airframe.needsRepair
  const altitude = helicopter.position.y - (ground + SKID_HEIGHT)
  const heat = world.fire.heatAt(helicopter.position.x, helicopter.position.z, altitude)

  if (heat > 0) {
    airframe.scorch(heat, dt)
    if (!airframe.needsRepair && fireWarning.tryFire()) radio.say(announcer.scorched())
  }

  if (airframe.needsRepair && !wasGrounded) {
    hud.flash('AIRFRAME CRITICAL — AUTOPILOT RETURNING TO BASE')
    radio.say(announcer.grounded())
  }

  // Sitting on the base pad puts it right.
  if (airframe.needsRepair && helicopter.isOnGround && world.rescuePad.covers(helicopter.position)) {
    airframe.repair()
    hud.flash('REPAIRED — BACK IN THE AIR')
    radio.say(announcer.repaired())
  }
}

/** Let whoever is judging comment on the flying — unless the Chief is flying. */
function judgeFlying(landedPad: LandingPad | null, dt: number): void {
  handling.setFussiness(rescue.carrying ? rescue.animal.fussiness : CHIEF_FUSSINESS)
  const rough = handling.update(helicopter, dt)
  if (!rough || airframe.needsRepair) return

  // A knock costs a little paint as well as a telling-off.
  if (rough !== 'steep-bank') airframe.scuff()

  if (rescue.carrying) {
    rescue.scold()
    radio.say(announcer.scolded(rescue.animal))
    return
  }
  const line = announcer.chiefOnRoughFlying(rough)
  if (line) radio.say(line)
  void landedPad
}

/** Dress the model and the beacon as whichever animal is up next. */
function presentAnimal(): void {
  world.animal.applyLook(rescue.animal.look)
  soundscape?.beacon.setCall(rescue.animal.call)
}

/**
 * Draw the animal wherever it currently is: waiting on the pad, or slung under
 * the helicopter. A slung load hangs below the skids, so it is only drawn once
 * the helicopter is high enough for it to clear the ground — which means it
 * appears as you lift off and tucks away as you settle.
 */
function placeAnimal(): void {
  if (rescue.carrying) {
    world.animal.setScale(CARRY_SCALE)
    const slingDrop = world.animal.height + SKID_CLEARANCE
    const slungY = helicopter.position.y - slingDrop
    world.animal.moveTo(PLACE.copy(helicopter.position).setY(slungY))
    world.animal.setVisible(slungY > world.terrain.heightAt(helicopter.position.x, helicopter.position.z))
    return
  }

  world.animal.setScale(WAITING_SCALE)
  world.animal.moveTo(WAITING_SPOT)
  world.animal.setVisible(rescue.animalWaiting)
}

function standingStatus(landedPad: LandingPad | null): string {
  if (airframe.needsRepair) return `AUTOPILOT — ${autopilot.phase.toUpperCase()} TO BASE`
  if (landedPad) return `LANDED — ${landedPad.label.toUpperCase()}`
  if (rescue.carrying) return `CARRYING ${rescue.animal.name.toUpperCase()}`
  // Controller-only players never press a key, so tell them sound is waiting on one.
  if (!audio.started) return 'PRESS ANY KEY OR CLICK FOR SOUND'
  return `${rescue.animal.name.toUpperCase()} THE ${rescue.animal.species.toUpperCase()} IS WAITING — FOLLOW THE CALL`
}

/** Fly into the canopy and it drags, scrapes and costs paint. */
function clipTrees(dt: number): void {
  treeWarning.advance(dt)
  if (helicopter.isOnGround) return

  const struck = world.treeCover.strikeAt(helicopter.position.x, helicopter.position.y, helicopter.position.z)
  if (!struck) return

  helicopter.strikeObstacle(dt)
  airframe.scuff(TREE_DAMAGE * dt)
  soundscape?.effects.foliage()

  if (airframe.needsRepair) return
  if (treeWarning.tryFire()) {
    // Whoever is aboard objects; otherwise it is the Chief's paint again.
    if (rescue.carrying) {
      rescue.scold()
      radio.say(announcer.scolded(rescue.animal))
    } else {
      radio.say(announcer.treetops())
    }
  }
}

/**
 * Tell the player what to do and where to go: the objective panel, the compass
 * and the on-screen marker all read from the same guidance.
 */
function guide(): void {
  const carryingHome = rescue.carrying || airframe.needsRepair
  const pad = carryingHome ? world.rescuePad : world.pickupPad
  const dx = pad.position.x - helicopter.position.x
  const dz = pad.position.z - helicopter.position.z
  const range = Math.hypot(dx, dz)

  const guidance = guidanceFor({
    animalName: rescue.animal.name,
    species: rescue.animal.species,
    carrying: rescue.carrying,
    needsRepair: airframe.needsRepair,
    onGround: helicopter.isOnGround,
    overTarget: pad.covers(helicopter.position),
    range,
    heightAboveTarget: helicopter.position.y - pad.position.y,
    speed: helicopter.speed,
  })
  hud.setObjective(guidance.task, guidance.hint, guidance.target)

  // The heading that would put the nose on the target, minus where it is now.
  const bearing = Math.atan2(-dx, -dz) - helicopter.heading
  hud.setCourse(Math.atan2(Math.sin(bearing), Math.cos(bearing)), range)

  // Aim the marker a little above the deck so it sits over the pad, not in it.
  MARKER_AT.copy(pad.position).setY(pad.position.y + MARKER_HEIGHT)
  targetMarker.update(
    MARKER_AT,
    world.camera,
    window.innerWidth,
    window.innerHeight,
    `${carryingHome ? 'BASE' : rescue.animal.name.toUpperCase()}  ${Math.round(range)}m`,
  )
}

// Reused so the render loop is not allocating a vector every frame.
const PLACE = new THREE.Vector3()
const MARKER_AT = new THREE.Vector3()
/** How far up the beacon the on-screen marker rides. */
const MARKER_HEIGHT = 26
/** Integrity lost per second of dragging through a canopy. */
const TREE_DAMAGE = 0.08
// Small enough to look like wildlife next to the helicopter rather than a
// rival vehicle, while still readable from the chase camera.
const WAITING_SCALE = 0.8
const CARRY_SCALE = 0.55
/** The skids reach about 1.55 below the helicopter; the load hangs a little clear of them. */
const SKID_CLEARANCE = 1.0
/** Matches the flight model: how far the skids hold the hull off the ground. */
const SKID_HEIGHT = 2
// Stood off to the side of the H, so the helicopter does not park on top of it.
const PAD_DECK_OFFSET = new THREE.Vector3(-4.6, 0.25, 1.8)
// Where the waiting animal stands in the world — also where its call comes from.
const WAITING_SPOT = world.pickupPad.position.clone().add(PAD_DECK_OFFSET)
