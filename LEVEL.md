# The First Cellar — Level Rules

## Gameplay question

Can one short, deterministic encounter create satisfying positional decisions once enemies take visible turns?

This document defines the first playable phase of **The First Cellar**. It keeps the current Move, Strike, Kick, walls, spikes, and exit rules, then adds only enough enemy behavior, player health, and turn feedback to make the room feel like a complete encounter.

Move, Strike, Kick, wall, spike, exit, and corpse behavior preserve the current prototype. Player health, defeat, enemy intent, enemy actions, and the expanded combat log describe the next iteration.

## Level objective

Reach the exit. Killing every enemy is optional.

- Entering the exit completes the level immediately.
- Victory ends the current turn before enemies act.
- Reaching 0 player health loses the level immediately.
- Victory and defeat both lock board input and offer a restart.
- Restart restores positions, health, corpses, intent, combat log, and the turn counter.

A turn limit can be added after basic enemy turns feel good. It is not part of this iteration.

## Turns

The HUD's `TURN N` means one player decision and the enemy response to it.

- The level starts on Turn 1 in the player phase.
- Selecting an action or tapping an illegal target does not spend the turn.
- One resolved Move, Strike, or Kick spends the player's action.
- The enemy phase then resolves, unless the player has already won or lost.
- When the enemy phase finishes, the turn number increases and a new player phase begins.
- Input remains locked while an action or enemy phase is animating.
- Reset is a UI command, not an action, and never spends a turn.

The victory panel reports the number of the turn on which the player escaped. A defeat panel does the same.

## Turn order

Each turn resolves in this order:

1. **Show intent.** Every living enemy has one exact, visible intent: attack a tile, move to a tile, or wait.
2. **Player action.** The player resolves one legal Move, Strike, or Kick, including damage, forced movement, collisions, hazards, and death.
3. **Check victory.** If the player entered the exit, the level ends and the enemy phase is skipped.
4. **Enemy actions.** Living enemies perform their committed intents in board reading order: top to bottom, then left to right.
5. **Check defeat after each enemy.** If the player reaches 0 health, the level ends and later enemies do not act.
6. **Start the next turn.** Increase the turn number, choose new enemy intents from the resulting board state, and return control to the player.

An enemy does not secretly replace a disrupted intent. If its intended move is no longer legal, it waits. If its intended attack tile no longer contains the player, or the attacker is no longer adjacent to that tile, it attacks that tile and misses. Killing or repositioning an enemy can therefore prevent its planned action.

For the first enemy-turn implementation there is one basic orc:

- If orthogonally adjacent to the player when intent is chosen, it intends to Strike the player's current tile for 1 damage.
- Otherwise, it intends to move one orthogonal tile along a shortest available path toward the player.
- If equally short paths exist, choose deterministically using board reading order: up, left, right, then down.
- If no path exists, it intends to wait.
- A move is its whole action; it never moves and attacks in the same enemy phase.

The intent preview should show the exact destination or attacked tile on the board, not only a generic icon above the enemy.

## Health and damage

Initial tuning values:

- Player: 5 maximum health and 5 starting health.
- Basic orc: 4 maximum health and 4 starting health.
- Player Basic Strike: 1 damage.
- Player Kick: 1 base damage.
- Kick collision with a wall or board edge: 1 additional damage.
- Forced movement onto spikes: 3 additional damage.
- Basic orc Strike: 1 damage.

Damage is deterministic and applies immediately. Bonus damage from a collision or spikes is part of the same action, but the combat log identifies its cause.

- At 0 health, a unit dies immediately.
- Dead enemies leave a corpse on their final tile and lose any pending intent.
- Corpses are visual remains: they do not block movement, targeting, or forced movement.
- Player health does not regenerate during the level.
- There is no armor, healing, critical damage, or random damage in this phase.
- Spikes trigger only when forced movement places a unit on them. Normal movement across spikes is safe, and standing on spikes does not repeat damage.

The player HUD always shows current and maximum health. Enemy health remains visible above each enemy; adding a numeric value such as `3/4` alongside the bar is preferred while tuning.

## Movement

Player and enemy movement share the same basic occupancy rules.

- A Move travels exactly one tile up, down, left, or right.
- Diagonal movement is not allowed.
- Walls and the edge of the board are impassable.
- Living units block movement. Units cannot pass through, overlap, or swap places.
- Floor, exit, spikes, and corpse tiles are traversable.
- The exit is special only for the player; an enemy standing on it blocks entry like any other living occupant.
- Legal player destinations are previewed before the tap.
- An illegal tap leaves all state unchanged and produces no animation or log entry.

A Kick is forced movement, not a Move. It uses the existing collision and spike rules and can invalidate the target's committed intent.

Enemy pathfinding seeks the closest unoccupied tile orthogonally adjacent to the player and considers other living units and walls blocked. It may route across exit, spike, and corpse tiles because normal movement onto those tiles has no special effect. Intent selection and pathfinding must be pure and deterministic so the preview always matches resolution unless the player disrupts it.

## Combat log

The combat log is a compact record of resolved events, not flavor text and not an input tutorial.

- Append an entry only when game state changes or a committed enemy action resolves.
- Prefix every entry with its turn number and actor.
- State the action first, followed by damage, movement, collision, hazard, miss, or death details.
- Use the same rule result that drives gameplay to create the message; the renderer must not reconstruct outcomes independently.
- Keep the newest four entries visible. Remove the oldest entry when a fifth is added rather than requiring scrolling on a phone.
- Reset clears the history and inserts one short objective entry.
- Action-selection help remains separate from the log so choosing Move, Strike, or Kick does not erase history.

Example entries:

```text
Escape through the stairs.
T1 You move east.
T1 Orc moves west.
T2 You kick Orc — 4 damage (3 spikes). Orc dies.
```

Other important result wording:

```text
T3 You kick Orc — 2 damage (1 wall collision).
T4 Orc strikes — 1 damage. You have 3/5 health.
T5 Orc strikes your old position and misses.
T6 Orc's move is blocked. Orc waits.
```

Animations may delay when an entry appears, but the entry order must match rule resolution order. Input stays locked until both have finished.

## Proposed next PR

**Gameplay question:** Does one telegraphed, one-action orc make movement and Kick more tactically meaningful without slowing the game down?

The next PR should implement the smallest complete enemy-turn slice:

1. Add player health, defeat state, and restart behavior to the pure game state.
2. Separate a numbered turn into player and enemy phases; only legal resolved player actions advance play.
3. Add deterministic orc intent selection, shortest-path movement, a 1-damage adjacent Strike, and committed-intent resolution.
4. Render exact enemy intent on the board and keep input locked during enemy animations.
5. Replace the single feedback sentence with a four-entry factual combat log, while keeping action-selection help separate.
6. Show player health and a defeat panel without reducing touch target sizes or breaking the phone landscape layout.
7. Add focused rule tests for health and death, turn advancement, immediate exit victory, movement tie-breaking, attack misses, blocked or displaced intents, killed enemies losing intent, and reset.
8. Update `README.md` after implementation and run the full quality checks.

Keep Power Strike, Fire Arrow, destructible objects, multiple enemy behaviors, a turn limit, and broader level redesign out of this PR. They can build on the turn/event model once the basic loop has been tested on a phone.

Before merging, run:

```bash
npm ci
npm run typecheck
npm run test
npm run build
```
