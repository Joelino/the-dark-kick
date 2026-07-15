import { coordsEqual, isInsideGrid, manhattanDistance, type GridCoord, type GridSize, GRID_SIZE } from './grid';
import { createInitialState, type GameState } from './state';

export const isLegalMove = (state: GameState, destination: GridCoord, grid: GridSize = GRID_SIZE): boolean => {
  if (!isInsideGrid(destination, grid)) {
    return false;
  }

  if (coordsEqual(destination, state.exit)) {
    return false;
  }

  return manhattanDistance(state.player, destination) === 1;
};

export const legalMovesForPlayer = (state: GameState, grid: GridSize = GRID_SIZE): GridCoord[] => {
  const candidates: GridCoord[] = [
    { col: state.player.col, row: state.player.row - 1 },
    { col: state.player.col + 1, row: state.player.row },
    { col: state.player.col, row: state.player.row + 1 },
    { col: state.player.col - 1, row: state.player.row },
  ];

  return candidates.filter((candidate) => isLegalMove(state, candidate, grid));
};

export const movePlayer = (state: GameState, destination: GridCoord, grid: GridSize = GRID_SIZE): GameState => {
  if (!isLegalMove(state, destination, grid)) {
    return state;
  }

  return {
    ...state,
    player: { ...destination },
    turn: state.turn + 1,
  };
};

export const resetGame = (): GameState => createInitialState();
