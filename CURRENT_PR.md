# Current PR — M1: Enemy AI + Stun

> **Audience:** the coding agent (Codex). This is the build spec — concrete,
> numbered, with acceptance criteria. No vision fluff; for the *why*, see
> `PROJECT_BRIEF.md` and `DESIGN.md`.
>
> **Rule for the agent:** if something here is genuinely ambiguous, prefer the
> simplest implementation consistent with the pillars in `PROJECT_BRIEF.md`, and
> note the assumption in the PR summary. Do **not** invent new mechanics.

---

## Hypothesis this PR tests

Two telegraphed orcs actively closing on the player turn the proven kick from a
toy into a *decision*. **Stun** gives kick a reason to exist beyond damage, so
every turn becomes a choice between **damage (strike)** and **tempo (kick)**.

---

## Scenario

- Two orcs on the board: one spawned **near** the player, one **far**.
- Both have **real intent** and actively close on / attack the player.
- The existing terrain (spikes, walls, exit) stays.

---

## Turn structure — strict turns

1. **Player turn:** exactly **one move** *and* **one action**.
   - Move: one tile, orthogonal.
   - Action: **strike OR kick** (not both). Move and action are independent —
     the player may do either first, or move without acting.
2. **Enemy turn:** each orc takes **exactly one action** — **move OR attack, not
   both**. This keeps each enemy to a *single* telegraphed arrow.

---

## Telegraphing — full information on intent

- Each enemy displays **exactly one** intent indicator for its next action
  (a move arrow to a target tile, or an attack indicator on its target).
- Perfect information *on enemy intent* is required here — the player must be
  able to pre-plan a kick-into-spikes. (This is not in tension with the
  "legible causality" pillar: we telegraph each unit's single next action; we do
  not pre-solve multi-step chains for the player.)

---

## Stats

All values below **must live in a single editable config file** (e.g.
`config/combat.ts` or similar) so they can be tweaked without hunting through
logic. This is a hard requirement of this PR.

| Entity / action | Value |
|---|---|
| Player health | **5** |
| Player Strike damage | **1** |
| Player Kick base damage | **0** |
| Orc health | **4** |
| Orc Strike damage | **1** |
| Spikes bonus (on forced push onto spikes) | **+3** |
| Wall collision bonus (kicked into a wall) | **+1** |

No armor, accuracy, crit, cooldowns, or cast times. Health and damage only.

---

## Kick — three payoffs by what's behind the target

Kick targets an adjacent enemy and attempts to push it one tile in the kick
direction. The outcome depends on what occupies the destination:

| Behind the target | Result |
|---|---|
| **Open floor** | enemy moves one tile. Reposition only (0 damage). |
| **Wall** (or board edge) | enemy can't move → **+1 damage** *and* **stunned 1 turn**. |
| **Another enemy** | pusher can't move → both the pushed enemy and the blocker are **stunned 1 turn** *(collision)*; apply the wall-style +1 to the pushed enemy. |
| **Spikes** (forced onto) | **+3 damage** → this kills a full-health (4 HP) orc. |

The same verb reads the room and does something different every time. Confirm
these interactions against existing collision rules in the current build and
keep them consistent.

---

## Stun

- A stunned unit **loses its next action** (shows no intent that turn).
- **A "no arrow" is not enough** — the player will read *nothing* as "waiting,"
  not "stunned." A **positive, persistent visual indicator** must sit on the
  stunned unit for the whole duration it is stunned (e.g. circling stars, a
  z-z-z, a spin icon — **pick whatever the sprite kit and animation tools
  actually support**).
- The indicator must be **legible in stillness**, not just mid-animation — on a
  phone, a one-frame flash gets missed. Persistent marker; clears when the stun
  ends.

---

## Out of scope (do not build in this PR)

Panic, sound/aggro, tether, cover, new enemy types (archer/heavy/swarm),
consumables, cooldowns/cast-times, real-time hybrid. These are tracked in
`DESIGN.md` / `ROADMAP.md`.

---

## Acceptance criteria

- [ ] Two orcs spawn, one near and one far, each with visible single-action
      intent each turn.
- [ ] Orcs pathfind toward the player and attack when adjacent (1 dmg).
- [ ] Player turn allows one orthogonal move **and** one action (strike or kick).
- [ ] Strike deals 1; kick deals 0 on open floor and only repositions.
- [ ] Kick into wall/edge: +1 dmg and stun; kick into enemy: collision stun on
      both; kick into spikes: +3 dmg (kills a 4-HP orc).
- [ ] Stunned units skip their next action and show a **persistent** stun
      indicator that is readable while static.
- [ ] All combat numbers are read from a single editable config file.
- [ ] Existing tests pass; add tests for stun application/expiry and the three
      kick payoffs.

---

## For the PR summary (Codex writes this after building)

Record: what was actually built, any assumptions made on ambiguous points, the
chosen stun-indicator form and why, and anything that turned out harder/different
than this spec expected. This becomes the input to Viktor's playtest and the
eventual verdict line in `ROADMAP.md`.
