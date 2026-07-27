import { COMBAT } from '../config/combat';
import {
  coordsEqual,
  isInsideGrid,
  manhattanDistance,
  orthogonalNeighbors,
  type GridCoord,
  type GridSize,
  GRID_SIZE,
} from './grid';
import { createInitialState, type Charge, type Corpse, type Enemy, type GameState, type Terrain, type UnitSide } from './state';

export type Action = 'move' | 'strike' | 'kick' | 'power-strike';

export interface ActionResult {
  readonly state: GameState;
  readonly damage: readonly GridCoord[];
  readonly damageAmount: number;
  readonly pushedFrom?: GridCoord;
  readonly pushedTo?: GridCoord;
  readonly killed?: Corpse;
  readonly declaredCharge?: Charge;
}

export interface PlayerMoveResult {
  readonly state: GameState;
  readonly path: readonly GridCoord[];
  readonly damageAmount: number;
}

export type EnemyActionKind = 'move' | 'attack' | 'stunned' | 'wait';

export interface EnemyActionResult {
  readonly state: GameState;
  readonly enemyId: string;
  readonly kind: EnemyActionKind;
  readonly from: GridCoord;
  readonly path: readonly GridCoord[];
  readonly target?: GridCoord;
  readonly damageAmount: number;
  readonly hazardDamage: number;
  readonly killed?: Corpse;
}

export interface ChargeResolution {
  readonly state: GameState;
  readonly charge: Charge;
  readonly hitSide?: UnitSide;
  readonly hitUnitId?: string;
  readonly damageAmount: number;
  readonly killed?: Corpse;
  readonly whiffed: boolean;
}

export interface ChargeStepResult {
  readonly state: GameState;
  readonly resolutions: readonly ChargeResolution[];
}

export type EnemyStepSelector = (state: GameState, enemy: Enemy, grid: GridSize) => GridCoord | undefined;

export interface EnemyThreatPreview {
  readonly enemyId: string;
  readonly movementTiles: readonly GridCoord[];
  readonly attackOnlyTiles: readonly GridCoord[];
  readonly moveThenAttackTiles: readonly GridCoord[];
  readonly attackTiles: readonly GridCoord[];
  readonly approachPath: readonly GridCoord[];
  readonly attacksPlayerThisActivation: boolean;
}

export const terrainAt = (state: GameState, coord: GridCoord): Terrain => {
  if (state.walls.some((wall) => coordsEqual(wall, coord))) return 'wall';
  if (coordsEqual(state.exit, coord)) return 'exit';
  if (state.spikes.some((spike) => coordsEqual(spike, coord))) return 'spikes';
  return 'floor';
};

export const enemyAt = (state: GameState, coord: GridCoord): Enemy | undefined =>
  state.enemies.find((enemy) => coordsEqual(enemy.position, coord));

const impassable = (state: GameState, coord: GridCoord, grid: GridSize): boolean =>
  !isInsideGrid(coord, grid) || terrainAt(state, coord) === 'wall';

export const isLegalMove = (state: GameState, destination: GridCoord, grid: GridSize = GRID_SIZE): boolean =>
  playerMovementPath(state, destination, grid) !== undefined;

export const legalMovesForPlayer = (state: GameState, grid: GridSize = GRID_SIZE): GridCoord[] =>
  reachablePlayerMoves(state, grid).map((move) => move.destination);

export const reachablePlayerMoves = (
  state: GameState,
  grid: GridSize = GRID_SIZE,
): readonly { readonly destination: GridCoord; readonly path: readonly GridCoord[] }[] => {
  if (state.won || state.lost || state.acted || state.movePointsRemaining <= 0) return [];
  const queue: Array<{ coord: GridCoord; path: readonly GridCoord[] }> = [{ coord: state.player, path: [] }];
  const seen = new Set([coordKey(state.player)]);
  const moves: Array<{ destination: GridCoord; path: readonly GridCoord[] }> = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.path.length >= state.movePointsRemaining) continue;
    for (const candidate of orthogonalNeighbors(current.coord)) {
      const key = coordKey(candidate);
      if (seen.has(key) || !canPlayerEnter(state, candidate, grid)) continue;
      const path = [...current.path, candidate];
      seen.add(key);
      moves.push({ destination: candidate, path });
      if (!coordsEqual(candidate, state.exit)) queue.push({ coord: candidate, path });
    }
  }
  return moves;
};

export const playerMovementPath = (
  state: GameState,
  destination: GridCoord,
  grid: GridSize = GRID_SIZE,
): readonly GridCoord[] | undefined =>
  reachablePlayerMoves(state, grid).find((move) => coordsEqual(move.destination, destination))?.path;

export const isLegalAttackTarget = (state: GameState, target: GridCoord): boolean =>
  !state.won &&
  !state.lost &&
  !state.acted &&
  manhattanDistance(state.player, target) === 1 &&
  enemyAt(state, target) !== undefined;

export const isLegalKickTarget = (state: GameState, target: GridCoord): boolean =>
  state.kickCooldownRemaining === 0 && isLegalAttackTarget(state, target);

export const legalAttackTargets = (state: GameState): GridCoord[] =>
  state.enemies.map((enemy) => enemy.position).filter((coord) => isLegalAttackTarget(state, coord));

export const legalPowerStrikeTargets = (state: GameState, grid: GridSize = GRID_SIZE): GridCoord[] => {
  if (state.won || state.lost || state.acted) return [];
  return orthogonalNeighbors(state.player).filter((coord) => isInsideGrid(coord, grid));
};

export const legalTargetsForAction = (state: GameState, action: Action, grid: GridSize = GRID_SIZE): GridCoord[] => {
  if (action === 'move') return legalMovesForPlayer(state, grid);
  if (action === 'power-strike') return legalPowerStrikeTargets(state, grid);
  if (action === 'kick') return state.kickCooldownRemaining > 0 ? [] : legalAttackTargets(state);
  return legalAttackTargets(state);
};

export const resolvePlayerMove = (
  state: GameState,
  destination: GridCoord,
  grid: GridSize = GRID_SIZE,
): PlayerMoveResult => {
  const requestedPath = playerMovementPath(state, destination, grid);
  if (!requestedPath) return { state, path: [], damageAmount: 0 };

  let playerHp = state.playerHp;
  let player = state.player;
  let won = state.won;
  let lost = state.lost;
  let damageAmount = 0;
  const path: GridCoord[] = [];

  for (const step of requestedPath) {
    player = step;
    path.push(step);
    if (terrainAt(state, step) === 'spikes') {
      playerHp = Math.max(0, playerHp - COMBAT.spikeDamage);
      damageAmount += COMBAT.spikeDamage;
    }
    won = coordsEqual(step, state.exit);
    lost = playerHp === 0;
    if (won || lost) break;
  }

  const next = {
    ...state,
    player: { ...player },
    playerHp,
    movePointsRemaining: state.movePointsRemaining - path.length,
    charges: playerHp === 0 ? removeActorCharges(state.charges, 'player', 'player') : state.charges,
    won,
    lost,
  };
  return { state: next, path, damageAmount };
};

export const movePlayer = (state: GameState, destination: GridCoord, grid: GridSize = GRID_SIZE): GameState =>
  resolvePlayerMove(state, destination, grid).state;

export const basicStrike = (state: GameState, target: GridCoord): ActionResult => {
  if (!isLegalAttackTarget(state, target)) return empty(state);
  return damageEnemyForAction(state, target, COMBAT.strikeDamage);
};

export const kick = (state: GameState, target: GridCoord, grid: GridSize = GRID_SIZE): ActionResult => {
  if (!isLegalKickTarget(state, target)) return empty(state);
  const pushedEnemy = enemyAt(state, target)!;
  const direction = { col: target.col - state.player.col, row: target.row - state.player.row };
  const destination = { col: target.col + direction.col, row: target.row + direction.row };
  const blocker = enemyAt(state, destination);
  let damage = COMBAT.kickBaseDamage;
  let nextPosition = target;
  let pushedTo: GridCoord | undefined;
  let stunnedIds: readonly string[] = [];

  if (impassable(state, destination, grid)) {
    damage += COMBAT.forcedImpactDamage;
    stunnedIds = [pushedEnemy.id];
  } else if (blocker) {
    damage += COMBAT.forcedImpactDamage;
    stunnedIds = [pushedEnemy.id, blocker.id];
  } else {
    nextPosition = destination;
    pushedTo = destination;
    if (terrainAt(state, destination) === 'spikes') {
      damage += COMBAT.forcedImpactDamage + COMBAT.spikeDamage;
    }
  }

  const result = damageEnemyForAction(
    state,
    target,
    damage,
    nextPosition,
    pushedTo ? { pushedFrom: target, pushedTo } : undefined,
    stunnedIds,
  );
  return {
    ...result,
    state: {
      ...result.state,
      kickCooldownRemaining: COMBAT.kickCooldownRounds,
      kickUsedThisTurn: true,
    },
  };
};

export const declarePowerStrike = (state: GameState, target: GridCoord, grid: GridSize = GRID_SIZE): ActionResult => {
  if (!legalPowerStrikeTargets(state, grid).some((candidate) => coordsEqual(candidate, target))) return empty(state);
  const queued = declareCharge(state, 'player', 'player', target);
  const declaredCharge = queued.charges.at(-1)!;
  return {
    state: { ...queued, acted: true },
    damage: [],
    damageAmount: 0,
    declaredCharge,
  };
};

/**
 * Adds a tile-committed charge without storing a target unit or a future plan.
 * Enemy callers use the same primitive when charged enemies arrive later.
 */
export const declareCharge = (
  state: GameState,
  actorSide: UnitSide,
  actorId: string,
  target: GridCoord,
  damage = COMBAT.powerStrikeDamage,
): GameState => {
  if (!actorExists(state, actorSide, actorId)) return state;
  const charge: Charge = {
    id: `charge-${state.nextChargeId}`,
    actorSide,
    actorId,
    action: 'power-strike',
    target: { ...target },
    damage,
    resolveOnRound: state.turn + COMBAT.chargeWindupRounds - (actorSide === 'player' ? 1 : 0),
  };
  return {
    ...state,
    charges: [...state.charges, charge],
    nextChargeId: state.nextChargeId + 1,
  };
};

export const enemyTurnOrder = (state: GameState): readonly string[] => state.enemies.map((enemy) => enemy.id);

export const enemyThreatPreview = (
  state: GameState,
  enemyId: string,
  grid: GridSize = GRID_SIZE,
): EnemyThreatPreview | undefined => {
  const enemy = state.enemies.find((candidate) => candidate.id === enemyId);
  if (!enemy) return undefined;
  if (enemy.stunnedActivations > 0) {
    return {
      enemyId,
      movementTiles: [],
      attackOnlyTiles: [],
      moveThenAttackTiles: [],
      attackTiles: [],
      approachPath: [],
      attacksPlayerThisActivation: false,
    };
  }

  const queue: Array<{ coord: GridCoord; distance: number }> = [{ coord: enemy.position, distance: 0 }];
  const seen = new Set([coordKey(enemy.position)]);
  const movementTiles: GridCoord[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.distance >= COMBAT.orcMovePoints) continue;
    for (const candidate of orthogonalNeighbors(current.coord)) {
      const key = coordKey(candidate);
      if (seen.has(key) || !canEnemyEnterFrom(state, enemy.id, current.coord, candidate, grid)) continue;
      seen.add(key);
      movementTiles.push(candidate);
      queue.push({ coord: candidate, distance: current.distance + 1 });
    }
  }

  const attackOnlyTiles = orthogonalNeighbors(enemy.position).filter(
    (candidate) => isInsideGrid(candidate, grid) && terrainAt(state, candidate) !== 'wall',
  );
  const moveThenAttackTiles: GridCoord[] = [];
  for (const origin of movementTiles) {
    for (const candidate of orthogonalNeighbors(origin)) {
      if (
        isInsideGrid(candidate, grid) &&
        terrainAt(state, candidate) !== 'wall' &&
        !attackOnlyTiles.some((tile) => coordsEqual(tile, candidate)) &&
        !moveThenAttackTiles.some((tile) => coordsEqual(tile, candidate))
      ) {
        moveThenAttackTiles.push(candidate);
      }
    }
  }
  const attackTiles = [...attackOnlyTiles, ...moveThenAttackTiles];

  const approachPath = enemyApproachPath(state, enemyId, grid);
  return {
    enemyId,
    movementTiles,
    attackOnlyTiles,
    moveThenAttackTiles,
    attackTiles,
    approachPath,
    attacksPlayerThisActivation:
      manhattanDistance(enemy.position, state.player) === 1 ||
      (approachPath.length > 0 && approachPath.length <= COMBAT.orcMovePoints),
  };
};

export const enemyApproachPath = (
  state: GameState,
  enemyId: string,
  grid: GridSize = GRID_SIZE,
): readonly GridCoord[] => {
  const enemy = state.enemies.find((candidate) => candidate.id === enemyId);
  if (!enemy) return [];
  return findShortestPath(state, enemy, grid, true) ?? findShortestPath(state, enemy, grid, false) ?? [];
};

/**
 * Reads the live board once for each movement point, then takes a live adjacent
 * Strike. The selector is injectable for the occupied-destination rule test;
 * production always uses deterministic shortest-path selection.
 */
export const resolveEnemyActivation = (
  state: GameState,
  enemyId: string,
  grid: GridSize = GRID_SIZE,
  selectStep: EnemyStepSelector = shortestStep,
): EnemyActionResult => {
  const initialEnemy = state.enemies.find((candidate) => candidate.id === enemyId);
  if (!initialEnemy) return waitResult(state, enemyId, state.player);

  const from = { ...initialEnemy.position };
  if (initialEnemy.stunnedActivations > 0) {
    const enemies = state.enemies.map((candidate) =>
      candidate.id === enemyId
        ? { ...candidate, stunnedActivations: Math.max(0, candidate.stunnedActivations - 1) }
        : candidate,
    );
    return {
      state: { ...state, enemies },
      enemyId,
      kind: 'stunned',
      from,
      path: [],
      damageAmount: 0,
      hazardDamage: 0,
    };
  }

  let next = state;
  const path: GridCoord[] = [];
  let hazardDamage = 0;
  let killed: Corpse | undefined;

  for (let point = 0; point < COMBAT.orcMovePoints; point += 1) {
    const enemy = next.enemies.find((candidate) => candidate.id === enemyId);
    if (!enemy) break;
    const destination = selectStep(next, enemy, grid);
    if (!destination || !canEnemyEnter(next, enemy, destination, grid)) break;

    const entryDamage = terrainAt(next, destination) === 'spikes' ? COMBAT.spikeDamage : 0;
    hazardDamage += entryDamage;
    const hp = enemy.hp - entryDamage;
    if (hp <= 0) {
      killed = { enemyId, position: { ...destination } };
      next = {
        ...next,
        enemies: next.enemies.filter((candidate) => candidate.id !== enemyId),
        corpses: [...next.corpses, killed],
        charges: removeActorCharges(next.charges, 'enemy', enemyId),
      };
      path.push({ ...destination });
      break;
    }

    next = {
      ...next,
      enemies: next.enemies.map((candidate) =>
        candidate.id === enemyId ? { ...candidate, position: { ...destination }, hp } : candidate,
      ),
    };
    path.push({ ...destination });
  }

  if (killed) {
    return {
      state: next,
      enemyId,
      kind: 'move',
      from,
      path,
      damageAmount: 0,
      hazardDamage,
      killed,
    };
  }

  const activeEnemy = next.enemies.find((candidate) => candidate.id === enemyId);
  if (activeEnemy && manhattanDistance(activeEnemy.position, next.player) === 1) {
    const playerHp = Math.max(0, next.playerHp - COMBAT.orcStrikeDamage);
    const attackedState = {
      ...next,
      playerHp,
      lost: playerHp === 0,
      charges: playerHp === 0 ? removeActorCharges(next.charges, 'player', 'player') : next.charges,
    };
    return {
      state: attackedState,
      enemyId,
      kind: 'attack',
      from,
      path,
      target: { ...next.player },
      damageAmount: COMBAT.orcStrikeDamage,
      hazardDamage,
    };
  }

  return {
    state: next,
    enemyId,
    kind: path.length > 0 ? 'move' : 'wait',
    from,
    path,
    damageAmount: 0,
    hazardDamage,
  };
};

/** Compatibility name retained for scene and downstream rule callers. */
export const resolveEnemyAction = resolveEnemyActivation;

export const chargeResolutionOrder = (state: GameState): readonly string[] => {
  const enemyRanks = new Map(state.enemies.map((enemy, index) => [enemy.id, index]));
  return state.charges
    .filter((charge) => charge.resolveOnRound <= state.turn && actorExists(state, charge.actorSide, charge.actorId))
    .slice()
    .sort((a, b) => {
      if (a.actorSide !== b.actorSide) return a.actorSide === 'player' ? -1 : 1;
      if (a.actorSide === 'enemy') {
        const rank = (enemyRanks.get(a.actorId) ?? Number.MAX_SAFE_INTEGER) - (enemyRanks.get(b.actorId) ?? Number.MAX_SAFE_INTEGER);
        if (rank !== 0) return rank;
      }
      return chargeNumber(a.id) - chargeNumber(b.id);
    })
    .map((charge) => charge.id);
};

export const resolveCharge = (state: GameState, chargeId: string): ChargeResolution | undefined => {
  const charge = state.charges.find((candidate) => candidate.id === chargeId);
  if (!charge || charge.resolveOnRound > state.turn || !actorExists(state, charge.actorSide, charge.actorId)) return undefined;

  let next: GameState = { ...state, charges: state.charges.filter((candidate) => candidate.id !== chargeId) };
  const targetEnemy = enemyAt(next, charge.target);
  if (targetEnemy) {
    const damaged = damageEnemy(next, targetEnemy.id, charge.damage, charge.target);
    next = damaged.state;
    return {
      state: next,
      charge,
      hitSide: 'enemy',
      hitUnitId: targetEnemy.id,
      damageAmount: charge.damage,
      ...(damaged.killed ? { killed: damaged.killed } : {}),
      whiffed: false,
    };
  }

  if (coordsEqual(next.player, charge.target)) {
    const playerHp = Math.max(0, next.playerHp - charge.damage);
    next = {
      ...next,
      playerHp,
      lost: playerHp === 0,
      charges: playerHp === 0 ? removeActorCharges(next.charges, 'player', 'player') : next.charges,
    };
    return {
      state: next,
      charge,
      hitSide: 'player',
      hitUnitId: 'player',
      damageAmount: charge.damage,
      whiffed: false,
    };
  }

  return {
    state: next,
    charge,
    damageAmount: 0,
    whiffed: true,
  };
};

export const resolveChargeStep = (state: GameState): ChargeStepResult => {
  let next = state;
  const resolutions: ChargeResolution[] = [];
  for (const chargeId of chargeResolutionOrder(state)) {
    const resolution = resolveCharge(next, chargeId);
    if (!resolution) continue;
    next = resolution.state;
    resolutions.push(resolution);
  }
  return { state: next, resolutions };
};

export const finishEnemyTurn = (state: GameState): GameState => {
  if (state.won || state.lost) return state;
  const kickCooldownRemaining = state.kickUsedThisTurn
    ? state.kickCooldownRemaining
    : Math.max(0, state.kickCooldownRemaining - 1);
  return {
    ...state,
    turn: state.turn + 1,
    movePointsRemaining: COMBAT.playerMovePoints,
    acted: false,
    kickCooldownRemaining,
    kickUsedThisTurn: false,
  };
};

/** Resolves the full enemy phase and charge step for pure-rule callers. */
export const endPlayerTurn = (state: GameState, grid: GridSize = GRID_SIZE): GameState => {
  if (state.won || state.lost) return state;
  let next = state;
  for (const enemyId of enemyTurnOrder(state)) {
    next = resolveEnemyActivation(next, enemyId, grid).state;
    if (next.lost) break;
  }
  if (!next.lost) next = resolveChargeStep(next).state;
  return finishEnemyTurn(next);
};

export const resetGame = (): GameState => createInitialState();

const shortestStep: EnemyStepSelector = (state, enemy, grid) =>
  (findShortestPath(state, enemy, grid, true) ?? findShortestPath(state, enemy, grid, false))?.[0];

const findShortestPath = (
  state: GameState,
  enemy: Enemy,
  grid: GridSize,
  avoidSpikes: boolean,
): readonly GridCoord[] | undefined => {
  const occupied = state.enemies.filter((other) => other.id !== enemy.id).map((other) => other.position);
  const queue: Array<{ coord: GridCoord; path: readonly GridCoord[] }> = [{ coord: enemy.position, path: [] }];
  const seen = new Set([coordKey(enemy.position)]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (manhattanDistance(current.coord, state.player) === 1) return current.path;
    for (const candidate of orthogonalNeighbors(current.coord)) {
      const key = coordKey(candidate);
      if (
        seen.has(key) ||
        impassable(state, candidate, grid) ||
        occupied.some((coord) => coordsEqual(coord, candidate)) ||
        coordsEqual(candidate, state.player) ||
        (avoidSpikes && terrainAt(state, candidate) === 'spikes')
      ) {
        continue;
      }
      seen.add(key);
      queue.push({ coord: candidate, path: [...current.path, candidate] });
    }
  }
  return undefined;
};

const canPlayerEnter = (state: GameState, destination: GridCoord, grid: GridSize): boolean =>
  isInsideGrid(destination, grid) &&
  terrainAt(state, destination) !== 'wall' &&
  !enemyAt(state, destination);

const canEnemyEnterFrom = (
  state: GameState,
  enemyId: string,
  from: GridCoord,
  destination: GridCoord,
  grid: GridSize,
): boolean =>
  manhattanDistance(from, destination) === 1 &&
  !impassable(state, destination, grid) &&
  !state.enemies.some((enemy) => enemy.id !== enemyId && coordsEqual(enemy.position, destination)) &&
  !coordsEqual(state.player, destination);

const canEnemyEnter = (state: GameState, enemy: Enemy, destination: GridCoord, grid: GridSize): boolean =>
  canEnemyEnterFrom(state, enemy.id, enemy.position, destination, grid);

const actorExists = (state: GameState, actorSide: UnitSide, actorId: string): boolean =>
  actorSide === 'player'
    ? actorId === 'player' && !state.lost && state.playerHp > 0
    : state.enemies.some((enemy) => enemy.id === actorId);

const removeActorCharges = (
  charges: readonly Charge[],
  actorSide: UnitSide,
  actorId: string,
): readonly Charge[] => charges.filter((charge) => charge.actorSide !== actorSide || charge.actorId !== actorId);

const damageEnemy = (
  state: GameState,
  enemyId: string,
  amount: number,
  position: GridCoord,
): { readonly state: GameState; readonly killed?: Corpse } => {
  const enemy = state.enemies.find((candidate) => candidate.id === enemyId);
  if (!enemy) return { state };
  const hp = enemy.hp - amount;
  if (hp > 0) {
    return {
      state: {
        ...state,
        enemies: state.enemies.map((candidate) => candidate.id === enemyId ? { ...candidate, hp } : candidate),
      },
    };
  }
  const killed = { enemyId, position: { ...position } };
  return {
    state: {
      ...state,
      enemies: state.enemies.filter((candidate) => candidate.id !== enemyId),
      corpses: [...state.corpses, killed],
      charges: removeActorCharges(state.charges, 'enemy', enemyId),
    },
    killed,
  };
};

const damageEnemyForAction = (
  state: GameState,
  target: GridCoord,
  amount: number,
  nextPosition: GridCoord = target,
  push?: Pick<ActionResult, 'pushedFrom' | 'pushedTo'>,
  stunnedIds: readonly string[] = [],
): ActionResult => {
  const targetEnemy = enemyAt(state, target);
  if (!targetEnemy) return empty(state);
  let killed: Corpse | undefined;
  const enemies = state.enemies.flatMap((enemy) => {
    const stunnedActivations = stunnedIds.includes(enemy.id)
      ? COMBAT.stunDurationActivations
      : enemy.stunnedActivations;
    if (enemy.id !== targetEnemy.id) return [{ ...enemy, stunnedActivations }];
    const damaged = { ...enemy, position: { ...nextPosition }, hp: enemy.hp - amount, stunnedActivations };
    if (damaged.hp > 0) return [damaged];
    killed = { enemyId: enemy.id, position: { ...nextPosition } };
    return [];
  });
  const charges = killed ? removeActorCharges(state.charges, 'enemy', targetEnemy.id) : state.charges;
  return {
    state: {
      ...state,
      enemies,
      corpses: killed ? [...state.corpses, killed] : state.corpses,
      charges,
      acted: true,
    },
    damage: [{ ...nextPosition }],
    damageAmount: amount,
    ...(killed ? { killed } : {}),
    ...push,
  };
};

const waitResult = (state: GameState, enemyId: string, from: GridCoord): EnemyActionResult => ({
  state,
  enemyId,
  kind: 'wait',
  from: { ...from },
  path: [],
  damageAmount: 0,
  hazardDamage: 0,
});

const empty = (state: GameState): ActionResult => ({ state, damage: [], damageAmount: 0 });
const chargeNumber = (id: string): number => Number(id.slice(id.lastIndexOf('-') + 1)) || 0;
const coordKey = (coord: GridCoord): string => `${coord.col},${coord.row}`;
