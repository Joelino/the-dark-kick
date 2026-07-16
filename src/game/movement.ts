import { coordsEqual, isInsideGrid, manhattanDistance, type GridCoord, type GridSize, GRID_SIZE } from './grid';
import { createInitialState, type Corpse, type Enemy, type GameState, type Terrain } from './state';

export type Action = 'move' | 'strike' | 'kick';

export interface ActionResult {
  readonly state: GameState;
  readonly damage: readonly GridCoord[];
  readonly damageAmount: number;
  readonly pushedFrom?: GridCoord;
  readonly pushedTo?: GridCoord;
  readonly killed?: Corpse;
}

export const terrainAt = (state: GameState, coord: GridCoord): Terrain => {
  if (state.walls.some((wall) => coordsEqual(wall, coord))) return 'wall';
  if (coordsEqual(state.exit, coord)) return 'exit';
  if (state.spikes.some((spike) => coordsEqual(spike, coord))) return 'spikes';
  return 'floor';
};

export const enemyAt = (state: GameState, coord: GridCoord): Enemy | undefined =>
  state.enemies.find((enemy) => coordsEqual(enemy.position, coord));

const isImpassableTerrain = (state: GameState, coord: GridCoord, grid: GridSize): boolean =>
  !isInsideGrid(coord, grid) || terrainAt(state, coord) === 'wall';

const isBlockedByEnemy = (state: GameState, coord: GridCoord): boolean => enemyAt(state, coord) !== undefined;

export const isLegalMove = (state: GameState, destination: GridCoord, grid: GridSize = GRID_SIZE): boolean => {
  if (state.won || manhattanDistance(state.player, destination) !== 1) return false;
  return !isImpassableTerrain(state, destination, grid) && !isBlockedByEnemy(state, destination);
};

export const legalMovesForPlayer = (state: GameState, grid: GridSize = GRID_SIZE): GridCoord[] => orthogonalNeighbors(state.player).filter((candidate) => isLegalMove(state, candidate, grid));

export const isLegalAttackTarget = (state: GameState, target: GridCoord): boolean =>
  !state.won && manhattanDistance(state.player, target) === 1 && enemyAt(state, target) !== undefined;

export const legalAttackTargets = (state: GameState): GridCoord[] =>
  state.enemies.map((enemy) => enemy.position).filter((position) => isLegalAttackTarget(state, position));

export const legalTargetsForAction = (state: GameState, action: Action): GridCoord[] =>
  action === 'move' ? legalMovesForPlayer(state) : legalAttackTargets(state);

export const movePlayer = (state: GameState, destination: GridCoord, grid: GridSize = GRID_SIZE): GameState => {
  if (!isLegalMove(state, destination, grid)) return state;
  return { ...state, player: { ...destination }, turn: state.turn + 1, won: coordsEqual(destination, state.exit) };
};

export const basicStrike = (state: GameState, target: GridCoord): ActionResult => {
  if (!isLegalAttackTarget(state, target)) return { state, damage: [], damageAmount: 0 };
  return damageEnemy(state, target, 1);
};

export const kick = (state: GameState, target: GridCoord, grid: GridSize = GRID_SIZE): ActionResult => {
  if (!isLegalAttackTarget(state, target)) return { state, damage: [], damageAmount: 0 };

  const direction = { col: target.col - state.player.col, row: target.row - state.player.row };
  const destination = { col: target.col + direction.col, row: target.row + direction.row };
  let damage = 1;
  let nextPosition = target;
  let pushedTo: GridCoord | undefined;

  if (isImpassableTerrain(state, destination, grid)) {
    damage += 1;
  } else if (!isBlockedByEnemy(state, destination)) {
    nextPosition = destination;
    pushedTo = destination;
    if (terrainAt(state, destination) === 'spikes') damage += 3;
  }

  return damageEnemy(state, target, damage, nextPosition, pushedTo ? { pushedFrom: target, pushedTo } : undefined);
};

export const resetGame = (): GameState => createInitialState();

const orthogonalNeighbors = (coord: GridCoord): GridCoord[] => [
  { col: coord.col, row: coord.row - 1 },
  { col: coord.col + 1, row: coord.row },
  { col: coord.col, row: coord.row + 1 },
  { col: coord.col - 1, row: coord.row },
];

const damageEnemy = (
  state: GameState,
  target: GridCoord,
  amount: number,
  nextPosition: GridCoord = target,
  push?: Pick<ActionResult, 'pushedFrom' | 'pushedTo'>,
): ActionResult => {
  let killed: Corpse | undefined;
  const enemies = state.enemies.flatMap((enemy) => {
    if (!coordsEqual(enemy.position, target)) return [enemy];

    const damagedEnemy = { ...enemy, position: { ...nextPosition }, hp: enemy.hp - amount };
    if (damagedEnemy.hp > 0) return [damagedEnemy];

    killed = { enemyId: enemy.id, position: { ...nextPosition } };
    return [];
  });

  return {
    state: {
      ...state,
      enemies,
      corpses: killed ? [...state.corpses, killed] : state.corpses,
      turn: state.turn + 1,
    },
    damage: [{ ...nextPosition }],
    damageAmount: amount,
    ...(killed ? { killed } : {}),
    ...push,
  };
};
