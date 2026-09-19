# Animal Rescue

A helicopter game about the moment you drop in low, get a frightened animal
aboard, and haul out with the smoke closing in.

**Play it:** https://nebosite.github.io/animal-rescue/

Press any key to start the shift. You have five minutes. Three named animals
are waiting out in the hills — a fox kit in a clearing, a bear cub on a
hilltop, a deer on the edge of the fire — and the fire is spreading toward
them. Land beside one, fly it to the blue base pad, land again. Harder places
are worth more; quick trips and gentle landings are worth a bonus; rough
flying gets you told off by whoever is aboard, and by the Chief, who cares
about the paint.

## Controls

Two sticks, one for each hand. A game controller works the same way — press
any button on it and the game will say hello.

| | Keyboard | Controller |
|---|---|---|
| climb / descend | `W` / `S` | left stick up / down, or the triggers |
| turn | `A` / `D` | left stick left / right, or the bumpers |
| nose forward / back | `↑` / `↓` | right stick up / down |
| slide | `←` / `→` | right stick left / right |

Stay out of the fire and above the trees. Wreck the helicopter badly enough
and the Chief flies it home for repairs.

## Running it yourself

```
npm install
npm run dev      # opens the game in your browser
npm test         # the unit tests
npm run build    # typecheck and a static build in dist/
```

Everything is procedural — the land, the forest, the fire, the sounds, the
voices — so there is nothing to download but the code. The design notes and
the method it was built with are in `CLAUDE.md`.
