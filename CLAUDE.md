# Animal Rescue

## North star

**You are the only thing between a panicking animal and the fire — the game is
the moment you drop in low, get it aboard, and haul out with the smoke closing in.**

Everything is judged against that moment. Flight exists to make the drop-in
tense; the fire exists to put a clock on it; the animals exist to be worth
saving. A feature that does not sharpen that moment does not belong.

*(Provisional — written at First Breath from flying the helicopter. Worth
re-cutting once there is an animal to actually pick up.)*

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

`W A S D` (or arrow keys) fly horizontally · `Space` climbs · `Shift` descends.
Forward is -Z, away from the camera. The camera trails from behind and above.

## The loop so far

An animal waits at the amber pickup pad. Land there to take it aboard, fly to
the blue rescue pad, and land again to deliver it for a point. Another animal
is waiting immediately, so the loop repeats. The rules live in `Rescue`, which
is told where the helicopter landed and decides whether anything happened —
so calling it every frame while parked is harmless.

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
