# The Dark Kick — Project Brief

> **Rate of change:** rarely. This is the north star. If a decision below starts
> feeling wrong, that's a big deal — stop and discuss before editing.
> **Audience:** humans (Viktor + Claude) reasoning about direction.

---

## The one-line thesis

**Combos happen on the map, not in the hand.**

The depth of this game does not come from a clever deck, a big ability list, or
deep single-unit AI. It comes from a small set of always-available verbs
interacting with a room full of terrain and enemies. You don't assemble a combo
from cards — you *improvise* one out of whatever the room gives you.

The proven core: kicking an enemy into spikes / a wall / another enemy already
feels good on a phone. Everything we build should feed that verb, not compete
with it.

---

## Design pillars

These are the tie-breakers. When two options both seem fine, pick the one that
serves these.

### 1. Power fantasy first — turn the room into a weapon

The primary feeling is *badass*: you are more dangerous than the room, and the
room is your arsenal. We design the power fantasy first, make it genuinely
challenging, and only *then* design outnumbered / survival encounters as a
variation — never as the default mood.

**Quiet is a player choice, never an enforced mode.** There is no stealth
*system* bolted on. Stealth is emergent and self-imposed — the player who wants
a quiet approach can choose one (and pays for loud options like a Power Strike
with noise). Reference point: Broforce — 90% glorious chaos, with the occasional
self-chosen quiet beat. Not a stealth game with a chaos option; a chaos game
with a quiet option.

### 2. Legible causality — *not* perfect information

This is the pillar that separates us from Into the Breach, and it's easy to get
wrong, so state it precisely:

- **Into the Breach** gives you *perfect information* so you can compute the
  optimal turn. That produces a cerebral, solved-puzzle feeling. **We do not
  want that.** It's too much like work for the late-night, decompress,
  brain-on-but-not-maxed vibe we're after.
- **We want legible causality instead.** The physics are deterministic and
  knowable. The player understands the *rules* of cause and effect well enough
  to attempt an audacious combo — push him into the barrel, barrel into the
  fire, fire onto the bomb — *without* being able to fully pre-compute whether
  it all lands.

**The fun lives in the gap** between "I'm pretty sure this'll be glorious" and
"I know exactly what happens." Legible rules, emergent results. You eyeball it,
go *probably*, and pull the trigger to watch chaos unfold.

Practical consequence: individual mechanics stay deterministic and readable
(deterministic triggers, deterministic thresholds, visible states). We create
difficulty-of-prediction through *depth of interaction*, not through hidden dice.

### 3. Verbs are permanent, cards are adjectives

The core verbs (move, strike, kick, and later additions) are **permanent and
always available** — this is what preserves the Dark Messiah improvisation. You
never draw for your kick.

Progression, items, and character classes are **adjectives on those verbs**: a
card doesn't *grant* kick, it makes your kick *ignite* / *knock back further* /
*pull instead of push*. This deliberately leans us toward the Into the Breach end
(spatial depth) and away from Slay the Spire hand-management.

---

## Influences (and how we diverge)

- **Dark Messiah of Might & Magic** — the feeling. Environmental improvisation,
  the room as a weapon. This is the emotional target.
- **Into the Breach** — readable, telegraphed grid tactics and multiple
  interacting agents. We take the readability and the interaction depth, but
  **reject its perfect information** (see Pillar 2).
- **Broforce** — the power-fantasy-with-optional-quiet tone (see Pillar 1).
- **Slay the Spire / Gloomhaven** — card/kit-driven selection and the
  move-plus-action turn economy. We take the economy, but keep the verbs off the
  cards (see Pillar 3).

---

## Platform & shape

- Touch-first, tuned for **phone in landscape**. Readability on a small screen is
  a hard constraint — it vetoes mechanics that need fine reading (this is why
  true multi-floor verticality is parked).
- Grid tactics, square grid.
- Built to be playable in short, decompressing sessions, ideally with **co-op**
  as a first-class future goal (co-op is a reason several mechanics earn their
  place — consumables, tether, panic all get *more* fun when discussed with a
  partner).
