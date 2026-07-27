# Movement, Threat Preview, and Level Editor QA

Date: 2026-07-27

## Gameplay questions

1. Does a two-point movement envelope make the faster player readable and
   useful without requiring two separate taps?
2. Does the strict `move → action` order prevent contradictory post-attack
   repositioning?
3. Can an orc's live threat be inspected without restoring a persistent intent
   badge or storing an action plan?
4. Can the room be repainted, validated, saved, and launched from a phone-sized
   level editor?

## Automated rule checks

The Vitest suite covers:

- every destination reachable with the remaining movement points, including a
  deterministic two-tile path selected with one input;
- movement before an action and rejection of every movement attempt after an
  action;
- End Turn with movement and action unused;
- live orc movement followed by a same-activation Strike;
- occupied enemy destinations without suppression of a still-legal Strike;
- separate direct-Strike and move-then-Strike cell sets, deterministic approach
  paths, and no immediate range during a stunned/skipped activation;
- Power Strike tile declaration, action-closing movement lock, trap resolution,
  whiffs, charge ordering, stun persistence, and actor-death cleanup;
- open-floor, wall/edge, unit-collision, and spike Kick outcomes;
- Kick cooldown timing and player/enemy spike entry;
- spike-avoiding orc pathfinding with unavoidable-spike fallback;
- landscape-phone layout bounds;
- authored-level validation: in-bounds non-overlapping placements, one connected
  spike-free network, a spike-free start-to-exit route, one-tile chokes, open
  areas, and a valid Kick setup for every spike;
- complete hazardous and safe route playthroughs.
- editor conversion between an 8×6 tile document and runtime geometry;
- unique Player/Exit marker movement, malformed-file rejection, spike-free path
  validation, versioned JSON round-tripping, and active-level application.

At default tuning, the automated hazardous route wins on turn 5 with 1 HP. The
safe route wins with 3 HP and never enters spikes.

## Browser walkthrough

Checked the local Vite game in the in-app browser at an explicit 844 × 390
phone-landscape viewport.

### Layout and initial state

- Exactly one canvas rendered at 844 × 389.87 px.
- Document dimensions remained 844 × 390 with body overflow hidden; no page
  scrolling was introduced.
- The full 8×6 room, four action controls, End Turn, Reset, and tactical
  readout remained visible.
- No persistent `PURSUE` or `IDLE` badge appears on either orc.

### Movement and action order

- The turn-one green overlay covered all legal destinations within two movement
  points, not only adjacent cells.
- A single tap on `(2,1)` moved the player from `(1,2)` along a two-tile path
  and consumed both points. Strike became the selected remaining option.
- Selecting an action clears any pinned enemy inspection.
- After declaring Power Strike with movement still unused, the transition frame
  showed `Closed after action` on Move and all player actions completed while
  the enemy and charge phases ran. Turn 2 restored Move with two points. There
  was no post-action movement opportunity.

### Orc inspection

- Hovering an orc showed no separate amber movement overlay. Bright solid red
  represented move-then-Strike coverage; muted red with diagonal hatching
  represented immediate no-move Strike coverage.
- Tapping the non-targetable near orc while Move was active pinned the same
  inspection on mobile-style input.
- The temporary `BRIGHT MOVE+HIT · HATCH HIT` legend and route arrow disappeared
  when inspection ended; neither is stored intent.

### Power Strike readability

- Selecting Power Strike replaced the green movement language with a visibly
  purple fill and pale-purple outline on all four legal adjacent tiles.
- Declaration still produced the persistent `POWER · T1` marker and a distinct
  charge-step animation.

### Map playthrough, victory, defeat, and reset

- The aggressive upper line was played through in the browser: move to `(2,1)`,
  trap and finish the choke guard, move through `(4,1)`, cross the optional
  spike to `(6,1)`, and reach the exit on turn 5 with 1 HP.
- `CELLAR CLEARED` appeared immediately on exit entry. `DESCEND AGAIN` restored
  turn 1, 5/5 HP, both enemy spawns, and the full movement envelope.
- A separate one-health tuning run used End Turn immediately. The near orc
  moved and Struck in the same activation, producing the `FALLEN` panel at
  0/1 HP.
- No browser warnings or errors were emitted during the walkthrough.

### Level editor

- **Level Editor** appeared beside **Start Run** on the home screen.
- At 844×390, all six tools, the full 8×6 grid, Back, status text, and Save
  remained visible without page scrolling.
- The editor opened with only the two enemy spawns used by the current tuning,
  rather than exposing unused higher-count fallback spawns.
- Selecting Floor and tapping column 4, row 3 changed that cell from Wall to
  Floor. Save accepted the still-valid spike-free route.
- Reload restored `Edited level active`; reopening the editor showed the painted
  Floor, and Start Run rendered the removed wall as walkable floor.
- Edited levels use every painted Orc spawn and hide the fallback room's Orc
  Count tuner, preventing the default value of 2 from truncating the saved map.
- A four-Orc editor draft was saved and reloaded. Home reported `4 map orcs will
  spawn`; Start Run rendered all four sprites and four enemy turn-order cards
  with no browser warnings or errors.
- The browser-local active slot was therefore verified end-to-end. The in-app
  browser did not expose a download event for the generated Blob URL, so the
  `level.json` download trigger still needs confirmation in Safari/Chrome.

## Assumptions and interpretations

- The latest user instruction overrides `CURRENT_PR.md` where that earlier spec
  allowed movement to be split around an action.
- An action is optional only through End Turn; once Strike, Kick, or Power
  Strike is taken, the enemy phase starts immediately.
- Power Strike may be declared on any in-bounds orthogonally adjacent tile,
  including a wall. A wall cannot contain a unit, so it resolves as a legal
  whiff.
- Threat inspection previews the selected orc's next live activation against
  the current board. Stunned orcs show no movement or attack area because their
  next activation is skipped.
- The built-in room exposes only the currently tuned number of spawns when it
  first enters the editor. A saved room owns one to four explicit spawn cells;
  `orcCount` uses up to that many in row-major editor order.
- The project deliberately uses an authored map plus a validation contract.
  Procedural generation remains deferred by `AGENTS.md`.

## Human playtest still required

Automated and browser QA can establish legality, reachability, timing, and
readability. A physical iPhone playtest must still judge:

1. whether bright solid versus muted hatched threat cells read correctly under
   a finger without relying on the small legend;
2. whether repeated room painting feels comfortable at roughly 39 px per cell
   on the target device;
3. whether Safari downloads `level.json` as expected;
4. which editor-made geometry finally feels like a dungeon rather than a block
   of unused board space;
5. whether the compact action controls feel comfortably tappable on the target
   device.
