import { COMBAT } from '../config/combat';
import { coordsEqual, isInsideGrid, manhattanDistance, type GridCoord, type GridSize, GRID_SIZE } from './grid';
import { createInitialState, type Corpse, type Enemy, type EnemyIntent, type GameState, type Terrain } from './state';

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
export const enemyAt = (state: GameState, coord: GridCoord): Enemy | undefined => state.enemies.find((enemy) => coordsEqual(enemy.position, coord));
const impassable = (state: GameState, coord: GridCoord, grid: GridSize): boolean => !isInsideGrid(coord, grid) || terrainAt(state, coord) === 'wall';
const neighbors = (coord: GridCoord): GridCoord[] => [
  { col: coord.col, row: coord.row - 1 }, { col: coord.col - 1, row: coord.row },
  { col: coord.col + 1, row: coord.row }, { col: coord.col, row: coord.row + 1 },
];

export const isLegalMove = (state: GameState, destination: GridCoord, grid: GridSize = GRID_SIZE): boolean =>
  !state.won && !state.lost && !state.moved && manhattanDistance(state.player, destination) === 1 &&
  !impassable(state, destination, grid) && !enemyAt(state, destination);
export const legalMovesForPlayer = (state: GameState, grid: GridSize = GRID_SIZE): GridCoord[] => neighbors(state.player).filter((coord) => isLegalMove(state, coord, grid));
export const isLegalAttackTarget = (state: GameState, target: GridCoord): boolean =>
  !state.won && !state.lost && !state.acted && manhattanDistance(state.player, target) === 1 && enemyAt(state, target) !== undefined;
export const legalAttackTargets = (state: GameState): GridCoord[] => state.enemies.map((enemy) => enemy.position).filter((coord) => isLegalAttackTarget(state, coord));
export const legalTargetsForAction = (state: GameState, action: Action): GridCoord[] => action === 'move' ? legalMovesForPlayer(state) : legalAttackTargets(state);

export const movePlayer = (state: GameState, destination: GridCoord, grid: GridSize = GRID_SIZE): GameState => {
  if (!isLegalMove(state, destination, grid)) return state;
  return { ...state, player: { ...destination }, moved: true, won: coordsEqual(destination, state.exit) };
};
export const basicStrike = (state: GameState, target: GridCoord): ActionResult => {
  if (!isLegalAttackTarget(state, target)) return empty(state);
  return damageEnemy(state, target, COMBAT.playerStrikeDamage);
};
export const kick = (state: GameState, target: GridCoord, grid: GridSize = GRID_SIZE): ActionResult => {
  if (!isLegalAttackTarget(state, target)) return empty(state);
  const direction = { col: target.col - state.player.col, row: target.row - state.player.row };
  const destination = { col: target.col + direction.col, row: target.row + direction.row };
  const blocker = enemyAt(state, destination);
  let damage = COMBAT.playerKickDamage;
  let nextPosition = target;
  let pushedTo: GridCoord | undefined;
  let stunnedIds: readonly string[] = [];
  if (impassable(state, destination, grid)) {
    damage += COMBAT.wallCollisionDamage;
    stunnedIds = [enemyAt(state, target)!.id];
  } else if (blocker) {
    damage += COMBAT.wallCollisionDamage;
    stunnedIds = [enemyAt(state, target)!.id, blocker.id];
  } else {
    nextPosition = destination;
    pushedTo = destination;
    if (terrainAt(state, destination) === 'spikes') damage += COMBAT.spikePushDamage;
  }
  return damageEnemy(state, target, damage, nextPosition, pushedTo ? { pushedFrom: target, pushedTo } : undefined, stunnedIds);
};

/** Chooses each orc's one exact next action. Stunned enemies deliberately have no intent. */
export const chooseEnemyIntents = (state: GameState, grid: GridSize = GRID_SIZE): readonly EnemyIntent[] =>
  [...state.enemies].sort(readingOrder).flatMap((enemy): EnemyIntent[] => {
    if (enemy.stunnedTurns > 0) return [];
    if (manhattanDistance(enemy.position, state.player) === 1) return [{ enemyId: enemy.id, kind: 'attack', target: { ...state.player } }];
    const step = shortestStep(state, enemy, grid);
    return step ? [{ enemyId: enemy.id, kind: 'move', target: step }] : [];
  });

export const withEnemyIntents = (state: GameState): GameState => ({ ...state, intents: chooseEnemyIntents(state) });

/** Resolves committed intents in reading order, then opens the next player turn. */
export const endPlayerTurn = (state: GameState, grid: GridSize = GRID_SIZE): GameState => {
  if (state.won || state.lost || (!state.moved && !state.acted)) return state;
  let next = state;
  for (const enemy of [...next.enemies].sort(readingOrder)) {
    if (enemy.stunnedTurns > 0) continue;
    const intent = state.intents.find((candidate) => candidate.enemyId === enemy.id);
    if (!intent) continue;
    const current = next.enemies.find((candidate) => candidate.id === enemy.id);
    if (!current) continue;
    if (intent.kind === 'attack') {
      if (coordsEqual(next.player, intent.target) && manhattanDistance(current.position, intent.target) === 1) {
        next = { ...next, playerHp: Math.max(0, next.playerHp - COMBAT.orcStrikeDamage) };
        if (next.playerHp === 0) break;
      }
    } else if (manhattanDistance(current.position, intent.target) === 1 && !impassable(next, intent.target, grid) && !enemyAt(next, intent.target) && !coordsEqual(next.player, intent.target)) {
      next = { ...next, enemies: next.enemies.map((candidate) => candidate.id === current.id ? { ...candidate, position: { ...intent.target } } : candidate) };
    }
  }
  const enemies = next.enemies.map((enemy) => ({ ...enemy, stunnedTurns: Math.max(0, enemy.stunnedTurns - 1) }));
  next = { ...next, enemies, turn: next.turn + 1, moved: false, acted: false, intents: [], lost: next.playerHp === 0 };
  return next.lost ? next : withEnemyIntents(next);
};

export const resetGame = (): GameState => withEnemyIntents(createInitialState());

const shortestStep = (state: GameState, enemy: Enemy, grid: GridSize): GridCoord | undefined => {
  const occupied = state.enemies.filter((other) => other.id !== enemy.id).map((other) => other.position);
  const queue: Array<{ coord: GridCoord; first?: GridCoord }> = [{ coord: enemy.position }];
  const seen = new Set([`${enemy.position.col},${enemy.position.row}`]);
  while (queue.length) {
    const current = queue.shift()!;
    if (manhattanDistance(current.coord, state.player) === 1) return current.first;
    for (const candidate of neighbors(current.coord)) {
      const key = `${candidate.col},${candidate.row}`;
      if (seen.has(key) || impassable(state, candidate, grid) || occupied.some((coord) => coordsEqual(coord, candidate)) || coordsEqual(candidate, state.player)) continue;
      seen.add(key);
      queue.push({ coord: candidate, first: current.first ?? candidate });
    }
  }
  return undefined;
};
const readingOrder = (a: Enemy, b: Enemy): number => a.position.row - b.position.row || a.position.col - b.position.col;
const empty = (state: GameState): ActionResult => ({ state, damage: [], damageAmount: 0 });
const damageEnemy = (state: GameState, target: GridCoord, amount: number, nextPosition: GridCoord = target, push?: Pick<ActionResult, 'pushedFrom' | 'pushedTo'>, stunnedIds: readonly string[] = []): ActionResult => {
  let killed: Corpse | undefined;
  const enemies = state.enemies.flatMap((enemy) => {
    if (!coordsEqual(enemy.position, target)) return [{ ...enemy, stunnedTurns: stunnedIds.includes(enemy.id) ? COMBAT.stunTurns : enemy.stunnedTurns }];
    const damaged = { ...enemy, position: { ...nextPosition }, hp: enemy.hp - amount, stunnedTurns: stunnedIds.includes(enemy.id) ? COMBAT.stunTurns : enemy.stunnedTurns };
    if (damaged.hp > 0) return [damaged];
    killed = { enemyId: enemy.id, position: { ...nextPosition } };
    return [];
  });
  return { state: { ...state, enemies, corpses: killed ? [...state.corpses, killed] : state.corpses, acted: true }, damage: [{ ...nextPosition }], damageAmount: amount, ...(killed ? { killed } : {}), ...push };
};
