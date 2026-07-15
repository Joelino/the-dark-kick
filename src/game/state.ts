import type { GridCoord } from './grid';

export interface GameState {
  readonly player: GridCoord;
  readonly exit: GridCoord;
  readonly turn: number;
}

export const INITIAL_STATE: GameState = {
  player: { col: 1, row: 2 },
  exit: { col: 6, row: 2 },
  turn: 1,
};

export const createInitialState = (): GameState => ({
  player: { ...INITIAL_STATE.player },
  exit: { ...INITIAL_STATE.exit },
  turn: INITIAL_STATE.turn,
});
