# The Dark Kick — Roadmap (Experiment Log)

> **This is not a feature backlog. It is a log of experiments — past and
> planned.** Each milestone entry is a *hypothesis* ("does X make the game
> better?") with, afterward, a one-line *verdict* (proved / disproved /
> complicated). The trail of verdicts is what lets a future session pick up
> sharp — it records *why*, not just *what*.
>
> **Resolution decreases going down.** The current PR is specified in full
> (see `CURRENT_PR.md`). The next one or two are sketched as a question plus
> rough approach. Everything beyond is a loose, ordered parking lot. We don't
> plan far ones sharply — each experiment changes what the next question should
> be, so over-planning is waste.
>
> Minor tweaks don't need an entry. Milestones that test whether a *concept*
> works do.

---

## Done

### M0 — Prototype: does kick-into-terrain feel good?
**Hypothesis:** a touch-first shove that pushes an enemy into spikes / walls is
a satisfying core verb on a phone.
**Verdict: ✅ PROVED.** Played on a phone; kicking the stationary orc into
spikes / a wall already feels right. The core verb is validated. This is the
foundation everything else builds on.
*(Build at this point: one-tile move, Strike, Kick with wall/edge/spike
collision bonuses, one stationary 4-HP orc with no AI, corpses, exit/victory,
full test/CI/deploy.)*

### M1 — Enemy AI + stun: is fighting *live*, closing enemies fun?
**Hypothesis:** two telegraphed orcs actively closing on the player turn the
proven kick from a toy into a *decision* — and **stun** gives kick a reason to
exist that isn't damage, making "damage vs tempo" the choice every turn.

**Verdict: ⚠️ COMPLICATED — the hypothesis couldn't be tested, because the turn
grammar underneath it is broken.** Live, closing enemies are the right
direction. But three failures showed up in playtest, and they share one root:

1. **Positioning is impotent.** Player and orc both move one tile per turn, so
   you can never gain relative ground. It degenerates into an amateur-chess
   pawn race — two units shuffling one tile at a time, and not fun. You cannot
   set an enemy up where you want it, so "turn the room into a weapon" never
   gets off the ground. (The bare level layout — three walls, one spike — makes
   it worse, but is not the cause.)
2. **Kick is therefore the *only* verb that repositions, so it goes
   degenerate.** You can shove an orc along the whole map and walk to the exit;
   it never gets to act.
3. **Stale-plan corner cases.** An orc that commits to a tile and finds the
   player standing on it does nothing — neither moves nor attacks. Reads as
   dead.

**Root cause:** the ruleset commits enemy actions *a turn early*, so every "but
what if the player did X first" needs its own patch rule. Viktor's read, and the
important one: **a system that needs this much corner-case handling is
symptomatic of a bad foundation.** Do not patch it. Replace the grammar.

*(Salvage: M1's readability and game-feel work all stays — turn-order cards, HP
on units, hop/lunge animations, combat log, corpses, build label, phone layout.
Stun itself is retained but is implicated in failure 2 and gets re-evaluated
under the new grammar.)*

---

## Current — specified in full

### M2 — Turn grammar rework: can a small set of axioms replace the patch pile?
**Hypothesis:** replacing M1's commit-a-turn-early ruleset with **one grammar
shared by every unit** — optional move, then either a *basic* action that
resolves instantly or a *charged* action that telegraphs and resolves later —
kills whole *classes* of edge case instead of patching them one at a time. And
giving the player **two move points** on a **choke-heavy level** restores the
juke: the ability to out-manoeuvre an orc and actually set the room up.

Ships alongside a **tuning screen** so every number in here can be dialled
between runs on a phone instead of through a rebuild.

**Full spec:** see `CURRENT_PR.md`. **Design rationale:** see `DESIGN.md` §2.
**Verdict:** _pending build + playtest._

**What we're watching for:**
- Does the M1 kick-forever exploit die on its own? (Probably — an orc that moves
  *and* attacks in one activation isn't neutralised by a one-tile shove. But
  stun-into-wall lockout may still chain; that's what the kick cooldown lever
  is for.)
- Do 1-move orcs become "slowly moving labyrinth walls" against a 2-move player?
  The intended counterweight is **level geometry, not a stat nerf** — corridors
  make speed situational. If geometry isn't enough, the answer is enemy
  *variety* at M4, not contorting the M2 rules.
- Is a fully un-telegraphed basic orc readable enough, or does it need more of a
  state tell?

---

## Next — sketched as questions (rough approach only)

### M3 — Archer + cover: the first *enemy* charged action  `SOON`
**Question:** does a ranged enemy that punishes standing still make positioning
and line-of-sight interesting — and does it give **cover** a reason to exist?
**Rough approach:** the archer is the natural first test of the enemy half of
the charge system — a telegraphed shot at a tile that you can make *whiff* by
displacing the archer or yourself. Introduce a cover property on some objects
(crate = cover until burned). Likely the first PR where a *defensive* option
matters.
*(Depends on M2 landing. M2 deliberately builds the charge system but puts only
a **player** charged action on the board, so the archer has a proven mechanism
to plug into.)*

### M4 — A second enemy shape: heavy or swarm?  `SOON`
**Question:** which "different question" is more fun to add next — a **heavy**
(avoid / reposition it; the perfect kick-into-hazard target) or a **fast swarm**
(handle being surrounded; where area-push shines)?
**Rough approach:** pick one based on what M2/M3 taught us, then aim to get two
enemy *types* on the board together so their *combination* starts producing
emergent puzzles. This is also the honest answer to "the player can outrun
everyone" — solve it with content, not with corner cases.
*(A candidate that came out of the M2 session: a **committed-movement** enemy
that moves several tiles in a straight line before it can turn. Pure legible
causality — you can read its momentum and bait it past you into a wall. Very
jukeable by design, and it makes player speed a *skill* rather than an escape.)*

### M5 — Continuous aim prototype: does analog aiming survive contact?  `SOON`
**Question:** does giving kicks and throws **360° aim** (while movement stays
gridded) deliver the skill-shot combo fantasy without wrecking legibility?
**Rough approach:** prototype the crux in isolation first — how a continuous
vector *lands on discrete tiles*. See `DESIGN.md` §6. A cheap 8-directional
movement test can be run before this as a taste of the same payoff.

---

## Parking lot — loose ordered questions

Re-sorted after every session based on what we learned. Detail lives in
`DESIGN.md`.

1. Sound / aggro as the concrete cost of "loud" (lure enemies with noise).
2. Momentum / mass — kicks chaining billiards-style through units.
3. Ledges / pits as instant-removal hazard tiles.
4. **Interlocking abilities** — design the ability pool so two characters'
   picks combo through shared board state (`DESIGN.md` §7).
5. **Run structure** — the ~2-hour draft-and-specialise evening arc, characters
   as starting leans rather than finished kits (`DESIGN.md` §7).
6. Panic system (derived) — spectacle kills rattle the room.
7. Visibility / not-knowing-what's-behind-the-door.
8. Tether / rope — the first *pull/bind* verb (rogue dream).
9. Disarm / pick-up-weapon.
10. Consumables + pre-level shop.
11. Co-op.
12. Everything tagged `ACT-TWO` in `DESIGN.md` (hybrid timing, portals,
    verticality, light/shadow, summoning, ethereal…).
