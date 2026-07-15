# the-dark-kick

Touch-first tactical game interaction prototype.

## Current prototype

The current build is a landscape-oriented Phaser 3 prototype with an 8-column by 6-row square grid. A blue player token starts near the left side of the board, an exit tile sits near the right side, and the player can be selected by tapping or clicking it. While selected, legal orthogonally adjacent destinations are highlighted. Tapping a highlighted empty tile moves the token and advances the turn counter. Illegal destinations do not move the player. A Reset button restores the initial player position and turn count.

The screen uses vector shapes, generated text, and responsive Vite/Phaser scaling so it can fit an iPhone browser in landscape orientation without page scrolling while remaining usable with a desktop mouse.

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

Future work should add basic attack interactions, Power Strike, Kick, Fire Arrow, enemies, and environmental interactions. These systems are intentionally not implemented in this foundation milestone.
