# Current PR QA Notes

## Gameplay question

Do two telegraphed orcs, strict player turns, and stun make positioning and Kick
more tactically meaningful without making the encounter hard to read?

## Automated rule checks

- A player may move once and act once, in either order.
- End Turn advances the enemy phase even when the player moved and acted zero
  times.
- Open-floor Kick repositions for 0 damage.
- Wall and enemy collisions apply their damage and stun rules.
- A forced spike landing still deals 4 total damage: 1 impact plus the configured
  3 spike damage.
- Walking onto spikes deals the configured 3 damage to players and enemies.
- Enemy pathfinding chooses a spike-free route when one exists, but can cross a
  spike if there is no safe route.
- Stun removes intent, skips one enemy action, and expires afterward.

## Browser walkthrough

Tested at 844 × 390 and 960 × 540 landscape viewports:

- The game fits without scrolling and all primary controls remain tappable.
- Turn Order opens by default as a vertical stack of portrait cards. Every card
  includes current/max HP and attack strength at both tested layouts.
- The player sprite has a readable HP bar matching the HUD/card value.
- The top card is the next unit to resolve. The player card is removed during
  the enemy phase, and each resolved enemy card is removed in turn.
- END TURN is centered inside its button without clipping.
- Ending Turn 1 without moving or acting advances both orcs and opens Turn 2.
- Enemy movement uses a visible hop/squash animation instead of teleporting.
- An adjacent enemy strike visibly winds up, lunges, flashes the player red,
  shows damage, and returns before the next unit resolves.
- The former red star has been replaced by a red outlined target tile labeled
  ATTACK. It clears when the committed action resolves; if the orc remains
  adjacent, a new marker appears for its newly committed next-turn attack.
- No browser console errors were emitted during the walkthrough.

## Assumptions and spec gaps

- The PR specified spike damage only for forced movement, while a reasonable
  hazard rule also requires damage on voluntary entry. Normal spike entry now
  deals the configured 3 damage and is covered by tests.
- The PR simultaneously specifies 0 base Kick damage, a +3 spike bonus, and a
  guaranteed kill against a 4-HP orc. Those numbers do not add up. The existing
  implementation's explicit 1-point forced-impact damage plus 3 spike damage is
  retained, for a 4-point spike Kick.
- "AI should avoid spikes" is interpreted as: find any safe path first; only
  consider a spike-crossing path when no safe route exists. This keeps the AI
  deterministic and prevents it from waiting forever when spikes are unavoidable.

## Human playtest still required

Automated and browser QA can verify correctness, legibility, layout, and feedback.
They cannot decide whether the encounter is fun, whether animations feel too
slow on a physical phone, or whether the tactical choices are interesting.
Those remain the goals of the human playtest.

### Flag for the next spec

The close-range interaction between the player character and the orc AI still
feels weird in the current playtest, but the report is not specific enough to
justify changing a rule safely in this polish pass. Before adding another enemy
type, the next spec should include exact reproduction turns and the desired
result for:

- adjacency and body-blocking;
- committed attacks after the player moves or Kicks an orc;
- whether the current player-action/enemy-response cadence feels natural; and
- whether movement and attack lunges make contact positions look misleading.

Treat this as an M1 readability/game-feel follow-up, not as permission to invent
a new combat mechanic.

## Reusable QA handoff template

For each implementation PR, replace the sections above with:

1. The gameplay question the change is meant to answer.
2. Automated rule checks mapped to the acceptance criteria.
3. A phone-sized browser walkthrough covering the happy path, skipping/illegal
   actions, failure states, and any new animation or responsive UI.
4. Assumptions, contradictions, and reasonable-person expectations not stated
   explicitly in the build spec.
5. Items that genuinely require a human playtest.
