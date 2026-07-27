# Current PR — M2: Turn Grammar Rework + Tuning Screen

> **Audience:** the coding agent (Codex). This is the build spec — concrete,
> numbered, with acceptance criteria. No vision fluff; for the *why*, see
> `docs/PROJECT_BRIEF.md` and `docs/DESIGN.md` §2.
>
> **Rule for the agent:** if something here is genuinely ambiguous, prefer the
> simplest implementation consistent with the pillars in `PROJECT_BRIEF.md`, and
> note the assumption in the PR summary. Do **not** invent new mechanics.
>
> **This PR replaces M1's turn rules wholesale.** M1's readability and game-feel
> work (turn-order cards, HP on units, hop/lunge animations, combat log,
> corpses, build label, phone layout) is good and should be **kept**.

---

## Hypothesis this PR tests

M1's failure was foundational, not incidental: enemies committed to an action a
turn early, so every "but what if the player moved first" needed its own patch
rule, and the player could never gain ground on a same-speed enemy.

**This PR tests whether a small set of axioms removes whole *classes* of edge
case rather than patching them one at a time**, and whether a faster player on a
choke-heavy map restores the ability to actually set the room up.

It also ships a **tuning screen**, so the numbers below can be dialled between
runs on a phone instead of through a rebuild. That is arguably the highest-
leverage item in the PR: it converts every future balance question from a code
change into a playtest.

---

## 1. The turn grammar (the core change)

### 1.1 One structure, every unit

Player and enemies use the **same** activation structure:

> **Optional move** (spend up to your move points, orthogonally, one tile per
> point) **, then exactly one action.**
> The action is either a **basic action** (resolves immediately) or a
> **charged action** (declares now, resolves later).

- The player may **split** movement around the action (e.g. move 1 → act →
  move 1). Movement points not spent are lost at end of turn.
- Any part may be skipped. **End Turn** ends the player turn at any point.

### 1.2 Round structure

Each round resolves in this fixed order:

1. **Player turn** — move and/or one action, per 1.1.
2. **Enemy phase** — each enemy activates in a fixed, visible order.
3. **Charge step** — all pending charged actions resolve. **The player's charges
   resolve first**, then enemies' in the same fixed order.

### 1.3 Axiom A — basic actions resolve instantly against the live board

Enemies have **no stored plan and no action telegraph**. On its activation, an
enemy reads the board *as it is at that moment*, decides, and acts in the same
instant — move and attack fused into one activation.

Direct consequences (these replace M1 patch rules; do not re-add them):

- If an enemy's chosen destination is occupied when it activates, it simply
  **cannot move there** and forfeits the movement. It **still takes its action**
  if a legal one exists (e.g. strike an adjacent player). The M1 "orc does
  nothing" behaviour must not survive.
- An enemy that moves adjacent to the player **attacks in the same activation**.
- There is no "is my plan still valid" check anywhere in enemy logic, because
  nothing is stored between activations.

### 1.4 Axiom B — charged actions telegraph and **always** resolve

A charged action:

- is **declared** as a unit's action, and immediately places a **persistent,
  legible marker on a target tile** (readable while static, not a one-frame
  flash — same bar as M1's stun indicator);
- **resolves at the charge step**, at its declared tile, **whether or not that
  still makes sense**. Hitting an empty tile is a legal, intended outcome;
- is **never cancelled or re-planned**. There is no validity check. If the unit
  that declared it is stunned, moved, or displaced, the charge still resolves.
  If the declaring unit is **killed** before the charge step, the charge is
  removed with it (this is the one exception, and it exists only because the
  actor no longer exists).

**Charges commit to a TILE, not to a TARGET.** This distinction is the point of
the whole mechanic — forcing an enemy's attack to whiff is player skill.

### 1.5 Charge timing

> A charge resolves once the **opposing side has had exactly one activation** to
> respond to it.

- **Player declares** on their turn → enemy phase happens → **the charge
  resolves in that same round's charge step.** Enemies can therefore walk *into*
  a player's telegraphed tile. This is intended: a charge is a trap you set.
- **Enemy declares** during the enemy phase → the player gets a full turn to
  react → **it resolves in the *next* round's charge step.**

Implement wind-up as a configurable integer (`chargeWindupRounds`, default 1) so
this can be tuned.

---

## 2. Player changes

| Change | Value |
|---|---|
| Move points per turn | **2** (was 1) — config `playerMovePoints` |
| Movement splitting around the action | allowed |
| Basic actions | **Strike**, **Kick** |
| Charged action | **Power Strike** (new — see 2.1) |
| Kick cooldown | new concept, **default 0** (i.e. off) — config `kickCooldownRounds` |

### 2.1 Power Strike (the player-side charged action)

This is the test case for the charge system. It is a **named core verb already
in `AGENTS.md`**, not a new invention. Keep it minimal:

- Target: **one tile orthogonally adjacent to the player at the moment of
  declaration.**
- Resolves at the charge step per 1.5, at that tile, regardless of where the
  player has since moved or what now occupies the tile.
- On resolution: deal `powerStrikeDamage` (default **3**) to whatever unit
  occupies the tile. Empty tile → nothing happens (a whiff). Log it as a whiff
  in the combat log so it reads as intentional, not as a bug.
- No destruction, area effect, fire, or knockback in this PR.

### 2.2 Kick cooldown

- `kickCooldownRounds` default **0** = usable every turn (current behaviour).
- At 1 or more, Kick is unavailable for that many of the player's subsequent
  turns, with a **visible disabled state and a remaining-turns readout** on the
  Kick control.
- This is a lever for playtesting, not a balance decision. Ship it at 0.

---

## 3. Enemy changes

- Keep **two orcs**, one spawned near and one far, for continuity with M1.
- Orcs use the shared grammar: **1 move point, then one basic action** (Strike
  if a player is orthogonally adjacent after moving).
- **Remove the M1 action telegraph entirely** — no gold move arrow, no red
  ATTACK tile. Orcs act live (1.3).
- **Add a lightweight state tell instead:** a small persistent indicator
  distinguishing **idle** from **pursuing**. This communicates a *mode*, never a
  stored plan. Readable while static.
- Keep deterministic pathfinding: shortest path toward the nearest legal tile
  adjacent to the player; walls and living units block; prefer a spike-free
  route and cross spikes only when no safe route exists.
- **No enemy charged actions in this PR.** The archer at M3 will be the first.
  The system must nonetheless be general enough that an enemy can declare one.

---

## 4. Stun under the new grammar

- Stun is **retained**, unchanged in acquisition (see §5).
- A stunned unit **loses its next full activation** (both move and action).
- The **persistent indicator from M1 stays** — it was correct and should not be
  regressed.
- **Stun does not cancel a pending charge.** A stunned unit's already-declared
  charge still resolves at the charge step (1.4).

---

## 5. Kick payoffs — carried over, with the M1 contradiction resolved

M1's spec asserted 0 base damage, a +3 spike bonus, *and* a guaranteed kill on a
4-HP orc, which does not add up. Codex resolved it with an explicit 1-point
forced-impact damage. **That resolution is now the spec.** These are the correct
numbers; do not re-derive them.

| Behind the target | Result |
|---|---|
| **Open floor** | enemy moves one tile. Reposition only, 0 damage. |
| **Wall or board edge** | enemy can't move → `forcedImpactDamage` (**1**) **and stunned 1 activation**. |
| **Another unit** | neither moves → both pushed unit and blocker **stunned 1 activation**; pushed unit takes `forcedImpactDamage` (**1**). |
| **Spikes** | `forcedImpactDamage` (**1**) + `spikeDamage` (**3**) = **4 total**, killing a full-health orc. |

Spikes deal `spikeDamage` (**3**) to any unit entering them, voluntarily or by
force. Standing on spikes does not repeat damage.

---

## 6. Level redesign — geometry does the balancing

A 2-move player against 1-move orcs is only interesting if speed is
**situational**. This is a design requirement of the PR, not decoration.

The level must contain:

1. **At least two corridors exactly one tile wide**, long enough that a player
   inside one cannot walk around an orc — you must fight or kick through.
2. **At least one open area** with room to circle an orc, where 2 move points is
   clearly powerful.
3. **Hazards positioned so kicks matter** — spikes reachable from a fight
   position, and walls usable as kick-into-wall backstops. M1's three walls and
   one spike were too sparse to improvise against.
4. **A path to the exit that passes through or near at least one choke**, so
   walking straight to the exit is not the obvious dominant line.

**Hard constraint:** the board must still fit phone landscape without scrolling
and stay readable at 844×390. Grow the grid beyond the current 8×6 only if that
constraint still holds; if it doesn't, restructure within 8×6 instead.

---

## 7. Tuning screen

A **home screen shown at launch**, with:

- a **Start Run** button;
- a **scrollable list** of tunable integers, each row: label, current value, and
  **− / +** stepper buttons (touch targets, no text entry, no keyboard);
- min/max clamping per value, so nothing can be set to an invalid state;
- a **Reset to Defaults** button;
- values apply to the **next run started**. Persisting between sessions is
  optional and nice-to-have, not required.

**Keep it plain.** No sliders, no presets, no saved configurations, no styling
work beyond matching the existing UI. The moment it wants to be pretty it is
eating a PR it shouldn't. If any of this proves large, ship the tuning screen as
a **separate, earlier PR** and say so.

Values exposed, at minimum:

`playerHealth`, `playerMovePoints`, `strikeDamage`, `kickBaseDamage`,
`kickCooldownRounds`, `powerStrikeDamage`, `chargeWindupRounds`,
`forcedImpactDamage`, `spikeDamage`, `stunDurationActivations`, `orcHealth`,
`orcStrikeDamage`, `orcMovePoints`, `orcCount`.

---

## 8. Config

All values above **must live in the single editable config file** (`src/config/
combat.ts` or equivalent) and be read from there by both the game logic and the
tuning screen. No number may be duplicated in logic. This is a hard requirement,
carried forward from M1.

---

## 9. Housekeeping

- **`LEVEL.md` at the repo root is stale** — it still describes M1-era spike
  rules that contradict `docs/LEVEL.md`. Delete the root copy and point
  `README.md` at `docs/LEVEL.md`, or make the root file a one-line pointer. One
  canonical rules doc only.
- Update `docs/LEVEL.md` to describe the new grammar.

---

## 10. Out of scope (do not build in this PR)

Enemy charged actions, archer, cover, heavy/swarm enemy types, continuous or
8-directional aim or movement, hex or fine grids, panic, sound/aggro, tether,
consumables, character classes, run/draft progression, real-time hybrid,
destructible objects, fire. These are tracked in `docs/DESIGN.md` and
`docs/ROADMAP.md`.

---

## 11. Acceptance criteria

- [ ] Player turn allows up to 2 orthogonal moves and exactly one action, in any
      order, with movement splittable around the action.
- [ ] End Turn works at any point, including with move and action unused.
- [ ] Orcs show **no action telegraph**; they show a persistent idle/pursuing
      state tell that is readable while static.
- [ ] An orc whose destination is occupied on activation forfeits movement but
      **still attacks** if the player is adjacent. It never does nothing when a
      legal action exists.
- [ ] An orc that moves adjacent to the player strikes in the same activation.
- [ ] Power Strike declares on an adjacent tile with a persistent marker, and
      resolves in the charge step at that tile regardless of the player's
      subsequent position or the tile's occupancy.
- [ ] A Power Strike onto a now-empty tile whiffs cleanly and is logged as a
      whiff, not an error.
- [ ] A charge resolving order is fixed: player charges before enemy charges.
- [ ] A stunned unit loses its next full activation, keeps the persistent stun
      indicator, and any charge it declared still resolves.
- [ ] Kick payoffs match §5 exactly, including the 4-total spike kill.
- [ ] Kick cooldown exists as a config value, defaults to 0, and shows a visible
      disabled state with remaining turns when set above 0.
- [ ] The level contains at least two one-tile corridors and at least one open
      area, and fits phone landscape at 844×390 without scrolling.
- [ ] Tuning screen: launches first, lists all §7 values with −/+ steppers,
      scrolls when the list overflows, clamps values, resets to defaults, and
      applied values take effect in the next run.
- [ ] Every number is read from the single config file; none is duplicated in
      logic.
- [ ] Root `LEVEL.md` no longer contradicts `docs/LEVEL.md`.
- [ ] Existing tests pass. Add tests for: the split-move turn structure, live
      enemy resolution with an occupied destination, charge declare/resolve
      including the whiff case, charge surviving stun, charge removal on
      declarer death, and charge resolution order.

---

## 12. For the PR summary (Codex writes this after building)

Record: what was actually built; any assumptions on ambiguous points;
**specifically whether the new grammar removed the M1 edge cases or whether new
ones appeared in their place**; whether the 2-move player against 1-move orcs
felt like it needed geometry help beyond what §6 specifies; and anything that
turned out harder or different than this spec expected. This becomes the input
to Viktor's playtest and the eventual verdict line in `docs/ROADMAP.md`.
