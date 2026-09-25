import * as THREE from 'three'
import { World } from './world/World'
import { Helicopter } from './game/Helicopter'
import { Controls } from './game/Controls'
import { Hud } from './ui/Hud'
import { LandingPad } from './game/LandingPad'
import { Rescue, type Waiting } from './game/Rescue'
import { Handling } from './game/Handling'
import { Announcer } from './game/Announcer'
import { guidanceFor } from './game/Objective'
import { TargetMarker } from './ui/TargetMarker'
import { Airframe } from './game/Airframe'
import { Autopilot } from './game/Autopilot'
import { Cooldown } from './game/Cooldown'
import { Shift } from './game/Shift'
import { noInput } from './game/FlightInput'
import { Turbulence } from './game/Turbulence'
import { Copilot } from './game/Copilot'
import { CopilotInput } from './game/CopilotInput'
import { Winch } from './game/Winch'
import { WaterTank, DROP_RADIUS } from './game/WaterTank'
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
const markers = world.waitingAnimals.map((_, i) => {
  const root = document.getElementById(`target-marker-${i}`)!
  return new TargetMarker(root, root.querySelector('.target-arrow')!, root.querySelector('.target-label')!)
})

const rescue = new Rescue(world.rescuePad, world.sites, world.fire)
const shift = new Shift()
const handling = new Handling()
const announcer = new Announcer()
const airframe = new Airframe()
const autopilot = new Autopilot()
const air = new Turbulence()
const copilot = new Copilot()
const copilotSeat = new CopilotInput()
copilotSeat.attach(window)
const winch = new Winch()
const tank = new WaterTank()
// The Chief shouts about the fire and the trees, but not sixty times a second.
const fireWarning = new Cooldown(4)
const treeWarning = new Cooldown(6)
// Bram talks a lot. These stop him talking over himself.
const ferretChatter = new Cooldown(9)
const ferretAlarm = new Cooldown(5)
let seatTaken = false
/** Animals the Chief has already flagged as in the fire's path. */
const flagged = new Set<Waiting>()
/** The shift, and the fire, begin with the first key — not while the page loads. */
let underway = false

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
  presentAnimals()
  radio.say(announcer.welcome())
  radio.say(announcer.ferret('welcome'))
  underway = true
})
new VolumeControl(
  audio,
  document.getElementById('mute') as HTMLButtonElement,
  document.getElementById('volume') as HTMLInputElement,
)

// Another shift: the simplest reliable reset is a fresh page.
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyR' && shift.over) location.reload()
})

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
    shift,
    winch,
    tank,
    copilot,
    copilotSeat,
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

presentAnimals()

renderer.setAnimationLoop(() => {
  timer.update()
  // Cap dt so a long stall cannot teleport the helicopter across the map.
  const dt = Math.min(timer.getDelta(), 0.1)

  if (underway && !shift.over) {
    world.fire.advance(dt)
    const bolted = rescue.advance(dt)
    if (bolted) {
      flagged.delete(bolted)
      hud.flash(`${bolted.animal.name.toUpperCase()} BOLTED FROM THE FIRE — FIND ${bolted.animal.name.toUpperCase()} AGAIN`)
      radio.say(announcer.bolted(bolted.animal))
      presentAnimals()
    }
    warnOfFire()
    if (shift.advance(dt)) endShift()
  }

  const ground = world.terrain.heightAt(helicopter.position.x, helicopter.position.z)
  burn(ground, dt)

  // Once the machine is wrecked the pilot loses the controls and the Chief
  // flies it home — the game's way of saying "enough" without destroying it.
  // When the shift is over the controls simply go quiet.
  const flying = shift.over
    ? noInput()
    : airframe.needsRepair
      ? autopilot.update(helicopter, world.rescuePad.position, ground)
      : controls.poll()
  helicopter.update(flying, dt, ground)
  flyThroughFire(ground, dt)
  clipTrees(dt)
  workTheCopilot(ground, dt)

  world.helicopter.moveTo(helicopter.position)
  world.helicopter.setAttitude(helicopter.heading, helicopter.pitch, helicopter.roll)
  world.helicopter.spin(dt)
  world.follow(helicopter.position, helicopter.heading, dt)
  world.updateEffects(timer.getElapsed(), dt, helicopter.position)
  world.winchLine.update(helicopter.position, winch.length)
  // Burning the whole forest every frame is wasted work: the answer changes
  // only as the fire creeps.
  if (underway && !shift.over && burnCheck.advance(dt)) world.burnTrees()

  const landedPad = LandingPad.landedOn(world.pads, helicopter.position, helicopter.isOnGround)
  world.highlightPad(landedPad)

  // Judged before the pickup or delivery is processed, so a landing is blamed
  // on whoever was actually aboard during it: the passenger, or the paint.
  judgeFlying(dt)

  if (!shift.over) {
    // The line catches an animal without ever touching down — the copilot's
    // job, and the one thing a second player can do that really matters.
    if (rescue.winchUp(helicopter.position, winch.hookHeight(helicopter.position.y), helicopter.speed) === 'picked-up') {
      const aboard = rescue.carrying!
      flagged.delete(aboard)
      winch.stow()
      hud.flash(`${aboard.animal.name.toUpperCase()} ON THE WINCH — TO THE RESCUE BASE`)
      soundscape?.pickedUp()
      radio.say(announcer.ferret('winchHooked'))
      presentAnimals()
    }

    switch (rescue.landedOn(landedPad, helicopter.position, helicopter.isOnGround, helicopter.impactSpeed)) {
      case 'picked-up': {
        const aboard = rescue.carrying!
        flagged.delete(aboard)
        hud.flash(`${aboard.animal.name.toUpperCase()} ABOARD — TO THE RESCUE BASE`)
        soundscape?.pickedUp()
        radio.say(announcer.pickedUp(aboard.animal))
        presentAnimals()
        break
      }
      case 'delivered': {
        const { animal, credited, bonuses, scolded } = rescue.lastDelivery!
        const extras = bonuses.length ? `  ·  ${bonuses.join('  ·  ')}` : ''
        hud.flash(`${animal.name.toUpperCase()} RESCUED!  +${credited}${extras}`)
        soundscape?.delivered()
        radio.say(announcer.delivered(animal, scolded))
        presentAnimals()
        break
      }
    }
  }

  placeAnimals()
  guide()
  soundscape?.frame(helicopter, surroundings(), dt)
  radio.update(dt)
  noticeController()
  hud.showGamepad(controls.usingGamepad)
  hud.setIntegrity(airframe.integrity)
  hud.setCrew(winch.extended, tank.fraction, tank.loads, copilotSeat.taken)
  hud.setClock(shift.clock, shift.closing)
  hud.update(standingStatus(landedPad), rescue.score)

  renderer.render(world.scene, world.camera)
})

/**
 * Say so when a controller comes live. Browsers only list a pad once a
 * button on it has been pressed, so without this a player can hold a working
 * controller and never be sure the game noticed it.
 */
let controllerNoticed = false
function noticeController(): void {
  const live = controls.usingGamepad
  if (live && !controllerNoticed) {
    hud.flash(`CONTROLLER CONNECTED — ${controls.controllerName.toUpperCase().slice(0, 28) || 'GAMEPAD'}`)
  }
  controllerNoticed = live
}

/** What the soundscape needs to know about where you are. */
function surroundings() {
  const going = rescue.carrying ? null : rescue.recommended(helicopter.position)
  return {
    callFrom: going ? going.site : null,
    fireDistance: world.fire.distanceToNearest(helicopter.position.x, helicopter.position.z),
    inTheFire: world.fire.isBurning(helicopter.position.x, helicopter.position.z, helicopter.altitudeAboveGround),
  }
}

/**
 * The air over a fire is doing something of its own: it lifts, and it shoves.
 * Applied after the update that moved the helicopter, so it is felt on top of
 * whatever the pilot asked for rather than instead of it.
 */
function flyThroughFire(ground: number, dt: number): void {
  air.advance(dt)
  const agl = helicopter.position.y - (ground + SKID_HEIGHT)
  const lift = world.fire.updraftAt(helicopter.position.x, helicopter.position.z, agl)
  const rough = world.fire.roughnessAt(helicopter.position.x, helicopter.position.z, agl)
  if (lift <= 0 && rough <= 0) return

  helicopter.applyAirCurrent(lift, air.buffetX(rough), air.buffetZ(rough), dt)
  if (rough > 0.45 && ferretAlarm.tryFire()) radio.say(announcer.ferret('updraft'))
}

/**
 * The copilot's two jobs — the winch and the water — done by Bram, or by a
 * second player once they take the seat.
 */
function workTheCopilot(ground: number, dt: number): void {
  ferretChatter.advance(dt)
  ferretAlarm.advance(dt)

  if (shift.over || airframe.needsRepair) {
    winch.update(false, dt)
    return
  }

  const command = copilotSeat.poll()
  if (copilotSeat.taken !== seatTaken) {
    seatTaken = copilotSeat.taken
    copilot.takenOver = seatTaken
    hud.flash(seatTaken ? 'PLAYER TWO HAS THE WINCH' : 'BRAM HAS THE WINCH')
    radio.say(announcer.ferret(seatTaken ? 'takeover' : 'handback'))
  }

  const going = rescue.carrying ? null : rescue.recommended(helicopter.position)
  const threatened = rescue.mostThreatened()
  const orders = copilot.orders({
    takenOver: copilotSeat.taken,
    carrying: rescue.carrying !== null,
    overAnimal: !!going && Math.hypot(going.site.x - helicopter.position.x, going.site.z - helicopter.position.z) <= WINCH_REACH,
    heightAboveAnimal: going ? helicopter.position.y - going.site.y : Infinity,
    speed: helicopter.speed,
    hasWater: tank.hasWater,
    overThreateningFire:
      !!threatened &&
      rescue.threatTo(threatened) < WATER_WORTH_IT &&
      world.fire.intensityAt(helicopter.position.x, helicopter.position.z) > 0.2,
  })

  const wantsWinch = copilotSeat.taken ? command.winch : orders.lowerWinch
  const paying = winch.isStowed && wantsWinch
  winch.update(wantsWinch, dt)
  if (paying) radio.say(announcer.ferret('winchReady'))

  const wantsWater = copilotSeat.taken ? command.water : orders.dropWater
  if (wantsWater && waterCooldown.tryFire()) dropWater(ground)
  waterCooldown.advance(dt)

  if (!rescue.carrying && going && ferretChatter.tryFire()) {
    radio.say(announcer.ferret(Math.random() < 0.6 ? 'spotted' : 'idle', going.animal.name))
  }
}

/** A load of water on the fire below, if there is any left. */
function dropWater(ground: number): void {
  if (!tank.drop()) {
    radio.say(announcer.ferret('dry'))
    return
  }
  const knocked = world.fire.douse(helicopter.position.x, helicopter.position.z, DROP_RADIUS)
  world.waterDrop.release(helicopter.position.x, helicopter.position.y - 2, helicopter.position.z, ground, DROP_RADIUS)
  soundscape?.effects.foliage()
  hud.flash(knocked > 0 ? 'WATER AWAY — FIRE KNOCKED BACK' : 'WATER AWAY')
  radio.say(announcer.ferret('watered'))
}

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

  // Sitting on the base pad puts it right, and fills the tank.
  const onBase = helicopter.isOnGround && world.rescuePad.covers(helicopter.position)
  if (onBase) tank.refill(dt)
  if (airframe.needsRepair && onBase) {
    airframe.repair()
    hud.flash('REPAIRED — BACK IN THE AIR')
    radio.say(announcer.repaired())
  }
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
      radio.say(announcer.scolded(rescue.carrying.animal))
    } else {
      radio.say(announcer.treetops())
    }
  }
}

/** Let whoever is judging comment on the flying — unless the Chief is flying. */
function judgeFlying(dt: number): void {
  handling.setFussiness(rescue.carrying ? rescue.carrying.animal.fussiness : CHIEF_FUSSINESS)
  const rough = handling.update(helicopter, dt)
  if (!rough || airframe.needsRepair || shift.over) return

  // A knock costs a little paint as well as a telling-off.
  if (rough !== 'steep-bank') airframe.scuff()

  if (rescue.carrying) {
    rescue.scold()
    radio.say(announcer.scolded(rescue.carrying.animal))
    return
  }
  const line = announcer.chiefOnRoughFlying(rough)
  if (line) radio.say(line)
}

/** The Chief flags an animal the fire is about to reach — once per animal. */
function warnOfFire(): void {
  const threatened = rescue.mostThreatened()
  if (!threatened || flagged.has(threatened)) return
  flagged.add(threatened)
  radio.say(announcer.fireClosingOn(threatened.animal))
}

/** Time. Freeze the controls, show the card, let the Chief have the last word. */
function endShift(): void {
  const detail = rescue.rescued === 0
    ? 'nobody came home — next time, follow the amber flares'
    : `paint at ${Math.round(airframe.integrity * 100)}%`
  hud.showShiftEnd(rescue.score, rescue.rescued, detail)
  hud.flash('SHIFT OVER')
  radio.say(announcer.shiftOver(rescue.rescued))
}

/** Dress each body and flare as the animal now at that spot, and the beacon as the one you are going for. */
function presentAnimals(): void {
  rescue.waiting.forEach((w, i) => {
    world.waitingAnimals[i]?.applyLook(w.animal.look)
  })
  if (rescue.carrying) world.animal.applyLook(rescue.carrying.animal.look)
  const going = rescue.carrying ? null : rescue.recommended(helicopter.position)
  if (going) soundscape?.beacon.setCall(going.animal.call)
}

/**
 * Draw every animal where it is: waiting out in the landscape with a flare
 * over it, or slung under the helicopter. A slung load hangs below the skids,
 * so it is only drawn once the helicopter is high enough for it to clear the
 * ground — which means it appears as you lift off and tucks away as you settle.
 */
function placeAnimals(): void {
  world.waitingAnimals.forEach((model, i) => {
    const w = rescue.waiting[i]
    const flare = world.flares[i]
    if (!w) {
      model.setVisible(false)
      flare.setVisible(false)
      return
    }
    model.setScale(WAITING_SCALE)
    model.moveTo(PLACE.set(w.site.x, w.site.y, w.site.z))
    model.setVisible(true)
    flare.moveTo(w.site)
    flare.setVisible(true)
  })

  if (rescue.carrying) {
    world.animal.setScale(CARRY_SCALE)
    const slingDrop = world.animal.height + SKID_CLEARANCE
    const slungY = helicopter.position.y - slingDrop
    world.animal.moveTo(PLACE.copy(helicopter.position).setY(slungY))
    world.animal.setVisible(slungY > world.terrain.heightAt(helicopter.position.x, helicopter.position.z))
  } else {
    world.animal.setVisible(false)
  }
}

function standingStatus(landedPad: LandingPad | null): string {
  if (shift.over) return 'SHIFT OVER — PRESS R TO FLY AGAIN'
  if (airframe.needsRepair) return `AUTOPILOT — ${autopilot.phase.toUpperCase()} TO BASE`
  if (landedPad) return `LANDED — ${landedPad.label.toUpperCase()}`
  if (rescue.carrying) return `CARRYING ${rescue.carrying.animal.name.toUpperCase()}`
  // Controller-only players never press a key, so tell them sound is waiting on one.
  if (!audio.started) return 'PRESS ANY KEY OR CLICK TO START THE SHIFT'
  const going = rescue.recommended(helicopter.position)
  return going ? `${going.animal.name.toUpperCase()} IS WAITING ON ${going.site.label.toUpperCase()}` : ''
}

/**
 * Tell the player what to do and where to go: the objective panel, the compass
 * and the on-screen markers all read from the same guidance.
 */
function guide(): void {
  const homeward = rescue.carrying !== null || airframe.needsRepair
  const going = homeward ? null : rescue.recommended(helicopter.position)
  const focus = rescue.carrying ?? going
  const threatened = rescue.mostThreatened()

  const targetX = homeward ? world.rescuePad.position.x : (going?.site.x ?? world.rescuePad.position.x)
  const targetZ = homeward ? world.rescuePad.position.z : (going?.site.z ?? world.rescuePad.position.z)
  const targetY = homeward ? world.rescuePad.position.y : (going?.site.y ?? world.rescuePad.position.y)
  const dx = targetX - helicopter.position.x
  const dz = targetZ - helicopter.position.z
  const range = Math.hypot(dx, dz)
  const overTarget = homeward
    ? world.rescuePad.covers(helicopter.position)
    : range <= PICKUP_REACH

  const guidance = guidanceFor({
    animalName: focus?.animal.name ?? 'anyone',
    species: focus?.animal.species ?? '',
    siteLabel: going?.site.label ?? '',
    carrying: rescue.carrying !== null,
    needsRepair: airframe.needsRepair,
    onGround: helicopter.isOnGround,
    overTarget,
    range,
    heightAboveTarget: helicopter.position.y - targetY,
    speed: helicopter.speed,
    othersWaiting: rescue.carrying ? rescue.waiting.length : Math.max(0, rescue.waiting.length - 1),
    fireClosingOn: threatened?.animal.name ?? null,
    shiftOver: shift.over,
    closingSeconds: shift.closing ? shift.remaining : null,
  })
  hud.setObjective(guidance.task, guidance.hint, guidance.target)

  // The heading that would put the nose on the target, minus where it is now.
  const bearing = Math.atan2(-dx, -dz) - helicopter.heading
  hud.setCourse(Math.atan2(Math.sin(bearing), Math.cos(bearing)), range)

  // One marker per animal out there; going home, one marker for the base.
  const width = window.innerWidth
  const height = window.innerHeight
  const insets = hudInsets(width, height)
  if (homeward) {
    MARKER_AT.copy(world.rescuePad.position).setY(world.rescuePad.position.y + MARKER_HEIGHT)
    markers[0].emphasise(true, false)
    markers[0].update(MARKER_AT, world.camera, width, height, `BASE  ${Math.round(range)}m`, insets)
    for (let i = 1; i < markers.length; i++) markers[i].hide()
    return
  }
  markers.forEach((marker, i) => {
    const w = rescue.waiting[i]
    if (!w) { marker.hide(); return }
    const distance = Math.hypot(w.site.x - helicopter.position.x, w.site.z - helicopter.position.z)
    MARKER_AT.set(w.site.x, w.site.y + MARKER_HEIGHT, w.site.z)
    marker.emphasise(w === going, w === threatened)
    marker.update(MARKER_AT, world.camera, width, height, `${w.animal.name.toUpperCase()}  ${Math.round(distance)}m · ${w.credit}pt`, insets)
  })
}

/**
 * How much of each screen edge the HUD panels occupy, measured from the real
 * boxes, so pinned markers stay out from under them at any text size.
 */
function hudInsets(width: number, height: number) {
  const objective = HUD_PANELS.objective.getBoundingClientRect()
  const stack = HUD_PANELS.rightStack.getBoundingClientRect()
  const hint = HUD_PANELS.hint.getBoundingClientRect()
  const radio = HUD_PANELS.radio.getBoundingClientRect()
  // The panels along the top and bottom span most of the width, so treat
  // them as full-width bands rather than trying to route markers between them.
  return {
    top: Math.max(objective.bottom, stack.bottom),
    bottom: height - Math.min(hint.top, radio.top),
    left: 0,
    right: 0,
  }
  void width
}

const HUD_PANELS = {
  objective: document.getElementById('objective')!,
  rightStack: document.getElementById('right-stack')!,
  hint: document.getElementById('controls-hint')!,
  radio: document.getElementById('radio')!,
}

// Reused so the render loop is not allocating a vector every frame.
const PLACE = new THREE.Vector3()
const MARKER_AT = new THREE.Vector3()
/** How far up the flare the on-screen marker rides. */
const MARKER_HEIGHT = 22
/** Integrity lost per second of dragging through a canopy. */
const TREE_DAMAGE = 0.08
/** Matches Rescue: land within this of the animal and it counts. */
const PICKUP_REACH = 13
/** Matches Rescue: how far off the animal the hook can be. */
const WINCH_REACH = 11
/** Fire this close to an animal is worth spending water on. */
const WATER_WORTH_IT = 90
/** Trees are re-checked for catching alight at this interval, not every frame. */
const burnCheck = new Cooldown(0.4)
/** And a load of water cannot be dropped faster than this. */
const waterCooldown = new Cooldown(1.2)
// Small enough to look like wildlife next to the helicopter rather than a
// rival vehicle, while still readable from the chase camera.
const WAITING_SCALE = 0.8
const CARRY_SCALE = 0.55
/** The skids reach about 1.55 below the helicopter; the load hangs a little clear of them. */
const SKID_CLEARANCE = 1.0
/** Matches the flight model: how far the skids hold the hull off the ground. */
const SKID_HEIGHT = 2
