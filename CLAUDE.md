# Animal Rescue

## North star

**You are the only thing between a panicking animal and the fire — the game is
the moment you drop in low, get it aboard, and haul out with the smoke closing in.**

Everything is judged against that moment. Flight exists to make the drop-in
tense; the fire exists to put a clock on it; the animals exist to be worth
saving. A feature that does not sharpen that moment does not belong.

And the player should *want* to save them: the animals have names and
personalities, and you know who is waiting down there.

## Design direction

Set after the first playable loop, from the owner's notes. These steer every
later layer.

- **Non-violent.** Drama without deadly violence. Fire is a clock and a wall,
  never a killer; nothing is hurt on screen. Stakes come from time, awkward
  landings, and disappointing someone.
- **Named animals with personalities.** Each has a name, a look, a voice and a
  temperament. Adorable ones are high value — and prima donnas who scold you
  for rough treatment (a hard landing, a steep bank with them slung). Funny,
  distinct sound effects per animal.
- **The Chief.** A Zootopia-style boss on the radio who cares intensely about
  the helicopter's paint job. Comic pressure, never cruelty.
- **Pickups are places, not pads.** Animals wait at landscape locations — a
  clearing, a ridge, a riverbank, the edge of the fire line — each with its
  own landing difficulty. Only the rescue base is a pad.
- **Cinematic sound.** Space, weather and drama in the mix, not just cues.
- **The fiery landscape is where this is going.**

## Platform

Web-first, built with TypeScript + Three.js + Vite.

- **Sharing is a URL.** `npm run build` produces static files that host anywhere.
  `.github/workflows/pages.yml` publishes them to GitHub Pages on every push
  to `main`, after the tests pass, at `https://<owner>.github.io/<repo>/`. The
  workflow sets `VITE_BASE` from the repository name so the sub-path resolves;
  locally the base stays `/`.
- **Steam stays open.** The intended path is an Electron wrapper plus
  `steamworks.js` if it ever gets there. That is a *later* layer — do not add
  Electron, packaging, or store plumbing until the game is worth selling.

## Method: Layered Development

Build like a growing thing: smallest runnable seed first, one layer at a time,
always keeping working, shippable code.

1. **Blank Screen** — smallest thing that runs. ✅ done
2. **First Breath** — a helicopter you can fly. ✅ done
3. **Grow by Observation** — let the running game say what is next. ← current
4. **Polish** — improve what already works.

Rules that follow from it:

- **Solve the problem in front of you.** Not the imagined one three steps out.
- **Run it after almost every change** and look at what actually happened.
  Tune numbers against the screen, never against imagination.
- **Never let the tree go red.** Working code at every step.
- **One feature at a time.** A big feature is a stack of small proven
  increments, not one generation.

## Code style

- **Validate every change with passing unit tests.** Run `npm test` before
  calling anything done. This rule outranks the rest.
- **Separate the brain from the body.** Game logic — flight model, animal
  behavior, fire spread, scoring — goes in plain modules that never import a
  renderer, so it can be tested with no browser and no GL context. The Three.js
  layer stays dumb: it reads state and draws it.
- **A bug found by running becomes a permanent test,** not just a fix.
- **Never verify a feature by calling its own function.** Twice now that hid a
  dead wire: the forest never burned in play because `burnCheck.advance(dt)`
  returns `void` and so was always falsy, and the check had called
  `world.burnTrees()` by hand. `Cooldown.due(dt)` exists so that shape cannot
  be got wrong again. Drive the real loop and read the state it produced.
- **Test the increment, not the jump cut.** The ground scar passed a test that
  aged the fire in one step and was nearly invisible in play, because the burn
  actually creeps: every vertex is first reached at the rim, where the falloff
  is nil. Step the world the way the game steps it.
- **Never share a scratch object with a value you mean to keep.** `FireField`
  used one `Object3D` both to place each flame and as the "put this slot away"
  matrix, so the first flame drawn each frame *became* the hidden matrix and
  every unused slot drew a copy of it stacked on one spot. Constants that mean
  something get their own object.
- **`Matrix4.decompose` reports a scale of (1,1,1) for a degenerate matrix.**
  A slot scaled to nothing therefore comes back through it looking like a
  full-sized instance at the origin. Read the matrix elements when a test
  needs to know what is actually drawn.
- **Object-oriented, one class per file.** Filename matches the class.
- **TypeScript strict.** No `any` without a comment earning it.
- Comments explain *why*, not *what*. Constants live at the bottom of the file.

## Controls

Arcade helicopter, not a simulator. Input sets a target lean, the lean eases
in, and thrust comes from the lean — so it tips before it goes and drifts when
released. Forward is wherever the nose points; the chase camera swings round
behind the tail with a little lag.

Two sticks, one per hand — the same on keyboard and controller. The left
hand is the collective and the pedals; the right hand is the cyclic.

| | Keyboard | Controller (standard layout) |
|---|---|---|
| climb / descend (collective) | `W` / `S` | left stick up / down, or `RT` / `LT` |
| turn (yaw) | `A` / `D` | left stick left / right, or `LB` / `RB` |
| nose down / up (forward / back) | `↑` / `↓` | right stick up / down |
| slide (roll) | `←` / `→` | right stick left / right |

Top speed is about 46 units a second and the collective moves you about 18 a
second flat out. Browsers only list a controller once a button on it has been
pressed; the HUD flashes its name when it comes live.

Both devices are live at once and sum, clamped to full deflection. On the
ground the skids grip: you lift off before you can move. The four axes are
`FlightInput`; the feel lives in the constants at the bottom of `Helicopter.ts`.

## The world

840 x 840 units of procedural land (`Terrain.ts`) — rolling hills, a winding
canyon cut through them, and a conifer forest. It is a pure function of
position: the same coordinates always give the same height, so there is no
seed file and nothing to load. `TerrainMesh` is only its picture; the flight
model asks `heightAt` for the ground under the helicopter each frame, so the
skids settle on a hilltop as readily as in the valley.

The base pad is placed by *searching* the hills rather than by hard-coded
numbers: `World.levelSpot` finds the lowest landable, canyon-free ground near a
rough location, levels a shelf there, and blends it back into the slope. It
sits in the sheltered -x corner, as far from the fire's edge as the map allows.
A HUD compass — a dial with a fixed mark for the nose, a needle, and the *name*
of what it is pointing at — gives the course and the range, because at this
size the target is well past the fog.

`TreeCover` decides where the trees are — scattered deterministically and
rejected on steep ground, above the treeline, in the canyon, and inside
clearings, which is what leaves natural landing spots rather than a uniform
carpet. `Forest` is only its picture (four draw calls), so what you can see and
what you can hit are by construction the same forest. Strike lookups go through
a coarse grid, since asking several thousand trees every frame is otherwise the
most expensive thing in the game.

They are firs, not cones. A tree is a bare trunk with a crown of drooping
branch tiers on top (`ConiferCrown`, one merged geometry, instanced), and the
crown grows *more slowly than the trunk* — so a big tree carries its needles in
the top third and is a bare pole below that, as the real ones are. Striking one
is wide up in the branches and narrow down the trunk, because dropping between
two trunks should not snag on branches ten metres overhead.

The trunks carry redwood bark (`BarkTexture`): noise stretched hard along the
trunk, so it reads as long vertical fibres and flutes rather than fuzz, deep
red-brown on the ridges and nearly black in the grooves. The instance colour is
plain white on an unburnt tree, so the wood is entirely the map and charring is
simply a matter of multiplying it darker. The boulders get the same treatment
from `StoneTexture`. Both are built as `DataTexture` from plain arrays, not
from a canvas — the world has to construct in a Node test with no DOM.

Flying into the canopy drags hard (about 27 m/s down to 5), costs paint, throws
a shower of needles and bark (`Debris`), and gets you shouted at. It never
destroys you — you can always climb back out.

## Fire and damage

A front of burning patches (`Fire.ts`) sweeps in from one edge of the map and
is driven across it by the wind. It **travels**: new patches catch only at the
*leading edge*, and only from whichever leading patch has thrown fewest embers,
so the line advances along its whole width instead of growing a tendril — and
patches that have eaten their fuel are retired, so the burn stays a front
rather than a spreading stain. Over a five-minute shift it crosses most of the
map and stops short of the base.

Everything alive is downwind of it, running ahead of it, and so is the base —
nobody is ever trapped behind the fire. Crossing it is the shortcut you take
when it has got ahead of you. Heat thins with height — the column reaches 85
above the ground — so climbing over is real but costly.

It reads as a *front* because it leaves a wake. A young patch burns right
through; an old one has eaten its middle and burns as a ring, so there is
flame at the edge, black behind it, and green ahead. Flame is never drawn on
ground another patch has already burnt through, or an overlapping pair reads
as one big blaze instead of a line with dead black behind it.

A tree does not switch from green to black. It has three states (`TreeState`)
and takes about eleven seconds, varied per tree so a stand does not all flip
on one frame:

- **green** — untouched.
- **burning** — black trunk, needles going green → dry gold → black, the crown
  eaten from the bottom up, and an additive ember cone climbing behind the
  retreating green. Three things at once, which is what a burning tree looks
  like and what makes the front legible from the air.
- **burnt** — a bare black stick. No crown, no fire in it.

`TreeCover` owns the states and keeps the burning ones on their own list, so
ageing them costs nothing per green tree; `Forest.setAlight` and `burnOut`
only draw them. `TerrainMesh.scorch` blackens the land inside the hollow.
All of it is driven from `World.burnTrees(dt)` every 0.4 s, not every frame.

**The air over it is the point.** `Fire.updraftAt` and `roughnessAt` are keyed
to `chimneyAt` — the whole burn plus a spill around it — not to `intensityAt`,
which is only the flame band. Keying them to the flame was the first attempt
and the weather was imperceptible, because most of a mature patch's *area* is
the cool hollow in the middle. Hovering over a fire now climbs at about 16
units per second and rocks the airframe some 20°. The rocking lives in
`Helicopter.shakePitch`/`shakeRoll`, separate from the flown attitude, and
`main.ts` adds the two when it draws: folded into `pitch`/`roll` the lean
easing quietly undid it every frame, so rough air moved the helicopter without
ever *looking* like it.

The fire you see is **particles**, not geometry. `FireParticles` keeps a pool
of sparks and is fed by two emitters: the burning crowns by preference — that
is where a crown fire is — and the flame band of each patch for ground the
trees have left. Each spark rises and is pushed sideways by a **Perlin flow
field** (`PerlinNoise`) sampled at its own current height, with the field
sliding downward through the sparks over time. That is the whole trick: because
every spark reads the same field, neighbours are pushed the same way at the same
moment and the column *twists together* — it braids, leans and shears off as one
thing. Sparks given independent random drift look like confetti.

This replaced cones. Cones were flickered, recoloured, stacked and tuned, and
from the air a mature front still looked like a field of traffic cones, because
a cone has a hard silhouette and fire has none. `FireField` is now only the
smoke column and the handful of lights the fire throws on the hills.

Two things about blending, both learned the hard way. **Nothing in the fire is
additive**: the sky here is a bright pale blue and adding to it saturates green
and blue immediately, so every flame on the skyline came out white. And nothing
in the fire takes **fog**, because fog mixes a fragment toward the sky colour
*before* the blend, which turned the far end of the fire line into pale blue
splinters.

A crown that has caught is not green and not gold — it is bright yellow-orange,
deepening as it is eaten and going dark only at the very end. Scorching the
needles gently through autumn colours was the first attempt and a stand in the
middle of catching read as autumn rather than as being on fire.

Burning crowns are drawn in a **second instanced mesh with an unlit material**,
and taken out of the lit one. Branches on fire are a light source, not a lit
surface: they should be flat and fully bright whichever way they face, and the
sun has no business putting a shaded side on a fire. A material is lit or unlit
for every instance sharing it, so a tree lives in the lit mesh while it is green
and again once it is a black snag, and in the unlit one for the eleven seconds
in between. It must leave the lit mesh when it moves, or it is drawn twice and
the shaded copy shows through.

Fire harms only the machine, never anything alive. `Airframe` tracks integrity:
about four seconds in the flames wrecks it, and knocks cost a little paint.

**Nothing repairs inside a shift, and nothing is ever taken away from the
pilot.** Damage buys a worse helicopter for the rest of the round — down to 55%
thrust and climb, a judder that grows with the square of the damage, and an
engine that drops in pitch, surges and grinds (`rotorTargets` takes the
condition). A wreck still flies, and putting it down on the base pad is how the
player *chooses* to end the shift. That is the whole economy: every detour
through the flames is a withdrawal from a balance that cannot be topped up, and
the pilot decides when to cash in what is left.

The judder lives in `Helicopter.rattlePitch`/`rattleRoll` — separate again from
both the flown attitude and the rough-air shake, and for the same reason;
`main.ts` adds all three when it draws. (`Autopilot.ts` is still in the tree but
is no longer wired to anything: nothing takes the controls now.)

## The loop so far

A five-minute **shift** (`Shift.ts`), started by the first key press. Three
named animals from the roster (`AnimalProfile.ts`) wait out in the landscape at
once, and **every one of them stands in the fire's path** — downwind of the
leading edge, with the front coming for them. `SiteFinder.findAhead` places them
in three bands of distance from the flames (about 55, 150 and 300 m), so there
is always someone with smoke over them and someone still out in the green, and
a real choice about who to spend the time on. The terrain kind is then whatever
that spot happens to be — a clearing, a hilltop, the canyon floor, a ridge
shelf, the edge of the fire — and that is where its landing difficulty and its
name come from. An amber flare stands
over each one and an on-screen marker names it with range and points; the one
the fire is closest to is flagged, and the guidance sends you there first.

Land within 13 m of an animal to take it aboard; land on the blue base pad to
deliver it for its credit, plus **quick +2** for beating a brisk direct flight
and **gentle +1** for a soft touchdown. A fresh animal takes its place, so
there are always three to choose between. The fire **spreads** (`Fire.advance`)
downwind toward them; any animal it reaches **bolts** to a new spot — never
hurt, just harder to catch, and a point less patient. When the shift ends — on the
clock, or when a write-off is landed at base — the card shows the score, and
`R`, or **Start** on any controller, flies another. Another shift is a **reset
in place**, not a page reload: the fire relights, the forest regrows, the ground
unscorches. Reloading was the old answer and it cost the sound, because a fresh
page has to wait for a gesture before a browser will make any.

Flying roughly costs you. `Handling` watches the flight model for a hard
touchdown, a held steep bank, or a bump against the edge, with thresholds set
by whoever is judging: the passenger's fussiness while carrying (Duchess
objects to a full-stick slide; Gus sleeps through a banked turn), or the
Chief's when empty. Each scolding docks a point of that animal's credit, never
below one. `Announcer` turns events into radio lines from the profiles, cycling
variants; `RadioPanel` shows them and `VoiceBlips` gives each speaker an
Animal-Crossing-style blip voice. The rules live in `Rescue`, which is told
where the helicopter landed and how hard, and decides whether anything
happened — so calling it every frame while parked is harmless.

## Reading the ground

Two things exist only so the world is legible from a chase camera:

- **`GroundShadow`** — the helicopter's own shadow, sun taken as directly
  overhead. It is a ring of vertices re-laid on the terrain every frame, not a
  flat disc, because a flat disc buries half of itself in any slope worth
  landing on. It spreads and fades with height, so the last ten metres of a
  descent — the hardest judgement in the game — can be flown by watching it.
- **`Plain`** — a vast flat brown plain at the altitude of the lowest ground
  (`Terrain.lowestPoint`), hidden under the hills everywhere they exist and
  taking over exactly where they stop. Without it the edge of an 840-metre world
  is a cliff into the sky, visible from any height, and the horizon is a straight
  line of nothing. It sits a couple of metres low, because the lowest point is a
  *sampled* answer and anything poking through shows as a brown patch in the
  canyon floor.

## Sound

All procedural Web Audio — no sample files, nothing to load. Lives in
`src/audio/`, driven once per frame by `Soundscape` from the flight model and
the rescue state; it reads, never decides.

- **Rotor** (`RotorSound`) — sawtooth drone + noise wash, chopped by a
  blade-pass LFO, plus a faint turbine whine. Pitch, chop rate, brightness and
  volume all follow `Helicopter.effort`, so climbing, leaning and turning
  audibly work harder. `rotorTargets()` is the pure mapping; tune it there.
- **Animal beacon** (`AnimalBeacon`) — the waiting animal bleats every 1.8 s
  through an HRTF panner at its position, with the listener at the helicopter
  facing its heading. Direction and distance by ear. Silent while carrying.
- **Voices** (`RadioVoice`) — lines are *read aloud* by the browser's speech
  synthesiser, with each character's blip profile mapped to a pitch and a pace
  (`speechFor`) and pinned to one of the installed voices by a hash of their
  name. Speech bypasses the AudioContext, so the master volume has to be applied
  to each utterance by hand and the ducking driven from its own start and end
  events. Where there is no speech synthesis, `VoiceBlips` still does the old
  Animal-Crossing blips — and the choice is made once at construction, because a
  session that alternates between the two sounds broken.
- **One-shots** (`SoundEffects`) — pickup chirps, delivery run + bell,
  touchdown thud, and a knock when pushed back by the field edge or ceiling
  (on a cooldown so it cannot machine-gun). Dragging through a canopy is paced
  from the rotor instead of a fixed cooldown: `RotorSound.bladeHz` is the
  blade-pass rate the drone is already chopping at, and the canopy is torn at a
  multiple of it, so the thrashing is in step with the blades and slows with a
  failing engine. Each hit is short — at sixteen a second the old
  quarter-second bursts overlapped four deep and turned into flat noise, and a
  crack you can hear the end of is what makes a repeat audible as one.
- **Space** (`Reverb`) — a synthesized outdoor impulse response on a send
  bus. The animal's call echoes hardest, one-shots ring, the rotor gets air.
- **Wind** (`WindSound`) — a gusting, drifting noise bed that is silent on the
  ground and grows with *height above the ground* and speed, so it doubles as
  an altimeter. `windTargets()` is the pure mapping. It is kept under the
  rotor at all times: a loud bed that swells reads as the sound cutting out.
- **Fire** (`FireSound`) — a crackling roar that swells within 170 m of the
  flames, so you hear the fire before you see it.
- **Radio ducking** (`Ducker`) — the beds dip to 55% while someone talks, for
  the blips' length plus a beat. Deeper and longer than that was heard as the
  engine cutting out.

Mix balance matters more than any single sound: the first play-test "sound
cut out after pickup" was the parked rotor being too quiet next to a loud
close-up call. `AudioEngine.level` reads the real output for checking this.

Browsers refuse audio before a gesture, so `AudioEngine` starts on the first
key or click and the HUD says so until then. In dev builds `window.__animalRescue`
exposes the engine, soundscape, helicopter and controls so a browser-driving
test can put an analyser on the master bus and listen.

## Commands

| | |
|---|---|
| `npm run dev` | dev server with hot reload |
| `npm test` | unit tests (must be green) |
| `npm run build` | typecheck + production build |

## Tools wired up

- **Playwright MCP** — drive the real browser to confirm the game renders and
  behaves. Unit tests passing is not proof the game works; look at it. Three of
  the worst bugs so far were invisible to every test and obvious in one
  screenshot: additive flames going white against a bright sky, markers piled on
  top of the HUD, and an end-of-shift card over a shift that had not ended.
- **Coach MCP** (`ericjorgensen.com/coach`) — the Layered Development method
  and lessons from past projects.
