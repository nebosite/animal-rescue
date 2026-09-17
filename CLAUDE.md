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
- **Object-oriented, one class per file.** Filename matches the class.
- **TypeScript strict.** No `any` without a comment earning it.
- Comments explain *why*, not *what*. Constants live at the bottom of the file.

## Controls

Arcade helicopter, not a simulator. Input sets a target lean, the lean eases
in, and thrust comes from the lean — so it tips before it goes and drifts when
released. Forward is wherever the nose points; the chase camera swings round
behind the tail with a little lag.

Laid out like the real thing: the arrows are the cyclic, `Q`/`E` are the
anti-torque pedals, and `A`/`Z` are the collective — two stacked keys under
the left hand.

| | Keyboard | Controller (standard layout) |
|---|---|---|
| nose down / up (forward / back) | `W` `S` or `↑` `↓` | left stick up / down |
| slide (roll) | `←` `→` | left stick left / right |
| turn (yaw) | `Q` `E` | right stick, or `LB` `RB` |
| climb / descend (collective) | `A` or `CapsLock` / `Z` or `Shift` | `RT` / `LT` |

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

Pads are placed by *searching* the hills rather than by hard-coded numbers:
`World.levelSpot` finds the highest (or lowest) landable, canyon-free ground
near a rough location, levels a shelf there, and blends it back into the
slope. The base sits low, the pickup high, about 645 units apart — a real
flight. A HUD compass and range point at whichever you need next, because at
this size the target is well past the fog.

`TreeCover` decides where the trees are — scattered deterministically and
rejected on steep ground, above the treeline, in the canyon, and inside
clearings, which is what leaves natural landing spots rather than a uniform
carpet. `Forest` is only its picture (two draw calls), so what you can see and
what you can hit are by construction the same forest. Strike lookups go through
a coarse grid, since asking several thousand trees every frame is otherwise the
most expensive thing in the game.

Flying into the canopy drags hard (about 27 m/s down to 5), costs paint, and
gets you shouted at. It never destroys you — you can always climb back out.

## Fire and damage

A front of burning patches (`Fire.ts`) lies across the run between the pads,
so every trip is a decision: go round, or climb over. Heat thins with height —
the column reaches 85 above the ground — so climbing over is real but costly.

Fire harms only the machine, never anything alive. `Airframe` tracks integrity:
about three seconds in the flames wrecks it, with a second or so of warning
first, and knocks cost a little paint. Below a quarter the pilot loses the
controls and `Autopilot` flies it home — climb, cruise, land — and the base pad
repairs it. The autopilot emits ordinary `FlightInput`, so it flies through the
same flight model with no special cases, and is tested by simply letting it fly
from anywhere on the map and seeing where it ends up.

## Guidance

A map this size with a small animal in it is unplayable without being told
where to go — the first play-test was a minute of flying around finding
nothing. Three things fix it, all reading from one source:

- **`Objective.guidanceFor()`** — a pure function turning the situation into a
  task and a hint ("Find Pip the fox kit" / "You are over the pad — hold Z to
  come down (45 m up)"). Every branch is unit tested. Shown top-left.
- **`Beacon`** — a pillar of light over each pad, exempt from fog so it is
  visible from across the map, fading out up close so it does not become a wall
  across the view when you are standing on it. The ground ring stays: that is
  what you aim the skids at.
- **`TargetMarker`** — an on-screen pointer that sits on the target when in
  view and pins to the edge pointing the way when it is not.

## The loop so far

A named animal from the roster (`AnimalProfile.ts`) waits at the amber pickup
pad, calling in its own voice. Land there to take it aboard, fly to the blue
rescue pad, and land again to deliver it for its value in points. The next
animal is waiting immediately, in roster order, so the loop repeats.

Flying roughly costs you. `Handling` watches the flight model for a hard
touchdown, a held steep bank, or a bump against the edge, with thresholds set
by whoever is judging: the passenger's fussiness while carrying (Duchess
objects to a full-stick slide; Gus sleeps through a banked turn), or the
Chief's when empty. Each scolding docks a point of that animal's credit, never
below one. `Announcer` turns events into radio lines from the profiles, cycling
variants; `RadioPanel` shows them and `VoiceBlips` gives each speaker an
Animal-Crossing-style blip voice. The rules live in `Rescue`, which is told
where the helicopter landed and decides whether anything happened — so calling
it every frame while parked is harmless.

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
- **One-shots** (`SoundEffects`) — pickup chirps, delivery run + bell,
  touchdown thud, and a knock when pushed back by the field edge or ceiling
  (on a cooldown so it cannot machine-gun).
- **Space** (`Reverb`) — a synthesized outdoor impulse response on a send
  bus. The animal's call echoes hardest, one-shots ring, the rotor gets air.
- **Wind** (`WindSound`) — a gusting, drifting noise bed that is silent on the
  ground and grows with altitude and speed, so it doubles as an altimeter.
  `windTargets()` is the pure mapping.

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
  behaves. Unit tests passing is not proof the game works; look at it.
- **Coach MCP** (`ericjorgensen.com/coach`) — the Layered Development method
  and lessons from past projects.
