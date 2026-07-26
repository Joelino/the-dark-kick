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
| `stunned` | loses next action | **`NEXT`** — see §3 |
| `panic` | drives erratic AI behavior | **`ACT-TWO`** — see §5 |

**`wet` living in both lists is the health check** — that shared vocabulary is
exactly what makes combos cheap.

---

## 2. The elements — what's in and what's out

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

## 3. Player model — verbs, kit, and cards

### Permanent verbs (always available, instant, no cooldown)

- **Move** — one tile, orthogonal, per turn.
- **Strike** — reliable damage to an adjacent target.
- **Kick** — the star. Adjacent target; **0 base damage**; its value is what
  happens *because of where the target lands* (see the kick payoff table in the
  current PR spec). Reads the room and does something different every time.

**No cooldowns / no cast times for now.** Cooldowns and cast times are the
machinery of the (parked) hybrid real-time system; adding them early drags us
into that plumbing and adds friction to the exact thing we're trying to prove is
fun. Differentiate kick vs strike by *effect and feel*, not by timers. A cooldown
on kick is a fix kept in the back pocket if kick becomes a boring default.

### Kit vs resources

- **Kit** — ~3 permanent abilities per character. The character's *grammar*.
- **Consumables** — the *spice*. Some bought pre-level, some found mid-level.
  They widen the per-turn decision space without kit bloat, are inherently
  discussable in co-op, and feed the improvisation fantasy.
- **Guardrail:** consumables must interact with the **same terrain physics** the
  kit does. A fire grenade ignites the same `flammable` wood a fire arrow does.
  Consumables resolve *on the board*, never as raw damage.

### Cards / progression

Cards are **adjectives** (Pillar 3). They modify verbs — *your kick now ignites*,
*your kick knocks back two tiles* — as items, modifiers, and class traits. They
never grant a verb and never become moment-to-moment actions.

---

## 4. Enemies — types are questions, not stat blocks

A good enemy type forces a different *question*, which pushes the player toward a
different tool they already have.

| Enemy | Question it asks | Pushes player toward |
|---|---|---|
| **Basic orc** | (baseline) will you engage or route around it? | first real decision |
| **Archer** `SOON` | can you close distance / break line of sight? | cover, terrain, approach |
| **Heavy / slow / powerful** `SOON` | can you avoid or *reposition* it? | kick-into-hazard (too dangerous to trade blows) |
| **Fast / weak swarm** `SOON` | can you handle being surrounded? | area-push, kick-them-into-each-other |

**The magic is in combination, not any single type.** An archer behind a heavy
is a genuine puzzle — the heavy blocks approach while the archer plinks — built
from two dumb, fully-telegraphed units. That's Into-the-Breach depth *without*
any single clever AI.

**Sequence:** basic orc with intent → archer → heavy → then let them combine.

---

## 5. Panic — a derived system  `ACT-TWO`

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
- **Telegraph panic too.** A panicked unit still shows its intent — it's just a
  scarier / more erratic intent you can see coming. Keep panic a status with
  clear thresholds and a visible indicator, never a hidden mood. (This keeps it
  consistent with Pillar 2: legible, not solvable.)

---

## 6. Backlog — parked mechanics, ranked & reasoned

Roughly ordered by priority within their phase. Each carries *why*.

### The "rogue dream" trio (high interest)

1. **Tether / rope** `ACT-TWO` — **standout new idea.** The first verb that
   *pulls / binds* rather than pushes. Enables emergent player-made traps: link
   two enemies, kick one into fire, the other drags along. Highest-priority new
   element. Rogue-archetype flavored.
2. **Disarm / pick up weapon** `ACT-TWO` — turns consumables into a *board
   action*. Killing the right enemy first becomes a setup move. Strong keep.
3. **Generic trigger** (plug into map objects) `ACT-TWO` — bigger and more
   powerful than rope, but risks becoming a construction-kit. Keep it
   rogue-flavored and *small*, or it eats the game.

### Spatial / terrain

- **Cover** `SOON` — first *defensive* verb; fills the "plodding walk-into-
  position" turn. Inherits object physics for free (a crate is cover until it
  burns; a pillar until it collapses). **Dependency:** needs a ranged threat to
  matter, so it arrives alongside archers.
- **Momentum / mass** `SOON` — kicks chain billiards-style through units.
  Cheapest and most on-thesis expansion of the proven verb. (Claude's
  suggestion; not yet adopted.)
- **Elevation — split into two divorced ideas:**
  - **(a) Ledges / pits as instant-removal tiles** `SOON` — cheap, on-thesis,
    prototype early. Just another hazard the kick can exploit.
  - **(b) True multi-floor verticality** `ACT-TWO` — a monster that fights phone
    readability. Park it (with portals).
- **Doors — open / close / barricade** `ACT-TWO` — good texture (feeds
  quiet-vs-loud) but adds no *new* interaction. Seasoning, ranked lowest.

### Perception / stealth-adjacent

- **Sound / aggro** `SOON` — noise propagates like fire and pulls enemies;
  weaponize it as a *lure*. This is the concrete cost of loud options (the Power
  Strike's price). Bring in within a few iterations.
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
  not fun. Strict turns until there's a real reason.
