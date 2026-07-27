# Tactical Map Contract

## Gameplay question

What board properties make a two-move player, one-move melee enemies, Kick, and
tile charges produce interesting positioning instead of a decorative maze?

This is a contract for **authored prototype maps**. It deliberately does not add
procedural generation. Each room is still designed, played, and adjusted by
hand, while automated validation prevents known structural failures.

## Hard validity rules

Every map must satisfy all of these before balance or aesthetics are discussed.

1. **One safe network.** Remove every spike tile from the walkable graph. All
   remaining floor, exit, and spawn tiles must still be connected. In
   particular, the player always has a non-spike path to the exit.
2. **No mandatory hazard.** Spikes may shorten, pressure, or complicate a route,
   but may never be the sole bridge between two regions.
3. **No overlap or invalid spawn.** Player, exit, walls, spikes, and enemy
   spawns are in bounds and do not overlap.
4. **Readable phone footprint.** The whole board remains visible at 844×390
   landscape. For the current prototype this means an 8×6 grid.
5. **Every spike is actionable.** A spike needs at least one straight
   player → target → spike approach using non-wall tiles. A hazard that cannot
   be reached by Kick is mostly visual noise.

These rules are enforced by `src/game/level.test.ts`.

## Tactical-shape rules

Validity alone creates dull rooms. A useful encounter should also include:

- **At least two routes between major regions.** One may be shorter and risky;
  the other must remain safe. Choosing a route should reveal a preference, not
  solve a maze.
- **Two or more one-tile chokes, each at least two tiles long.** Chokes make
  body blocking matter and prevent the two-move player from circling
  everywhere. They should not be the only kind of space.
- **At least one circling area.** A connected patch of six or more walkable
  tiles should let the player exploit speed and approach a unit from multiple
  sides.
- **A rhythm of compression and release.** Entering a narrow route should
  visibly trade mobility for progress; exiting it should restore options.
- **Wall backstops near fights.** At least one likely enemy contact tile should
  have a wall or edge one tile behind it, supporting collision damage and stun.
- **Hazards with more than one use.** Prefer spikes that can punish voluntary
  shortcuts, receive a Kick from a deliberate setup, and influence AI routing.
- **Enemy roles created by placement.** One enemy should apply immediate
  pressure in open space; another should guard progress or a choke. Identical
  stats can still create different decisions.
- **Exit pressure without a single answer.** The exit should sit beyond or near
  a contested space, but a player must be able to fight through, manipulate the
  guard, or take a longer route.

## Anti-patterns

Reject a draft when any of these appear:

- long parallel wall stripes with no route choice;
- a spike placed on the only path;
- a large empty rectangle where speed always wins;
- a corridor with no payoff, fork, hazard, or enemy pressure;
- an enemy that starts on a guaranteed one-turn instant-kill setup;
- a safe route that is also shorter than every risky route;
- decorative pockets that cannot affect the route to the exit;
- a threat preview so dense that it covers most of the board every turn.

## Bundled starter draft: dual-route cellar

Legend: `#` wall, `^` spikes, `P` player, `N` near orc, `F` far
orc, `E` exit.

```text
...###..
...F.^.E
.P.###..
...###^.
^N......
..###...
```

### What this draft was trying to test

- The western 3×4 area is the opening setup room. It is wide enough to circle
  the near orc and to work toward the west-edge spike.
- The upper choke is the shortest route to the exit. It contains the far orc
  and ends in a spike, so committing to it means fighting and accepting hazard
  pressure.
- The lower choke is longer but spike-free. It is the guaranteed safe route
  into the east side.
- The east-side spike can receive a vertical Kick and makes the final approach
  less comfortable without blocking the safe edge lane.
- The two routes reconnect, so no spike partitions the room.

At default tuning, the shortest route is 7 steps and crosses one spike; the
spike-free route is 13 steps. The six-step gap is intentional: the safe route
trades time and continued enemy pursuit for health, rather than dominating on
both axes.

## Expected opening and validation playthrough

An aggressive upper-route line demonstrates why the room is not just a maze:

1. Turn 1: move two tiles to `(2,1)`, then charge Power Strike on the far orc at
   `(3,1)`.
2. The near orc closes through the west room. The far orc is already adjacent,
   so it Strikes and remains on the charged tile.
3. Power Strike resolves for 3, leaving the far orc at 1 HP.
4. Turn 2: Strike kills the choke guard. Because actions end the player's
   ordered turn, the player cannot immediately run through the opening.
5. Continuing through the upper route reaches the exit on turn 5 with 1 HP:
   exactly one orc Strike plus one 3-damage spike entry. It is fast, legible,
   and genuinely risky.

A cautious lower-route line moves to `(2,3)`, traps the near orc on `(1,3)`,
finishes it on turn 2, then uses two-tile moves through `(3,4)`, `(5,4)`,
`(6,5)`, `(7,4)`, and `(7,2)`. It reaches the exit with 3 HP without entering a
spike. The remaining orc follows but cannot catch the faster player once the
lower choke is cleared.

Automated playthroughs verify both complete routes, but structural validity did
not make the room visually convincing. The central wall mass still reads as
wasted board space rather than believable dungeon architecture. Treat this
layout as a mechanically valid baseline, not a successful room.

The home-screen editor now provides the faster iteration loop: repaint the room,
save the one active `level.json`, start a run, and revise it again. Future map
notes should record editor-made drafts that survive actual playtesting instead
of defending this starter shape.

## Iteration checklist

For every replacement draft, record:

1. the ASCII layout and feature intent;
2. safe and hazardous path lengths;
3. each spike's viable Kick approaches;
4. an aggressive line and a cautious line through the first two rounds;
5. whether either route became obviously dominant in a human playtest;
6. any preview or readability issue caused by the geometry.
