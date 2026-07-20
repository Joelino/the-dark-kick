import type { GridCoord } from './grid';

export type Terrain = 'floor' | 'wall' | 'exit' | 'spikes';

export interface Enemy {
  readonly id: string;
  readonly position: GridCoord;
  readonly hp: number;
}

export interface Corpse {
  readonly enemyId: string;
  readonly position: GridCoord;
}

export interface GameState {
  readonly player: GridCoord;
  readonly exit: GridCoord;
  readonly spikes: readonly GridCoord[];
  readonly walls: readonly GridCoord[];
  readonly enemies: readonly Enemy[];
  readonly corpses: readonly Corpse[];
  readonly turn: number;
  readonly won: boolean;
}

export const INITIAL_STATE: GameState = {
  player: { col: 1, row: 2 },
  exit: { col: 6, row: 2 },
  spikes: [{ col: 4, row: 2 }],
  walls: [
    { col: 3, row: 1 },
    { col: 5, row: 4 },
  ],
  enemies: [{ id: 'training-dummy', position: { col: 3, row: 2 }, hp: 4 }],
  corpses: [],
  turn: 1,
  won: false,
};

export const createInitialState = (): GameState => ({
  player: { ...INITIAL_STATE.player },
  exit: { ...INITIAL_STATE.exit },
  spikes: INITIAL_STATE.spikes.map((spike) => ({ ...spike })),
  walls: INITIAL_STATE.walls.map((wall) => ({ ...wall })),
  enemies: INITIAL_STATE.enemies.map((enemy) => ({ ...enemy, position: { ...enemy.position } })),
  corpses: INITIAL_STATE.corpses.map((corpse) => ({ ...corpse, position: { ...corpse.position } })),
  turn: INITIAL_STATE.turn,
  won: INITIAL_STATE.won,
});
