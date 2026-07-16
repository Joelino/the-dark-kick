# The Dark Kick — Project Brief

## What we are building

A touch-first tactical game prototype inspired by the environmental improvisation of **Dark Messiah**, the readable grid tactics of **Into the Breach**, and card-driven action selection from games such as **Slay the Spire** and **Gloomhaven**.

The core fantasy is:

> Simple actions become powerful when combined with enemies, terrain, and interactive objects.

The player should feel clever because they notice and exploit the room, not because they memorized a long list of complicated cards.

## Target experience

- Fast, readable tactical turns on a small grid.
- Strong environmental interactions and “I can do that?” moments.
- Basic actions remain available without cards.
- Cards make actions dramatically more effective or alter the rules.
- Positioning matters as much as the cards in hand.
- Missions should eventually support goals beyond killing every enemy, such as reaching an exit, escaping, or stealing an objective.
- Mistakes should create improvisation rather than immediately ruining a run.

A longer-term possibility is cooperative play with short action bursts followed by planning pauses. This is a direction to explore later, not a current requirement.

## Core mechanical model

The first three action families are:

### Damage

Reliable, direct resolution. Best for a single immediate target, armor, and breakable structures.

- **Basic Strike:** adjacent, low damage, always available.
- **Power Strike:** stronger direct damage and structural destruction.

### Force

Repositions enemies and objects. Its value depends on the room.

- **Kick:** deals small base damage and pushes one tile.
- Extra effects come from collision with walls, spikes, fire, ledges, objects, or other units.

### Transformation

Changes what terrain and objects do over time.

- **Fire Arrow:** ignites terrain or flammable objects.
- Fire creates unsafe space, spreads through wood, and activates explosive materials.

The intended temporal identities are:

- Damage is decisive.
- Force is tactical and opportunistic.
- Transformation is strategic and shapes the coming turns.

## Environmental rules

Objects and terrain should use shared, composable properties rather than one-off scripted interactions.

Useful object properties include:

- Weight: movable, heavy, fixed.
- Durability.
- Material: wood, metal, stone, oil, powder.
- State: intact, damaged, burning, broken.
- Contents: empty, oil, powder, debris.

Initial interaction ideas:

- Fire spreads through connected wooden terrain and wooden objects.
- A kicked brazier creates a thin, longer fire trail.
- A Power Strike on a brazier creates a wider, shorter fire area behind it.
- Wooden crates can be pushed, broken, burned, or kicked into enemies.
- Powder barrels can be repositioned, ruptured, and ignited.
- Structural supports can be destroyed to alter routes or drop debris.
- Walls add collision damage and may cause disarm effects.
- Spikes deal major bonus damage when a unit is forcibly pushed onto them.
- Ledges provide rare, high-value instant removal.

The prototype should prefer deterministic previews over random outcomes.

## Current implementation

The current web prototype uses Phaser 3, TypeScript, Vite, Vitest, npm, GitHub Actions, and GitHub Pages.

Implemented:

- Touch-first 8×6 grid.
- One-tile orthogonal movement.
- Exit and victory state.
- Stationary 4 HP training enemy.
- Basic Strike.
- Kick with push, wall collision, and spike damage.
- Responsive phone layout and landscape orientation support.
- Automated type checking, unit tests, build, CI, and deployment.

The enemy is currently optional and has no AI.

## Near-term development direction

Proceed in small, testable vertical slices:

1. Validate that movement, targeting, Strike, Kick, walls, and spikes feel good on a real phone.
2. Improve input clarity, feedback, animation, and board readability.
3. Add Power Strike and destructible objects.
4. Add Fire Arrow and deterministic fire propagation.
5. Add one or two simple enemy behaviors and visible intent.
6. Build a compact handcrafted encounter that requires reaching the exit within a turn limit.
7. Only then consider decks, card progression, timers, real-time action phases, co-op, or procedural content.

Each iteration should answer a gameplay question, not merely add features.

## Design guardrails

- Combos should happen on the map, not only in the hand.
- Cards should be simple verbs whose complexity comes from interaction.
- The board must not feel like decoration around a card game.
- Direct damage is allowed and useful, but environmental play should create additional value.
- Avoid making every action another variation of pushing.
- Keep complete information where it improves clarity, but avoid creating a single obviously calculable solution to every turn.
- Avoid randomness when it obscures cause and effect during early prototyping.
- Do not build multiplayer, progression, a large content pipeline, or a general-purpose engine before the core interaction is proven.
