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

---

## Current — specified in full

### M1 — Enemy AI + stun: is fighting *live*, closing enemies fun?
**Hypothesis:** two telegraphed orcs actively closing on the player turn the
proven kick from a toy into a *decision* — and **stun** gives kick a reason to
exist that isn't damage, making "damage vs tempo" the choice every turn.
**Full spec:** see `CURRENT_PR.md`.
**Verdict:** _pending playtest._

---

## Next — sketched as questions (rough approach only)

### M2 — Archer + cover: can the player be forced to *move*?  `SOON`
**Question:** does a ranged enemy that punishes standing still make positioning
and line-of-sight interesting — and does it give **cover** a reason to exist?
**Rough approach:** one archer with telegraphed line-of-fire; introduce a cover
property on some objects (crate = cover until burned). Likely the first PR where
a *defensive* option matters.
*(Depends on M1 landing well. If M1 reveals two orcs is already fiddly, this
becomes a controls/readability PR instead.)*

### M3 — A second enemy shape: heavy or swarm?  `SOON`
**Question:** which "different question" is more fun to add next — a **heavy**
(avoid / reposition it; the perfect kick-into-hazard target) or a **fast swarm**
(handle being surrounded; where area-push shines)?
**Rough approach:** pick one based on what M1/M2 taught us, then aim to get two
enemy *types* on the board together so their *combination* starts producing
emergent puzzles.

---

## Parking lot — loose ordered questions

Re-sorted after every session based on what we learned. Detail lives in
`DESIGN.md`.

1. Sound / aggro as the concrete cost of "loud" (lure enemies with noise).
2. Momentum / mass — kicks chaining billiards-style through units.
3. Ledges / pits as instant-removal hazard tiles.
4. Panic system (derived) — spectacle kills rattle the room.
5. Visibility / not-knowing-what's-behind-the-door.
6. Tether / rope — the first *pull/bind* verb (rogue dream).
7. Disarm / pick-up-weapon.
8. Consumables + pre-level shop.
9. Co-op.
10. Everything tagged `ACT-TWO` in `DESIGN.md` (hybrid timing, portals,
    verticality, light/shadow, summoning, ethereal…).
