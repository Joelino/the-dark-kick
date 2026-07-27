# The First Cellar — Level Rules

## Gameplay question

Does a faster player, live enemy activations, and tile-committed charged attacks
create a readable tactical room without the edge cases caused by stored enemy
plans?

## Objective and room

Reach the exit. Killing every orc is optional.

- Entering the exit wins immediately, before an enemy phase.
- Reaching 0 player health loses immediately.
- Victory and defeat lock board input and offer a fresh run with the currently
  applied tuning values.
- The 8×6 room has a western setup area, a short hazardous upper choke, a
  longer spike-free lower choke, and an eastern exit side. The two routes
  reconnect, so hazards affect route value without becoming mandatory.
- Walls form useful Kick backstops. Three spike tiles can be approached
  voluntarily or used as deterministic Kick payoffs.

## Round grammar

Every living unit uses the same ordered activation shape: optional orthogonal
movement, then at most one basic or charged action.

The fixed round order is:

1. Player turn.
2. Enemy phase in the visible card order.
3. Charge step: player charges first, then enemy charges in that same fixed
   order.

The player begins each turn with `playerMovePoints` (default 2) and one action.
The movement preview covers every destination reachable with the remaining
points; tapping a farther destination spends each point along the deterministic
shortest path. Movement can happen only before the action. Taking Strike, Kick,
or Power Strike immediately starts the enemy phase, even if movement remains.
Unused movement is lost. **End Turn** may skip either or both parts.

Each orc has `orcMovePoints` (default 1). On activation it reads the live board,
moves along a deterministic shortest path if useful, then immediately Strikes
if adjacent. It stores no plan and shows no destination or attack telegraph. A
blocked movement never removes an otherwise legal Strike.

## Player actions

- **Strike** resolves immediately against one adjacent orc for `strikeDamage`.
- **Kick** resolves immediately against one adjacent orc. Open floor repositions
  it for `kickBaseDamage`. A wall, board edge, or unit collision adds
  `forcedImpactDamage`; solid collisions apply stun. A pushed unit landing on
  spikes takes both forced-impact and spike damage.
- **Power Strike** commits to one orthogonally adjacent tile. Its persistent
  marker remains until the charge step. It deals `powerStrikeDamage` to whatever
  unit occupies that tile when it resolves. An empty tile is an intentional
  whiff and is logged as such.

Power Strike commits to a tile, never a unit. Moving, displacement, or stun does
not cancel it. The sole exception is actor death: all charges belonging to a
dead actor are removed.

With `chargeWindupRounds` at its default 1, a player charge resolves after that
round's enemy phase. An enemy charge declared during an enemy phase would
resolve after the following player turn. Enemy charged actions are supported by
the rule model but no enemy uses one in this milestone.

## Kick, stun, and cooldown

Default Kick payoffs:

| Tile behind the target | Result |
| --- | --- |
| Open floor | Move one tile; 0 damage |
| Wall or board edge | 1 forced-impact damage; stun |
| Another unit | No movement; pushed unit takes 1; both units are stunned |
| Spikes | 1 forced impact + 3 spike damage; a full-health 4 HP orc dies |

A stunned unit loses its next full activation—movement and action—while its
persistent stars remain visible. Stun does not cancel a charge declared before
the skipped activation.

`kickCooldownRounds` defaults to 0. At a positive value, Kick is disabled for
that many subsequent player turns and its control displays the remaining count.

## Hazards, occupancy, and pathfinding

- Movement is one orthogonal tile per point; diagonals are never legal.
- Walls, board edges, and living units block voluntary movement.
- Corpses do not block.
- Entering spikes by voluntary or forced movement deals `spikeDamage` once.
  Standing on spikes does not repeat damage.
- Orcs path toward the nearest legal tile adjacent to the player. They prefer a
  spike-free shortest route and cross spikes only if no safe route exists.
- Equal paths resolve deterministically in up, left, right, down exploration
  order.

## Readability and tuning

Orcs carry no persistent mode badge and no stored action tell. Hovering an orc,
or tapping it on mobile when it is not a legal action target, temporarily shows
one red danger language: bright solid cells are positions the orc can threaten
after moving, while muted hatched cells are its immediate no-move Strike range.
A deterministic route points to the player. This inspection is derived from the
live board and is never stored in game state. Stun stars and Power Strike tile
markers remain readable without animation.

The launch screen exposes every combat integer with clamped −/+ steppers and a
Reset to Defaults control. Values are applied as one configuration snapshot
when **Start Run** is tapped. Defaults and ranges are defined only in
`src/config/combat.ts`.

The launch screen also opens the single-slot level editor described in
`docs/LEVEL_EDITOR.md`. A saved editor room becomes the active room for the next
run and subsequent reloads on that device.

The tactical readout keeps the visible activation order and the newest four
combat-log entries. Movement, damage, stun, deaths, charge declarations,
resolutions, and whiffs are logged from rule results.
