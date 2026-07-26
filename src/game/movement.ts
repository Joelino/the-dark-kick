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

export type EnemyActionKind = 'move' | 'attack' | 'miss' | 'stunned' | 'wait';

export interface EnemyActionResult {
  readonly state: GameState;
  readonly enemyId: string;
  readonly kind: EnemyActionKind;
  readonly from: GridCoord;
  readonly target?: GridCoord;
  readonly damageAmount: number;
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
  const spikeDamage = terrainAt(state, destination) === 'spikes' ? COMBAT.spikeEntryDamage : 0;
  const playerHp = Math.max(0, state.playerHp - spikeDamage);
  return {
    ...state,
    player: { ...destination },
    playerHp,
    moved: true,
    won: coordsEqual(destination, state.exit),
    lost: playerHp === 0,
  };
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
    // A spike landing has the same 1-point impact as hitting solid terrain,
    // plus the configured spike bonus. This preserves the specified +3 bonus
    // while making the promised full-health-orc spike kill total 4 damage.
    if (terrainAt(state, destination) === 'spikes') damage += COMBAT.wallCollisionDamage + COMBAT.spikePushDamage;
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

export const withEnemyIntents = (state: GameState, grid: GridSize = GRID_SIZE): GameState => ({
  ...state,
  intents: chooseEnemyIntents(state, grid),
});

export const enemyTurnOrder = (state: GameState): readonly string[] =>
  [...state.enemies].sort(readingOrder).map((enemy) => enemy.id);

/** Resolves one committed enemy action so the scene can animate the same result. */
export const resolveEnemyAction = (state: GameState, enemyId: string, grid: GridSize = GRID_SIZE): EnemyActionResult => {
  const enemy = state.enemies.find((candidate) => candidate.id === enemyId);
  if (!enemy) return { state, enemyId, kind: 'wait', from: { ...state.player }, damageAmount: 0 };

  const from = { ...enemy.position };
  if (enemy.stunnedTurns > 0) {
    const enemies = state.enemies.map((candidate) =>
      candidate.id === enemyId ? { ...candidate, stunnedTurns: Math.max(0, candidate.stunnedTurns - 1) } : candidate,
    );
    return { state: withoutIntent({ ...state, enemies }, enemyId), enemyId, kind: 'stunned', from, damageAmount: 0 };
  }

  const intent = state.intents.find((candidate) => candidate.enemyId === enemyId);
  if (!intent) return { state, enemyId, kind: 'wait', from, damageAmount: 0 };

  if (intent.kind === 'attack') {
    const hits = coordsEqual(state.player, intent.target) && manhattanDistance(enemy.position, intent.target) === 1;
    if (!hits) {
      return {
        state: withoutIntent(state, enemyId),
        enemyId,
        kind: 'miss',
        from,
        target: { ...intent.target },
        damageAmount: 0,
      };
    }
    const playerHp = Math.max(0, state.playerHp - COMBAT.orcStrikeDamage);
    return {
      state: withoutIntent({ ...state, playerHp, lost: playerHp === 0 }, enemyId),
      enemyId,
      kind: 'attack',
      from,
      target: { ...intent.target },
      damageAmount: COMBAT.orcStrikeDamage,
    };
  }

  const canMove =
    manhattanDistance(enemy.position, intent.target) === 1 &&
    !impassable(state, intent.target, grid) &&
    !enemyAt(state, intent.target) &&
    !coordsEqual(state.player, intent.target);
  if (!canMove) {
    return {
      state: withoutIntent(state, enemyId),
      enemyId,
      kind: 'wait',
      from,
      target: { ...intent.target },
      damageAmount: 0,
    };
  }

  const spikeDamage = terrainAt(state, intent.target) === 'spikes' ? COMBAT.spikeEntryDamage : 0;
  const hp = enemy.hp - spikeDamage;
  const killed = hp <= 0 ? { enemyId, position: { ...intent.target } } : undefined;
  const enemies = state.enemies.flatMap((candidate) => {
    if (candidate.id !== enemyId) return [candidate];
    return killed ? [] : [{ ...candidate, position: { ...intent.target }, hp }];
  });
  const nextState = withoutIntent({
    ...state,
    enemies,
    corpses: killed ? [...state.corpses, killed] : state.corpses,
  }, enemyId);
  return {
    state: nextState,
    enemyId,
    kind: 'move',
    from,
    target: { ...intent.target },
    damageAmount: spikeDamage,
    ...(killed ? { killed } : {}),
  };
};

export const finishEnemyTurn = (state: GameState, grid: GridSize = GRID_SIZE): GameState => {
  if (state.won) return state;
  if (state.lost) return { ...state, intents: [] };
  const next = { ...state, turn: state.turn + 1, moved: false, acted: false, intents: [] };
  return withEnemyIntents(next, grid);
};

/** Resolves committed intents in reading order, then opens the next player turn. */
export const endPlayerTurn = (state: GameState, grid: GridSize = GRID_SIZE): GameState => {
  if (state.won || state.lost) return state;
  let next = state;
  for (const enemyId of enemyTurnOrder(state)) {
    next = resolveEnemyAction(next, enemyId, grid).state;
    if (next.lost) break;
  }
  return finishEnemyTurn(next, grid);
};

export const resetGame = (): GameState => withEnemyIntents(createInitialState());

const shortestStep = (state: GameState, enemy: Enemy, grid: GridSize): GridCoord | undefined =>
  findShortestStep(state, enemy, grid, true) ?? findShortestStep(state, enemy, grid, false);

const findShortestStep = (state: GameState, enemy: Enemy, grid: GridSize, avoidSpikes: boolean): GridCoord | undefined => {
  const occupied = state.enemies.filter((other) => other.id !== enemy.id).map((other) => other.position);
  const queue: Array<{ coord: GridCoord; first?: GridCoord }> = [{ coord: enemy.position }];
  const seen = new Set([`${enemy.position.col},${enemy.position.row}`]);
  while (queue.length) {
    const current = queue.shift()!;
    if (manhattanDistance(current.coord, state.player) === 1) return current.first;
    for (const candidate of neighbors(current.coord)) {
      const key = `${candidate.col},${candidate.row}`;
      if (
        seen.has(key) ||
        impassable(state, candidate, grid) ||
        occupied.some((coord) => coordsEqual(coord, candidate)) ||
        coordsEqual(candidate, state.player) ||
        (avoidSpikes && terrainAt(state, candidate) === 'spikes')
      ) continue;
      seen.add(key);
      queue.push({ coord: candidate, first: current.first ?? candidate });
    }
  }
  return undefined;
};
const readingOrder = (a: Enemy, b: Enemy): number => a.position.row - b.position.row || a.position.col - b.position.col;
const withoutIntent = (state: GameState, enemyId: string): GameState => ({
  ...state,
  intents: state.intents.filter((intent) => intent.enemyId !== enemyId),
});
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
