# the-dark-kick

Touch-first tactical game interaction prototype.

## Current prototype

The current build is a landscape-oriented Phaser 3 prototype with an 8-column by 6-row square grid. It is tuned for phone landscape play: the board fills most of the screen, the compact status and controls sit beside the board, touch targets are approximately 44 CSS pixels or larger, page scrolling is disabled, and safe-area insets are respected. Small portrait phones show a tasteful “Rotate device for the best experience” overlay instead of a cramped board.

A blue player token starts near the left side of the board, an exit tile sits near the right side, and a stationary training enemy starts with 4 HP. Terrain and occupants are separate: the exit and spikes are traversable terrain, while walls and enemy occupants block movement.

## Controls and rules

Use taps only; drag gestures are not required.

- **Move** is the default action. Legal one-tile orthogonal destinations are highlighted. Moving consumes one turn. Moving onto the exit is legal and completes the level.
- **Basic Strike** targets an orthogonally adjacent enemy, deals 1 damage, and consumes one turn.
- **Kick** targets an orthogonally adjacent enemy, deals 1 damage, and attempts to push the enemy one tile directly away from the player. It consumes one turn.
- If a Kick pushes the enemy toward a wall or the edge of the board, the enemy stays in place and takes 1 additional collision damage.
- If a Kick pushes the enemy onto spikes, the enemy takes 3 additional spike damage and may remain on that spike tile. Spikes do not repeatedly damage stationary enemies in this iteration.
- If the tile behind the enemy is blocked by another enemy, the push fails but the base 1 Kick damage still applies.
- Killing the enemy is optional; the level is completed by reaching the exit.

After victory, board input is disabled and a **Level Complete** panel shows the number of turns used plus a **Play Again** button. **Play Again** and **Reset** restore the initial player position, enemy HP and position, turn count, and victory state.

## Technology

- Phaser 3
- TypeScript with strict type checking
- Vite
- Vitest
- npm
- GitHub Actions for CI and GitHub Pages deployment

No React, Vue, backend, database, external APIs, native iOS code, or external artwork are used.

## Local setup

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal. For phone testing on the same network, use the network URL emitted by Vite.

## Testing and build

```bash
npm run typecheck
npm run test
npm run build
```

`npm run build` runs TypeScript checking and then creates the production Vite build in `dist/`.

## Deployment

GitHub Actions includes:

1. A CI workflow that installs dependencies, type checks, runs unit tests, and builds on pull requests and pushes to `main`.
2. A GitHub Pages workflow that builds the Vite app and deploys the `dist/` artifact on pushes to `main`.

The Vite base path is configured as `/the-dark-kick/`, which matches deployment under the repository subpath for GitHub Pages.

To finish setup in GitHub, enable Pages for the repository and select **GitHub Actions** as the Pages source.

## Next planned systems

Future work can add enemy AI, cards/deck management, fire, destructible objects, inventory, animations, progression, and multiplayer. These systems are intentionally not implemented in this focused prototype iteration.
