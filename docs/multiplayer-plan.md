# Playing Animal Rescue with friends, remotely

A plan, not an implementation. It says what the game would become, what has to
change in the code, what you have to go and set up, and what it costs.

---

## 1. Decide what the game actually is

"Play with friends" is four different games. They cost wildly different
amounts, so this is the decision everything else hangs off.

| | What it is | Work | Fits the north star? |
|---|---|---|---|
| **A. Remote copilot** | Two people, **one** helicopter. One flies, one works the winch and the water. | Small | Yes, but it is the game you already have — only the second seat moves to another house |
| **B. Co-op fleet** | 2–4 people, **a helicopter each**, one fire, one set of animals, pooled score | Medium | **Yes — this is the recommendation** |
| **C. Race** | Same as B, but separate scores and they are competing for the same animals | Medium (B plus a scoreboard) | Partly — it pulls against "you are the only thing between a panicking animal and the fire" |
| **D. Ghost / leaderboard** | Not live at all. Same map and same fire, play alone, compare scores afterwards | Small | No — it is not playing together |

**Recommended: B, with C as a toggle later.** A fleet sharpens the moment the
game is about rather than diluting it: the fire is still closing, there are
still only so many animals, and now someone else is shouting that they cannot
reach Duchess in time. It also makes the Chief and Bram funnier, because they
have more people to be disappointed in.

A is a stepping stone and about a tenth of the work, so it is worth shipping
first if you want something playable with a friend quickly. Everything A needs
is also needed by B.

---

## 2. The shape of the thing: who decides what

The honest constraint is that there is no server. The game is static files on
GitHub Pages, and keeping it that way is worth a lot.

**Recommendation: one player's browser is the host.** It owns the fire, the
animals, the clock and the score. Everyone else is a guest.

And then the simplification that makes this whole project tractable:

> **Each player simulates their own helicopter. The host simulates the world.**

A guest runs `Helicopter`, `Controls`, `Handling` and `Airframe` locally for
their own machine and sends the host the result — where they are, how they are
leaning, how wrecked they are. The host never second-guesses it.

That is a trusting design and it is the right one here. These are friends on a
sofa somewhere else, not strangers on a ladder; cheating costs nothing to
anybody. In exchange it removes the two hardest problems in networked games —
client-side prediction and server reconciliation — entirely. Your own
helicopter is never laggy because it is never remote. Other people's
helicopters are interpolated a tenth of a second behind, and nobody will ever
notice, because no two helicopters have to collide, aim at each other, or agree
about anything at a frame's precision.

The host arbitrates only the handful of things two players can genuinely
contest:

- who picked up an animal, when both land on it at once (first message wins)
- when the fire spreads, and where
- when an animal bolts, and where to
- the score and the clock

### What gets sent

**Guest → host**, 30 Hz, about 40 bytes:

```
position, heading, pitch, roll   the flown attitude
condition                        how wrecked
speed, onGround, impactSpeed     so the host can judge a landing
winch, water                     the copilot's two buttons
```

**Host → everyone**, 20 Hz, a couple of hundred bytes:

```
each helicopter: position, heading, pitch, roll, condition
fire:  new patches, retired patch ids  (deltas — a patch catches every 4 s)
animals: id, site, credit, who is carrying it
score, clock, and a queue of events (pickup, delivery, bolt, radio line)
```

This is nothing. A dial-up modem would carry it. The game will be limited by
how long a round takes, not by bandwidth.

### Why not the obvious alternatives

- **Deterministic lockstep** (everyone simulates everything, only inputs are
  sent) is *very* tempting here, because the world already is deterministic:
  the terrain is a pure function of position, the fire is seeded, and
  `SiteFinder` picks from a hash. But floating-point maths is not guaranteed
  identical across browsers and CPUs, and one divergence silently ruins a
  whole round with no way to detect it mid-flight. Not worth it.
- **A dedicated authoritative server** is the correct answer for a commercial
  game and overkill for this one. It costs money every month, forever, and the
  thing it buys — cheat resistance — you do not need.

---

## 3. What has to change in the code

Most of this is work you would want to do anyway. The game is unusually well
set up for it: the flight model, the fire, the rescue rules and the site finder
are already plain modules with no renderer in them, which is exactly the half
that has to run headless on a host.

### Layer 0 — make it multi-helicopter locally (no network at all)

This is the real work, and none of it is networking. Do it first and prove it
with two gamepads on one screen.

- **`World`** owns one `HelicopterModel`. It needs *N*, plus a colour per
  player so you can tell whose is whose.
- **`Rescue`** assumes a single carrier (`carrying: Waiting | null`). It needs
  to be keyed by player: who is carrying what, and `landedOn` has to be told
  *which* player landed. Its tests mostly carry over.
- **`Handling`**, **`Airframe`**, **`Winch`**, **`WaterTank`** become per
  player — they already are per instance, so this is mostly bookkeeping.
- **`Shift`**, **`Fire`**, **`SiteFinder`**, **`TreeCover`** are already shared
  and need nothing.
- **A new `Crew` class** holding one player's machine and gear, so `main.ts`
  loops over crews instead of reaching for globals. `main.ts` is currently the
  only place that knows there is exactly one of everything, and it is where
  this gets untidy if it is done carelessly.
- **`Announcer`** gains a notion of who is being talked to. The Chief shouting
  "THAT'S MY PAINT JOB" should name the guilty party.
- **Score**: pooled for co-op, per player for a race. Keep both from the start,
  it is one number either way.

*Deliverable: two helicopters, two gamepads, one screen, one fire. Fully
playable and fully testable with no network code written.*

### Layer 1 — a seam to send things through

- **`Link`**: an interface with `send(message)` and `onMessage(handler)`.
- **`LoopbackLink`**: the same thing wired to itself, with an artificial delay
  and an artificial drop rate.

Build the whole netcode against `LoopbackLink` first. You can unit test a host
and two guests in one Node process, with 150 ms of latency and 2% packet loss,
and never open a browser. Given how much of this project's value has come from
being able to test the brain without the body, this is worth the extra class.

- **`HostSession`**: owns the world, applies guest reports, broadcasts snapshots.
- **`GuestSession`**: simulates its own helicopter, sends reports, applies
  snapshots to everything else.

*Deliverable: a passing test where three simulated players rescue animals over
a laggy loopback and all agree on the score.*

### Layer 2 — a real connection

- **`WebRtcLink implements Link`** — the only file that knows what WebRTC is.
- A lobby: host gets a room code, guest enters it, or follows a URL like
  `…/animal-rescue/#join=OTTER-42`.
- Show who is connected, and their ping.

### Layer 3 — make it feel right

- Interpolate remote helicopters ~100 ms behind, so they move smoothly rather
  than teleporting 20 times a second.
- Handle a guest dropping (their helicopter fades out, their animal is released).
- Handle the **host** dropping. The honest answer for version one is: the round
  ends and everyone sees the score card. Say so in the UI rather than hanging.

### Layer 4 — the things that make it feel like a game with friends

- Names over each helicopter.
- A per-player line on the end-of-shift card.
- Radio lines attributed: "Bram here — Eric has Duchess, somebody fetch Mo."
- Voice chat is **not** worth building. Everyone is already on Discord.

---

## 4. What you have to go and set up

WebRTC still needs a tiny bit of server to introduce two browsers to each
other. After that the traffic is peer to peer and costs you nothing.

### The minimum that works today

| Thing | What for | Option | Cost |
|---|---|---|---|
| **Signalling** | Swapping connection offers so two browsers can find each other | PeerJS public cloud (`0.peerjs.com`), zero setup | Free |
| **STUN** | Each browser discovering its own public address | Google's public STUN servers | Free |
| **TURN** | Relaying when a NAT refuses a direct connection | Open Relay free tier | Free |
| **Hosting** | The game itself | GitHub Pages, as now | Free |
| **HTTPS** | WebRTC refuses to run without it | GitHub Pages gives it | Free |

That genuinely is enough to play with friends this month, and costs nothing.

### What to move to when you care

The public PeerJS server is a shared free service with no uptime promise. If
the game is worth playing regularly, replace the first row:

- **Signalling, self-hosted**: PeerServer is an npm package; the whole thing is
  about fifty lines and one always-on process. Put it on Fly.io, Render or
  Railway. **$0–7/month.** It needs its own HTTPS hostname, so either a
  subdomain of a domain you own or whatever the platform gives you.
- **TURN, self-hosted**: `coturn` on the smallest VPS, if the free tier's
  limits start to bite. **~$5/month.** Only worth it once a friend actually
  reports being unable to connect — and most will connect fine without it.

Wire the URL in the same way the Pages base path already is:

```
VITE_SIGNALLING_URL=wss://signal.example.com
```

set in `.github/workflows/pages.yml` next to the existing `VITE_BASE`, so
local development and the published build can point at different services.

### The alternative shape, if WebRTC turns out to be a nuisance

Skip peer-to-peer and run a **WebSocket relay**: one small Node process that
guests connect to and that forwards messages. Roughly the same fifty lines,
noticeably easier to debug (you can log every message in one place), no TURN
needed at all, and no NAT traversal to go wrong. The cost is one extra hop of
latency — maybe 30 ms — which this game will not notice. Same hosting, same
money.

If you find yourself fighting WebRTC for more than a day, take this instead.
Because `Link` is an interface, swapping between them is one file.

---

## 5. What I would actually do, in order

1. **Layer 0.** Two helicopters, two gamepads, one screen. No network. This is
   most of the work and all of the risk, and it is a better game on its own.
2. **Ship A as a test.** Remote copilot over the loopback link, then over a
   real one. Two people, one helicopter, one winch — it proves the whole
   transport with a fraction of the state.
3. **Then B.** The fleet, which by then is mostly already written.

---

## 6. Things to decide before anyone writes code

- **How many players?** 4 is a sensible cap: more than that and the animals run
  out faster than the fire spreads.
- **Pooled score or separate?** Pooled is warmer and fits the premise. Make it
  a toggle in the lobby, it is one number.
- **Does a guest keep flying if the host's connection stutters?** Yes — their
  own helicopter is local, so they should barely notice a half-second gap.
- **What happens to an animal somebody was carrying when they drop out?** It
  goes back to where it was waiting. Harsh but clear.
- **Is the fire the same for everyone?** Yes. One fire, one map, one clock.
  That is the whole point.

## 7. What this does not change

Nothing here touches the terrain, the flight model, the sound, or the look.
The world is a pure function of position with no seed file and nothing to load,
so every player already has an identical map without a byte being sent. That
was not done for multiplayer, but it is the single biggest reason this is a
reasonable thing to attempt rather than a rewrite.

The Electron and Steam path is unaffected too — it is a different wrapper round
the same web build, and a host-authoritative peer-to-peer game works the same
inside it.
