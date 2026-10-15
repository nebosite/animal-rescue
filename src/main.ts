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
import { TargetMarker, type Box } from './ui/TargetMarker'
import { Airframe } from './game/Airframe'
import { Cooldown } from './game/Cooldown'
import { Campaign } from './game/Campaign'
import { HeatGauge } from './game/HeatGauge'
import { skyForLevel } from './game/TimeOfDay'
import { ROSTER } from './game/AnimalProfile'
import { rosterBoard } from './game/RosterBoard'
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
import { RestartInput } from './game/RestartInput'
import { Analytics } from './telemetry/Analytics'

const world = new World(ROSTER.length)
const helicopter = new Helicopter()
// Start on the base pad, which is wherever the hills put it.
helicopter.position.set(world.rescuePad.position.x, world.rescuePad.position.y + 8, world.rescuePad.position.z)

const controls = new Controls()
controls.attach(window)

const hud = new Hud(
  document.getElementById('status')!,
  document.getElementById('score')!,
  document.getElementById('controls-hint')!,
  document.getElementById('compass-needle')!,
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

const campaign = new Campaign()
const rescue = new Rescue(world.rescuePad, world.sites, world.fire, campaign.party)
// No clock any more: a level lasts until every animal is home or gone. Shift
// stays as the flag for "play is stopped, the card is up".
const shift = new Shift(Infinity)
/** True when the card up is the end of the run, not the gap between levels. */
let gameOver = false
const handling = new Handling()
const announcer = new Announcer()
const airframe = new Airframe()
const air = new Turbulence()
const copilot = new Copilot()
const copilotSeat = new CopilotInput()
copilotSeat.attach(window)
const winch = new Winch()
const tank = new WaterTank()
const heatGauge = new HeatGauge()
const restartInput = new RestartInput()
restartInput.attach(window)
/*
 * How often anyone is allowed to say anything.
 *
 * All of these were roughly twice as brisk, and with real voices reading the
 * lines aloud instead of blipping them the radio became something to talk over
 * rather than something to listen to. A joke you hear every six seconds is not
 * a joke. These are now spaced so a line is an event.
 */
const fireWarning = new Cooldown(9)
/** How often the spray is announced. */
const sprayAnnounce = new Cooldown(8)
const dryWarning = new Cooldown(10)
const treeWarning = new Cooldown(11)
const damageWarning = new Cooldown(20)
const ferretChatter = new Cooldown(26)
const ferretAlarm = new Cooldown(16)
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
  (line) => soundscape?.voice.speak(line.speaker, line.voice, line.text),
)

audio.onStart(() => {
  soundscape = new Soundscape(audio)
  presentAnimals()
  radio.say(announcer.welcome())
  radio.say(announcer.ferret('welcome'))
  underway = true
  analytics.event('game_start')
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
    campaign,
    world,
    airframe,
    shift,
    restartInput,
    winch,
    tank,
    heatGauge,
    copilot,
    copilotSeat,
    get soundscape() { return soundscape },
  }
}

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
// Filtered edges, because a hard-edged shadow of ten thousand needles is only noise.
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
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
world.setSky(skyForLevel(campaign.level))

renderer.setAnimationLoop(() => {
  timer.update()
  // Cap dt so a long stall cannot teleport the helicopter across the map.
  const dt = Math.min(timer.getDelta(), 0.1)

  if (underway && !shift.over) {
    world.fire.advance(dt)
    const lost = rescue.advance(dt)
    if (lost) {
      flagged.delete(lost)
      hud.flash(`${lost.animal.name.toUpperCase()} RAN FROM THE FIRE — GONE`)
      radio.say(announcer.bolted(lost.animal))
      presentAnimals()
    }
    warnOfFire()
  }

  const ground = world.terrain.heightAt(helicopter.position.x, helicopter.position.z)
  burn(ground, dt)

  // The pilot never loses the controls. Damage makes the machine worse —
  // slower, shakier, and audibly wrong — and the decision about when to take
  // what is left of it home stays the player's. When the shift is over the
  // controls simply go quiet.
  helicopter.condition = airframe.condition
  const flying = shift.over ? noInput() : controls.poll()
  helicopter.update(flying, dt, ground)
  flyThroughFire(ground, dt)
  clipTrees(dt)
  workTheCopilot(ground, dt)

  world.helicopter.moveTo(helicopter.position)
  // Three separate angles, added only here: the attitude the pilot flew, the
  // rocking the air is doing to it, and the judder of a broken machine. Folded
  // into each other, the lean easing quietly undoes the other two every frame.
  world.helicopter.setAttitude(
    helicopter.heading,
    helicopter.pitch + helicopter.shakePitch + helicopter.rattlePitch,
    helicopter.roll + helicopter.shakeRoll + helicopter.rattleRoll,
  )
  world.helicopter.spin(dt)
  world.shadows.follow(helicopter.position.x, ground, helicopter.position.z)
  // Sun straight overhead, so the shadow is directly below and its size is a
  // reading of height — which is most of what the last ten metres of a descent
  // needs and the chase camera cannot otherwise give.
  world.shadow.update(helicopter.position.x, helicopter.position.z, helicopter.altitudeAboveGround)
  world.follow(helicopter.position, helicopter.heading, dt)
  world.updateEffects(timer.getElapsed(), dt, helicopter.position)
  world.winchLine.update(helicopter.position, winch.length)
  // Burning the whole forest every frame is wasted work: the answer changes
  // only as the fire creeps.
  if (underway && !shift.over && burnCheck.due(dt)) world.burnTrees(BURN_STEP)

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
        const { animal, credited, bonuses, scolded, gentle } = rescue.lastDelivery!
        const extras = bonuses.length ? `  ·  ${bonuses.join('  ·  ')}` : ''
        hud.flash(`${animal.name.toUpperCase()} RESCUED!  +${credited}${extras}`)
        soundscape?.delivered()
        analytics.event('animal_rescued', { animal: animal.name, credit: credited })
        radio.say(announcer.delivered(animal, scolded, gentle))
        presentAnimals()
        break
      }
    }
  }

  // Checked after the delivery above, so the last animal home is credited.
  if (underway && !shift.over && rescue.levelOver) endLevel()

  // Bringing a write-off home is how a player chooses to stop.
  if (!shift.over && airframe.isWrecked && landedPad === world.rescuePad) endGame('wrecked')

  if (shift.over && restartInput.poll()) flyAnother()

  placeAnimals()
  guide()
  soundscape?.frame(helicopter, surroundings(), dt)
  radio.update(dt)
  noticeController()
  hud.showGamepad(controls.usingGamepad)
  hud.setIntegrity(airframe.integrity)
  hud.setCrew(winch.extended, tank.fraction, tank.loads, copilotSeat.taken)
  hud.setTemperature(heatGauge.temperature, heatGauge.spraying)
  hud.setClock(`LEVEL ${campaign.level}`, false)
  hud.setRoster(rosterBoard(ROSTER, rescue, campaign))
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

  if (shift.over) {
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

  // A person in the seat holds the hose (see `HeatGauge`); only Bram drops loads. The hose cools the machine and does not put the fire out — that is what loads are for.
  const wantsWater = !copilotSeat.taken && orders.dropWater
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

/**
 * Take fire damage, and nothing else: there are no repairs inside a shift.
 *
 * What the damage buys is a worse helicopter for the rest of the round, so the
 * whole back half of a shift is a judgement about how much more you are willing
 * to spend. Putting a wreck down on the pad is how you choose to stop.
 */
function burn(ground: number, dt: number): void {
  fireWarning.advance(dt)
  damageWarning.advance(dt)

  const wasFailing = airframe.isFailing
  const wasWrecked = airframe.isWrecked
  const altitude = helicopter.position.y - (ground + SKID_HEIGHT)
  const heat = world.fire.heatAt(helicopter.position.x, helicopter.position.z, altitude)

  // Flame heats the machine; water is what stands between that and the paint.
  const wasSpraying = heatGauge.spraying
  const reaching = heatGauge.advance(dt, { flameHeat: heat, manual: copilotSeat.taken, manualSpray: copilotSeat.command.water }, tank)
  sprayAnnounce.advance(dt)
  dryWarning.advance(dt)

  if (heatGauge.spraying) {
    if (!wasSpraying && sprayAnnounce.tryFire()) hud.flash('COOLING SPRAY ON')
  } else if (heatGauge.temperature > DRY_WARNING_AT && !tank.hasSpray && dryWarning.tryFire()) {
    hud.flash('TANK DRY — GET OUT OF THE FIRE')
    radio.say(announcer.ferret('dry'))
  }

  if (reaching > 0) {
    airframe.scorch(reaching, dt)
    if (fireWarning.tryFire()) radio.say(announcer.scorched())
  }

  if (airframe.isFailing && !wasFailing) {
    hud.flash('AIRFRAME FAILING — SHE WILL NOT TAKE MUCH MORE')
    radio.say(announcer.failing())
  }
  if (airframe.isWrecked && !wasWrecked) {
    hud.flash('AIRFRAME GONE — LAND AT THE RESCUE BASE TO END THE SHIFT')
    radio.say(announcer.wrecked())
  }
  // A standing reminder while flying a wreck about, since nothing will mend it.
  if (airframe.isWrecked && !helicopter.isOnGround && damageWarning.tryFire()) {
    radio.say(announcer.wrecked())
  }

  // The pad fills the tank. It does not mend anything.
  if (helicopter.isOnGround && world.rescuePad.covers(helicopter.position)) tank.refill(dt)
}

/**
 * Fly into the canopy and it drags, scrapes, costs paint — and throws a shower
 * of needles and branch past the canopy.
 *
 * The debris is the point of this function as much as the damage is. Mowing the
 * treetops is the commonest mistake in the game and it used to be the least
 * visible one: a noise, a number ticking down, and nothing on screen. Now you
 * can see what you did, and the Chief has something specific to be upset about.
 */
function clipTrees(dt: number): void {
  treeWarning.advance(dt)
  debrisBurst.advance(dt)
  if (helicopter.isOnGround) return

  const struck = world.treeCover.strikeAt(helicopter.position.x, helicopter.position.y, helicopter.position.z)
  if (!struck) return

  helicopter.strikeObstacle(dt)
  airframe.scuff(TREE_DAMAGE * dt)
  soundscape?.effects.foliage()

  // Thrown from where the rotor is actually in the tree, and carried along the
  // flight path — a tidy symmetrical puff at the trunk looks like an explosion
  // rather than like something being torn out of a canopy.
  if (debrisBurst.tryFire()) {
    world.debris.burst(
      helicopter.position.x,
      Math.min(helicopter.position.y, struck.top),
      helicopter.position.z,
      helicopter.velocity.x,
      helicopter.velocity.z,
    )
  }

  if (treeWarning.tryFire()) {
    // The Chief always hears it — it is his paint and his forest. A passenger
    // being thrown about objects as well, and that costs their credit.
    radio.say(announcer.treetops())
    if (rescue.carrying) rescue.scold()
  }
}

/** Let whoever is judging comment on the flying — unless the Chief is flying. */
function judgeFlying(dt: number): void {
  handling.setFussiness(rescue.carrying ? rescue.carrying.animal.fussiness : CHIEF_FUSSINESS)
  const rough = handling.update(helicopter, dt)
  if (!rough || shift.over) return

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

/**
 * Every animal on this level is home or gone. Somebody saved means the next
 * level, with them and one more; nobody means the run is over.
 */
function endLevel(): void {
  shift.end()
  const saved = [...rescue.saved]
  const cleared = campaign.level
  const outcome = campaign.finishLevel(saved, rescue.lost.map((w) => w.animal))
  analytics.event('level_end', { level: cleared, saved: saved.length, lost: rescue.lost.length, score: rescue.score })
  if (outcome === 'over') {
    endGame('lost')
    return
  }
  const news = campaign.party.filter((a) => !saved.includes(a))
  const detail = news.length
    ? `${news.map((a) => a.name).join(', ')} joins the next one`
    : 'the fire runs faster'
  hud.showShiftEnd(rescue.score, rescue.rescued, detail, `Level ${cleared} cleared`, `Press <b>R</b> &mdash; or <b>Start</b> &mdash; for level ${campaign.level}`)
  hud.flash(`LEVEL ${cleared} CLEARED`)
  radio.say(announcer.shiftOver(saved.length))
}

/** The run is over: every animal lost, or a write-off brought home. */
function endGame(why: 'lost' | 'wrecked'): void {
  // Idempotent: endLevel may already have stopped play before calling this.
  shift.end()
  gameOver = true
  const paint = `airframe at ${Math.round(airframe.integrity * 100)}%`
  const detail = why === 'wrecked'
    ? `${paint} — you brought the wreck home`
    : 'the fire got there first — next time, follow the amber flares'
  hud.showShiftEnd(rescue.score, rescue.rescued, detail, 'Game over', 'Press <b>R</b> &mdash; or <b>Start</b> &mdash; to start again')
  analytics.event('shift_end', { reason: why, score: rescue.score, rescued: rescue.rescued, level: campaign.level })
  hud.flash(why === 'wrecked' ? 'HELICOPTER WRITTEN OFF — GAME OVER' : 'GAME OVER')
  radio.say(announcer.shiftOver(rescue.rescued))
}

/**
 * Another shift, without reloading the page.
 *
 * Reloading was the old answer, and it cost the sound: a fresh page has to wait
 * for a gesture before a browser will let it make any, so the next shift ran in
 * silence until the player found the mute button and pressed it twice. Resetting
 * in place keeps the AudioContext, the speech voices and the whole mix alive
 * across the restart, which is the only reason this is worth the extra code.
 */
function flyAnother(): void {
  world.reset()
  world.fire.pace = campaign.firePace
  if (gameOver) {
    campaign.restart()
    world.fire.pace = campaign.firePace
    rescue.reset(campaign.party)
  } else {
    rescue.startLevel(campaign.party)
  }
  gameOver = false
  world.setSky(skyForLevel(campaign.level))
  shift.restart()
  airframe.repair()
  tank.fill()
  heatGauge.reset()
  winch.stow()
  flagged.clear()
  soundscape?.voice.silence()

  helicopter.position.set(world.rescuePad.position.x, world.rescuePad.position.y + 8, world.rescuePad.position.z)
  helicopter.velocity.set(0, 0, 0)
  helicopter.heading = 0
  helicopter.condition = 1

  hud.hideShiftEnd()
  hud.flash(`LEVEL ${campaign.level} — GO`)
  presentAnimals()
  radio.say(announcer.welcome())
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
  if (shift.over) return gameOver ? 'GAME OVER — PRESS R OR START TO PLAY AGAIN' : `LEVEL CLEARED — PRESS R OR START FOR LEVEL ${campaign.level}`
  if (airframe.isWrecked) return 'AIRFRAME GONE — LAND AT BASE TO END THE SHIFT'
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
  const homeward = rescue.carrying !== null || airframe.isWrecked
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
    wrecked: airframe.isWrecked,
    failing: airframe.isFailing,
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
  const pointingAt = homeward ? 'RESCUE BASE' : (going?.animal.name.toUpperCase() ?? 'RESCUE BASE')
  hud.setCourse(Math.atan2(Math.sin(bearing), Math.cos(bearing)), range, guidance.target, pointingAt)

  // One marker per animal out there; going home, one marker for the base.
  const width = window.innerWidth
  const height = window.innerHeight
  const panels = hudPanels()
  if (homeward) {
    MARKER_AT.copy(world.rescuePad.position).setY(world.rescuePad.position.y + MARKER_HEIGHT)
    markers[0].emphasise(true, false)
    markers[0].update(MARKER_AT, world.camera, width, height, `BASE  ${Math.round(range)}m`, panels)
    for (let i = 1; i < markers.length; i++) markers[i].hide()
    return
  }
  markers.forEach((marker, i) => {
    const w = rescue.waiting[i]
    if (!w) { marker.hide(); return }
    const distance = Math.hypot(w.site.x - helicopter.position.x, w.site.z - helicopter.position.z)
    MARKER_AT.set(w.site.x, w.site.y + MARKER_HEIGHT, w.site.z)
    marker.emphasise(w === going, w === threatened)
    marker.update(MARKER_AT, world.camera, width, height, `${w.animal.name.toUpperCase()}  ${Math.round(distance)}m · ${w.credit}pt`, panels)
  })
}

/**
 * Where the HUD panels actually are this frame, as rectangles for the markers
 * to keep off.
 *
 * Measured rather than assumed, because every size in the interface is a
 * multiple of one scale factor and the panels grow and shrink with what is in
 * them — the objective text alone is three lines some of the time and one the
 * rest of it.
 */
function hudPanels(): Box[] {
  return HUD_PANELS.map((panel) => {
    const box = panel.getBoundingClientRect()
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom }
  })
}

const HUD_PANELS = [
  document.getElementById('objective')!,
  document.getElementById('right-stack')!,
  document.getElementById('bottom-left')!,
  document.getElementById('radio')!,
  document.getElementById('status')!,
]

/**
 * Anonymous usage counts: how many play, how far they get, how a shift ends.
 * Only a production build reports; development and tests send nothing.
 */
const MEASUREMENT_ID = 'G-1BKFJPXQYE'
const analytics = import.meta.env.PROD ? Analytics.load(MEASUREMENT_ID) : Analytics.off()

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
/**
 * How often dragging through a canopy throws another shower of debris. Short
 * enough that a long scrape is a continuous spray, long enough that it is not
 * one burst per frame.
 */
const debrisBurst = new Cooldown(0.18)
/** Trees are re-checked for catching alight at this interval, not every frame. */
const BURN_STEP = 0.4
const burnCheck = new Cooldown(BURN_STEP)
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

/** A hot machine with an empty tank is worth a warning from here. */
const DRY_WARNING_AT = 0.6
