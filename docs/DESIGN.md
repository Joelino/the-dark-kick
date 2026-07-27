# The Dark Kick — Design & Mechanics

> **Rate of change:** every session. This is the working catalog of the whole
> mechanics vocabulary — live, planned, and parked. **This is the file to read
> first to reload the design conversation** without re-deriving it.
> **Audience:** humans (Viktor + Claude) reasoning about mechanics.
>
> **Status tags:** `LIVE` (in the build) · `NEXT` (this or the immediately
> planned PR) · `SOON` (a few iterations out) · `ACT-TWO` (deliberately parked
> for a later phase) · `REJECTED` (considered and cut, with reason).

---

## 1. The core architecture: composable properties

The engine of cheap depth. Instead of hand-authoring every interaction, we
maintain a **small set of shared, composable flags** that all abilities,
consumables, and terrain read from and write to. Combinatorial depth falls out
of a short list — and, critically, **avoids power creep**, because new content
is mostly new *combinations* of existing flags, not new bespoke rules.

**Reference & caution — Magicka.** Magicka is the inspiration for the composable
approach (water is a pure *enabler*: wet + lightning = lethal, wet + cold =
frozen lockdown; combos *multiply*, they don't *add*). But its lesson is also a
warning: 8 base elements → 1000+ combos → most players spam 3. **Combinatorial
explosion is not depth.** Keep the base list small (~4). We admire the mechanism;
we deliberately do not borrow heavily.

### The test every element must pass

> **Does it create a new noun on the board, or does it just subtract HP?**

An element earns its place only if it makes something new happen *spatially* —
a new state, a new interaction, a new setup. If it's "a damage number with a
hat on," it's cut.

### Tile properties

| Flag | Meaning | Talks to |
|---|---|---|
| `flammable` | wood, etc. — holds and spreads fire | fire, burning |
| `wet` / `liquid` | enables freezing; cancels burning | freeze, fire |
| `frozen` | slippery → sliding | **push** (a frozen tile makes a shove slide further) |
| `solid` vs `fragile` | fragile can collapse | collapse/removal triggers |

*Oil* is not a primitive — it decomposes into `flammable` + `liquid`. That
decomposition working cleanly is the sign the vocabulary is right.

### Unit conditions

| Flag | Meaning | Notes |
|---|---|---|
| `burning` | ticks damage, spreads | applies to anything flammable, including some units; fire-immune units/areas are allowed |
| `wet` | cancels burning, sets up freeze | the good composability tell — `wet` appears on both tiles and units |
| `frozen` | skip-turn or slide | talks to push |
| `off-balance` / `prone` | from hard collision | |
| `stunned` | loses next activation | `LIVE` — retained, but see §2 (it was implicated in M1's kick-lockout exploit) |
| `charging` | has a declared charged action pending | **`NEXT`** — see §2 |
| `panic` | drives erratic AI behavior | **`ACT-TWO`** — see §8 |

**`wet` living in both lists is the health check** — that shared vocabulary is
exactly what makes combos cheap.

---

## 2. The turn grammar — the spine  `NEXT`

> **This replaces the M1 ruleset wholesale.** M1's failure was *foundational*:
> enemies committed to a plan a turn early, so every "but what if the player
> moved first" needed its own patch rule. **A system that needs that much
> corner-case handling is a bad system.** The goal here is few axioms, no
> exceptions, and behaviour that survives edge cases for free rather than by
> enumeration.

### One grammar, every unit

Player and enemies read from the **same** structure:

> **Optional move** (spend up to your move points), **then one action.**
> The action is either a **basic action** — resolves immediately — or a
> **charged action** — telegraphs now, resolves later.

The symmetry is the tell that this is a real abstraction and not a bolt-on: the
orc's fireball and the player's Power Strike run on identical rules.

### Axiom 1 — basic actions resolve instantly, against the live board

No stored plan, no telegraph. A unit decides *and* acts in the same instant,
reading the board as it is at that moment. This is the **Gloomhaven** model:
move and attack fused into one activation.

Two whole classes of bug die here:

- **No stale plans.** Nothing is committed a turn early, so there is nothing to
  invalidate. The M1 "orc freezes because you took its target tile" bug cannot
  be *expressed* in this system.
- **No trivial kiting.** If an orc can reach you this turn, it reaches you *and*
  hits you. You can't walk backwards forever.

That second point is why we don't simply copy Into the Breach wholesale. **ItB's
telegraph-everything model is safe there because the player unit is not the
objective** — the Vek are attacking *stationary buildings*, so your mechs are
free safeties. In our game the player *is* the target and the only thing that
can't be destroyed, so a telegraphed melee attacker chasing a mobile player is
trivially kiteable. Different objective structure, different resolution model.

*(We also considered anchoring the player with something to defend or a turn
limit, ItB-style. Rejected for now: it cuts against the run-the-room power
fantasy in Pillar 1.)*

### Axiom 2 — only charged actions telegraph, and they **always** resolve

Charged actions are the dangerous ones: heavy hits, area effects, fire, ranged
shots. They place a marker on a **tile** when declared, and they fire at that
tile later — **whether or not it still makes sense**. No cancellation, no
re-planning, no validity check.

This *is* the Into the Breach model, and the whiff is the *point*: displacing a
charging enemy makes its attack land on empty ground. **Forcing whiffs is player
skill.** Note the precise borrowing — ItB commits to a **tile**, not to a
**target**. That one distinction is exactly what M1 got wrong: M1's orc
*cancelled* when displaced, which read as dead; ItB's alien fires anyway, which
reads as you outplaying it.

Movement, by contrast, resolves live (Axiom 1), so "I wanted to move there and
the player is standing on it" needs no special rule — the move is simply
forfeited. No move-attack hybrid marker is needed, because move and action are
never fused into one telegraph.

### Axiom 3 — telegraphing is a signal, not decoration

In M1 *everything* was telegraphed, which made telegraphing noise. Reserving it
for charged actions means a marker on the board now *means* "something nasty is
winding up, reposition." The player learns to read threat level at a glance.
This is Pillar 2 (legible causality) doing real work instead of pretending.

### Charge timing

> **Claude's proposal, not yet playtested. This is the session's main open
> question.** Viktor settled "resolves after the enemy turn" and "player
> resolves first"; the symmetry rule below is a proposed completion of that.

Charges resolve in a **charge step at the end of each round**, after the enemy
phase. The rule that makes it symmetric:

> A charge resolves once the **opposing side has had exactly one activation** to
> respond to it.

- **Player declares** during the player turn → enemies move → **the charge fires
  at the end of that same round.** Enemies can walk *into* it, so a charge is a
  **trap you set**, not just a slow attack. That points the room-as-weapon
  fantasy somewhere new: you don't just kick them into a hazard, you *become*
  the hazard.
- **Enemy declares** during the enemy phase → player gets a full turn to
  displace it → it fires at the end of the *next* round.

**Within** the charge step, order is fixed and **the player resolves first.**
Viktor's note: that's potentially very powerful, and there's real strategic
texture to mine once multiple charged units share a board. Flagged, not settled.

Rationale for the short wind-up: a two-full-round commitment is so expensive
that players avoid it, and an unused mechanic teaches nothing.

### Why this reverses the old "no cooldowns, no cast times" stance

This file previously banned cooldowns and cast times on the grounds that they
were plumbing for the parked real-time hybrid. **That reasoning no longer
holds.** A charged action is a *turn-based* wind-up — it costs a round, not a
timer — and it is the only clean home for telegraphing now that basic actions
resolve live. Cast time earned its place by *solving a structural problem*, not
by being a nice feature. Strict turns are still the rule; the real-time hybrid
stays parked (§9).

Related: **kick gets a cooldown as a first-class concept**, defaulted to 0 (off)
and tunable. This is the back-pocket lever for "kick becomes a boring default" —
now available to test rather than theorise about.

### What still needs pressure-testing

- **Does the M1 kick-forever exploit die on its own?** Probably: shoving an orc
  one tile no longer consumes its response, because it moves *and* attacks on
  its own activation. But **stun-into-wall lockout** may still chain — that's
  what the kick cooldown is for.
- **2-move player vs 1-move orcs** risks making orcs read as "slowly moving
  labyrinth walls" rather than threats. Intended counterweight: **level
  geometry, not a stat nerf** (§6, and see the level requirements in
  `CURRENT_PR.md`). If geometry isn't enough, the fix is enemy *variety* later,
  not contorting these rules now.
- **Is an un-telegraphed basic orc readable enough?** A lightweight *state* tell
  (idle / pursuing) is cheap insurance — see §5.

---

## 3. The elements — what's in and what's out

Fire / water / ice already form a rock-paper-scissors loop (fire dries wet; wet
enables freeze; wet cancels burning).

- **push** — `LIVE`. The proven, bread-and-butter verb. Feels good on a phone.
  Everything is built around it.
- **fire** — locked as core. Ignites `flammable`, applies `burning`, spreads.
- **wet** — locked as core. Pure enabler. Cancels burning, sets up freeze.
- **freeze** — locked as core. **Earns its place** because it chains: wet + cold
  = slippery, and slippery talks to push. It creates new board state, not just
  damage.
- **lightning** — `REJECTED` (kept at best second-rate). Fails the test above:
  it's a damage number with a hat on. It doesn't create a new noun on the board.
  Parked unless a design reason appears that gives it a spatial identity.

**Locked near-term element set: push, fire, wet, freeze.**

---

## 4. Player model — verbs, kit, and cards

### Permanent verbs (always available)

- **Move** — orthogonal, spend up to your move points. **The player moves 2 by
  default as of M2**; this is the change that makes juking possible at all (see
  §2 and §6). It is a config value, meant to be dialled at the tuning screen.
- **Strike** — reliable damage to an adjacent target. *Basic action.*
- **Kick** — the star. Adjacent target; **0 base damage**; its value is what
  happens *because of where the target lands*. Reads the room and does something
  different every time. *Basic action*, now with an optional **cooldown**
  (default 0).
- **Power Strike** — heavy damage and destruction. *Charged action* — this is
  the player-side test case for the charge system (§2), and it's already a named
  core verb in `AGENTS.md`, not a new invention.

### Kit vs resources

- **Kit** — ~3 permanent abilities per character. The character's *grammar*.
- **Consumables** — the *spice*. Some bought pre-level, some found mid-level.
  They widen the per-turn decision space without kit bloat, are inherently
  discussable in co-op, and feed the improvisation fantasy. See §7 — the run
  structure is the container these were always waiting for.
- **Guardrail:** consumables must interact with the **same terrain physics** the
  kit does. A fire grenade ignites the same `flammable` wood a fire arrow does.
  Consumables resolve *on the board*, never as raw damage.

### Cards / progression

Cards are **adjectives** (Pillar 3). They modify verbs — *your kick now ignites*,
*your kick knocks back two tiles* — as items, modifiers, and class traits. They
never grant a verb and never become moment-to-moment actions. §7 gives them a
delivery mechanism: an in-run draft.

---

## 5. Enemies — types are questions, not stat blocks

A good enemy type forces a different *question*, which pushes the player toward a
different tool they already have.

| Enemy | Question it asks | Pushes player toward |
|---|---|---|
| **Basic orc** | (baseline) will you engage or route around it? | first real decision |
| **Archer** `SOON` | can you close distance / break line of sight? | cover, terrain, approach |
| **Committed / momentum** `SOON` | can you read its momentum and bait it? | juking, kick-into-hazard |
| **Heavy / slow / powerful** `SOON` | can you avoid or *reposition* it? | kick-into-hazard (too dangerous to trade blows) |
| **Fast / weak swarm** `SOON` | can you handle being surrounded? | area-push, kick-them-into-each-other |

**The baseline orc should need no tutorial.** It does the first thing a player
expects an enemy in this kind of game to do: close on you and hit you. That's
what buys us the attention budget to make *other* elements interesting. It gets
**no persistent mode badge and no action telegraph** (§2, Axiom 1). Instead,
on-demand inspection derives its movement area, post-move attack area, and
route to the player from the live board. That communicates the rule without
turning a generic mode word into permanent visual clutter.

**The committed-movement enemy** (new, from the M2 session) is the interesting
counter to a fast player: it moves several tiles in a straight line and can only
change direction at the end of a committed run. Pure legible causality — you can
*read* its momentum, bait it past you, and line it up with a wall or spike. It
makes player speed a skill expression rather than an escape hatch. Candidate for
M4.

**The archer is the natural first *enemy* charged action** — a telegraphed shot
at a tile you can make whiff by displacing either party.

**The magic is in combination, not any single type.** An archer behind a heavy
is a genuine puzzle — the heavy blocks approach while the archer plinks — built
from two dumb, fully-legible units. That's Into-the-Breach depth *without* any
single clever AI. It's also the honest long-term answer to "a fast player can
outrun a homing orc": fix it with **variety**, not with corner-case rules.

**Sequence:** basic orc (live-resolving) → archer (first enemy charge) → a
second shape → then let them combine.

---

## 6. Spatial resolution — how much angular freedom?  `SOON`

**The problem:** on a 4-direction grid, every push, kick chain, and carom snaps
to one of four vectors, so most of the "wild combo" space is amputated before
you start. Setting an enemy up *precisely* — the Dark Messiah improvisation —
needs more degrees of freedom than up/down/left/right.

**Everything in this section is downstream of §2.** Angular resolution is a
*flavour* question you can only judge properly once the turn grammar feels
right. Don't let it jump the queue.

### The option space, cheapest first

| Option | Buys | Costs | Status |
|---|---|---|---|
| **8-directional movement** | more setup angles; nearly free; keeps the art | diagonal anisotropy (√2 vs 1); moving round a wall corner *looks* like clipping; diagonal line-of-sight is genuinely ambiguous to eyeball | cheap stepping stone |
| **Continuous 360° aim, gridded movement** | the skill-shot; analog expression *in the action* | must define how a continuous vector lands on discrete tiles | **chosen direction** |
| **Hex grid** | isotropy — six equal neighbours, no diagonals at all | **blocked by the art pipeline** | parked |
| **Fine grid** (e.g. 70×50, units span many cells) | angular richness + multi-cell heavies | a full occupancy/footprint engine rewrite; tiny cells fight readability | **`REJECTED`** |

### The chosen direction: gridded movement, continuous aim

**Movement stays on the grid; aim goes 360°.** Kick vectors, throws, and
projectiles get analog direction.

The split is the whole point: **degrees of freedom live in the *action*, where
richness is fun — not in *movement*, where ambiguity is just annoying.**
Position stays discrete and legible (Pillar 2 survives); expression moves into
the verb. And it composes beautifully with §2 — *a charged throw with a
continuous aim vector, telegraphed a round ahead* is the combo dream and the
trap-setting fantasy in a single object.

**Open problem — the crux:** a continuous vector still has to land on a discrete
board. What does "kicked at 30°" mean when the target must stop on a square?
Snap to the nearest tile? Walk the line and stop at the first blocker?
Prototype this in isolation before committing.

### Why hex is parked — and why that's an *art* decision, not a theory one

Hex is theoretically the best answer, and the reason tactical board games reach
for it is **isotropy**: all six neighbours are equidistant, so there are no
diagonals and therefore none of the anisotropy, corner-clipping, or ambiguous
line-of-sight problems that square grids have.

It's blocked by a practical constraint that outranks theory: **the single
biggest felt improvement in this project's history was adding the 32rogues
sprites** — the moment it stopped feeling like a spreadsheet and started feeling
like a game. That's not cosmetic; it's what makes judging *fun* possible at all.
Free and cheap itch.io sprite kits are overwhelmingly authored for square grids;
hex kits are scarce and hard to mix. Going hex means fighting the art or hunting
a new kit, and risks regressing to spreadsheet-feel — which poisons playtesting
itself.

### Why `REJECTED`: the fine grid

Cut during the session, by Viktor, on hearing it played back. It pays a full
spatial-engine rewrite — occupancy, adjacency, footprints, "what's behind the
target"; every existing rule assumes one unit per cell — to buy *the same
angular richness* that continuous aim buys far more cheaply. When two ideas
deliver the same payoff and one costs an order of magnitude more, the expensive
one is dead weight.

### Platform note

The old "phone readability vetoes fine reading" argument has weakened: the
primary target is now desktop co-op, with phone as a first-class *playtest*
surface (see `PROJECT_BRIEF.md`). Continuous aim is fiddly on a touchscreen but
no longer disqualified by it.

---

## 7. Characters, runs, and co-op interlock  `ACT-TWO`

> Design direction only — nothing here is near-term build scope. Recorded so the
> shape doesn't have to be re-derived next session.

### The rubric — five tests any roster system must pass

1. **Verbs permanent, variety delivered as adjectives?** (Pillar 3)
2. **Depth stays *on the board*, not in a hand of abilities?** (Pillars 1 & 3)
3. **Cheap to add a character?** *(weight reduced — see below)*
4. **Survives co-op?**
5. **Does two of them in a room create a combo neither could do alone?**

### The chassis: shared verb spine, tuned per character

Every character has **move, strike, kick**. They differ by **stat tuning plus
one special ability** — the ninja is faster, the knight is armoured, the
fire-warrior resists fire, one lays spikes, one has a kick that shoves three
tiles. (Broforce is the reference: same toolkit, different feel.)

This passes tests 1, 2, 3 and 4 essentially by construction, and it's the same
config-diff philosophy as the tuning screen: **cheap parts, deep combinations.**

**On "isn't that too cheap?"** — Viktor's own hesitation, worth answering
directly: *no*. A spike-layer plus a long-shove is 1 + 1 = 3 from two
config-level abilities. That is exactly the emergent-depth-from-a-small-
vocabulary thesis in `PROJECT_BRIEF.md`. Cheap-and-deep isn't a compromise here,
it's the design philosophy — and it's the pattern behind every good thing in
this project so far (the sprites, the shared property flags, the tuning screen).

### Why the classic warrior / wizard / rogue trio is parked

The wizard, *to feel like a wizard*, wants a **different verb set** — ranged, no
kick. That violates permanent verbs (test 1) and pulls depth off the board into
an ability list (test 2), the Slay-the-Spire direction the brief explicitly
steers away from. It's also three systems to balance rather than one system
tuned three ways — which is *why* it felt hard to balance and why the wizard
kept reading as either boring or overpowered.

**Not rejected — parked as a deliberate, expensive experiment** for when the
cheap chassis is proven and "does a different verb set belong in this game at
all?" is a question worth real money.

*(Note on test 3: **roguelite is not load-bearing.** Viktor may or may not end up
there, which downgrades "cheap to add many characters" from requirement to
nice-to-have. The architecture argument for the shared chassis survives on tests
1, 2, 4 and 5 regardless.)*

### The axis that actually matters: interlock, not distinctiveness

The real motivation for multiple characters is **co-op interdependence** — an
evening with friends where you set up combos *together* instead of each farming
your own corner of the map.

Critically: **"how different are the characters" and "how much do their kits
interlock" are different axes.** Two near-identical characters can be deeply
interdependent; two wildly different ones can each be fully self-sufficient. The
trio-vs-Broforce debate was optimising the wrong axis.

Three ways to build interlock, none of which require divergent classes:

1. **Complementary verbs** — one pushes, another pulls or ignites. Your kick
   sets up my fire; my tether drags them onto your spikes.
2. **Enabler / finisher split** — some characters reposition, expose, or apply
   `wet`; others cash it in. Nobody solo-farms. (This is Magicka's social
   comedy: one player soaks them, the other electrocutes.)
3. **Shared board state** — *the most on-thesis.* The fire I start burns on
   *your* tiles. The panic I trigger routes enemies toward *you*. The room is
   already the weapon; make it the **shared** weapon. Interdependence then comes
   from the environment, not from character asymmetry at all.

### The run: characters are starting leans, not finished kits

Reference: **Inkbound** (and the Slay the Spire lineage).

- A run is a **~2-hour evening arc**, ending in a boss.
- A character starts with a **lean** — trapper, runner, bruiser — plus a small
  starting ability, not a finished kit.
- Between levels you earn currency and **draft** from a few options: a new
  ability, an upgrade to an existing ability, or an item / consumable.
- By the end you're specialised and strong. You *built* the character rather
  than picked it.

**This dissolves the "cheap chassis is too simple" worry entirely.** The
archetype only has to set the *initial lean* — the **run** does the specialising.
Simple pieces, compounding combinations.

**It also snaps onto existing architecture rather than adding scope.** Draft
picks *are* cards-as-adjectives (Pillar 3): *your kick now ignites*, *your kick
shoves three*. The "consumables + pre-level shop" item already in the backlog was
waiting for exactly this container. This is connective tissue, not new scope.

**The co-op crown:** two layers of combo — *within* your growing toolkit, and
*across* both toolkits, because you can see what your partner is drafting. My
drafted spike-layer plus your drafted long-shove, discovered over a run you built
together, is precisely the interdependence goal. Interlock (above) is what you
optimise the draft pool *for*.

---

## 8. Panic — a derived system  `ACT-TWO`

The standout "derived" mechanic: it adds no new player verb; it *reads the horror
of outcomes the player already produces* and feeds a number. It's the Dark
Messiah power fantasy expressed as psychology — you don't just kill them, you
terrify the room.

- **Deterministic triggers, deterministic thresholds.** A slice raises panic a
  little; a kill on spikes raises it more; fire → then pushed onto spikes is a
  huge panic spike (a "panic bomb"). This rewards *spectacle*, which is exactly
  what we want players chasing.
- **Panicked behavior stays legible.** When a unit breaks, it follows a *visible*
  rule — **attack nearest enemy**, not attack *random* enemy. Nearest is
  something the player can see and even set up ("panic him while he's next to his
  buddy and he'll turn on him"). Random is noise that teaches nothing.
  - Rule of thumb: *randomness the player can read and exploit is good texture;
    randomness that only adds variance is bad.*
- **Panic is a strong candidate for shared board state** (§7) — a panicked enemy
  routed toward your co-op partner is interdependence for free.
- **Telegraph panic too.** A panicked unit still shows its intent — it's just a
  scarier / more erratic intent you can see coming. Keep panic a status with
  clear thresholds and a visible indicator, never a hidden mood. (Consistent with
  Pillar 2: legible, not solvable.)

---

## 9. Backlog — parked mechanics, ranked & reasoned

Roughly ordered by priority within their phase. Each carries *why*.

### The "rogue dream" trio (high interest)

1. **Tether / rope** `ACT-TWO` — **standout new idea.** The first verb that
   *pulls / binds* rather than pushes. Enables emergent player-made traps: link
   two enemies, kick one into fire, the other drags along. Highest-priority new
   element. Rogue-archetype flavored. *(Also a natural interlock verb — §7.)*
2. **Disarm / pick up weapon** `ACT-TWO` — turns consumables into a *board
   action*. Killing the right enemy first becomes a setup move. Strong keep.
3. **Generic trigger** (plug into map objects) `ACT-TWO` — bigger and more
   powerful than rope, but risks becoming a construction-kit. Keep it
   rogue-flavored and *small*, or it eats the game.

### Spatial / terrain

- **Cover** `SOON` — first *defensive* verb; fills the "plodding walk-into-
  position" turn. Inherits object physics for free (a crate is cover until it
  burns; a pillar until it collapses). **Dependency:** needs a ranged threat to
  matter, so it arrives alongside archers (M3).
- **Momentum / mass** `SOON` — kicks chain billiards-style through units.
  Cheapest and most on-thesis expansion of the proven verb. *(Gets much more
  interesting with continuous aim — §6.)*
- **Elevation — split into two divorced ideas:**
  - **(a) Ledges / pits as instant-removal tiles** `SOON` — cheap, on-thesis,
    prototype early. Just another hazard the kick can exploit.
  - **(b) True multi-floor verticality** `ACT-TWO` — a monster that fights
    readability. Park it (with portals).
- **Doors — open / close / barricade** `ACT-TWO` — good texture (feeds
  quiet-vs-loud) but adds no *new* interaction. Seasoning, ranked lowest.

### Perception / stealth-adjacent

- **Sound / aggro** `SOON` — noise propagates like fire and pulls enemies;
  weaponize it as a *lure*. This is the concrete cost of loud options (the Power
  Strike's price — and Power Strike is now a charged action, which gives the
  noise a natural moment to happen). Bring in within a few iterations.
- **Visibility** `SOON` — not knowing what's behind a door creates a reason to
  *wait* within a turn. Pairs with sound.
- **Light & shadow** `ACT-TWO` — pulls too hard toward a stealth *system*
  (violates Pillar 1). Mention as potential only.

### Complexity spikes (quarantined)

- **Portals** `ACT-TWO` — explicit complexity spike. Quarantined.
- **Summoning** `ACT-TWO` — **enemy/boss only** (a necromancer spawns bodies you
  kick into hazards). Never a player-class default.
- **Ethereal / phasing** `ACT-TWO` — cautious; immunity *opts the player out of
  the fun*. Only as a brief, telegraphed boss timing-puzzle. Never a player
  default.

### Systems parked wholesale

- **Real-time / turn-based hybrid** `ACT-TWO` — only pays off with co-op +
  pre-committed, variable-cast-time casts. Huge plumbing; would test machinery,
  not fun. Strict turns until there's a real reason. **Note:** adopting charged
  actions (§2) does *not* reopen this. A charge costs a *round*, not a timer.
