import { afterEach, describe, expect, it } from 'vitest';
import { applyCombatConfig, COMBAT, COMBAT_DEFAULTS } from '../config/combat';
import {
  basicStrike,
  chargeResolutionOrder,
  declareCharge,
  declarePowerStrike,
  endPlayerTurn,
  enemyAt,
  enemyThreatPreview,
  finishEnemyTurn,
  kick,
  legalMovesForPlayer,
  movePlayer,
  resetGame,
  resolveChargeStep,
  resolveEnemyActivation,
  resolvePlayerMove,
} from './movement';
import type { Enemy, GameState } from './state';

afterEach(() => {
  applyCombatConfig(COMBAT_DEFAULTS);
});

const scenario = (partial: Partial<GameState> = {}): GameState => ({
  ...resetGame(),
  player: { col: 1, row: 2 },
  playerHp: COMBAT.playerHealth,
  exit: { col: 7, row: 5 },
  walls: [],
  spikes: [],
  enemies: [],
  corpses: [],
  charges: [],
  nextChargeId: 1,
  turn: 1,
  movePointsRemaining: COMBAT.playerMovePoints,
  acted: false,
  kickCooldownRemaining: 0,
  kickUsedThisTurn: false,
  won: false,
  lost: false,
  ...partial,
});

const orc = (id: string, col: number, row: number, stunnedActivations = 0, hp = COMBAT.orcHealth): Enemy => ({
  id,
  position: { col, row },
  hp,
  stunnedActivations,
});

describe('shared move-then-action grammar', () => {
  it('shows and accepts every tile reachable with the remaining movement points', () => {
    const state = scenario({ player: { col: 1, row: 2 } });

    expect(legalMovesForPlayer(state)).toContainEqual({ col: 1, row: 0 });
    const moved = resolvePlayerMove(state, { col: 1, row: 0 });

    expect(moved.path).toEqual([{ col: 1, row: 1 }, { col: 1, row: 0 }]);
    expect(moved.state.player).toEqual({ col: 1, row: 0 });
    expect(moved.state.movePointsRemaining).toBe(0);
  });

  it('allows movement before an action and rejects movement after it', () => {
    let state = scenario({ player: { col: 1, row: 2 }, enemies: [orc('orc', 2, 1)] });

    state = movePlayer(state, { col: 1, row: 1 });
    state = basicStrike(state, { col: 2, row: 1 }).state;
    const attemptedMove = movePlayer(state, { col: 1, row: 0 });

    expect(state.player).toEqual({ col: 1, row: 1 });
    expect(state.movePointsRemaining).toBe(1);
    expect(state.acted).toBe(true);
    expect(enemyAt(state, { col: 2, row: 1 })?.hp).toBe(COMBAT.orcHealth - COMBAT.strikeDamage);
    expect(attemptedMove).toBe(state);
  });

  it('allows End Turn with movement and action unused', () => {
    const state = scenario({ enemies: [orc('orc', 3, 2)] });
    const next = endPlayerTurn(state);

    expect(next.turn).toBe(2);
    expect(enemyAt(next, { col: 2, row: 2 })?.id).toBe('orc');
    expect(next.playerHp).toBe(COMBAT.playerHealth - COMBAT.orcStrikeDamage);
    expect(next.movePointsRemaining).toBe(COMBAT.playerMovePoints);
    expect(next.acted).toBe(false);
  });

  it('moves adjacent and strikes in the same live activation', () => {
    const result = resolveEnemyActivation(
      scenario({ player: { col: 1, row: 2 }, enemies: [orc('orc', 3, 2)] }),
      'orc',
    );

    expect(result.kind).toBe('attack');
    expect(result.path).toEqual([{ col: 2, row: 2 }]);
    expect(result.state.playerHp).toBe(COMBAT.playerHealth - COMBAT.orcStrikeDamage);
  });

  it('forfeits an occupied chosen destination but still uses a legal adjacent action', () => {
    const state = scenario({
      player: { col: 1, row: 2 },
      enemies: [orc('acting', 2, 2), orc('blocker', 3, 2)],
    });
    const result = resolveEnemyActivation(state, 'acting', undefined, () => ({ col: 3, row: 2 }));

    expect(result.path).toEqual([]);
    expect(result.kind).toBe('attack');
    expect(result.state.playerHp).toBe(COMBAT.playerHealth - COMBAT.orcStrikeDamage);
    expect(enemyAt(result.state, { col: 3, row: 2 })?.id).toBe('blocker');
  });
});

describe('charged actions', () => {
  it('declares on a tile, closes movement, and traps an orc that enters it', () => {
    let state = scenario({
      player: { col: 1, row: 2 },
      enemies: [orc('orc', 3, 2)],
    });
    const declared = declarePowerStrike(state, { col: 2, row: 2 });
    state = declared.state;

    expect(declared.declaredCharge?.target).toEqual({ col: 2, row: 2 });
    expect(state.acted).toBe(true);
    expect(movePlayer(state, { col: 1, row: 1 })).toBe(state);
    expect(state.charges).toHaveLength(1);

    const next = endPlayerTurn(state);
    expect(enemyAt(next, { col: 2, row: 2 })?.hp).toBe(COMBAT.orcHealth - COMBAT.powerStrikeDamage);
    expect(next.charges).toHaveLength(0);
  });

  it('resolves against the declared tile as a clean whiff when it is empty', () => {
    const state = declarePowerStrike(scenario(), { col: 2, row: 2 }).state;
    const step = resolveChargeStep(state);

    expect(step.resolutions).toHaveLength(1);
    expect(step.resolutions[0].whiffed).toBe(true);
    expect(step.resolutions[0].damageAmount).toBe(0);
    expect(step.state.charges).toHaveLength(0);
  });

  it('keeps a pending charge when its actor loses a stunned activation', () => {
    let state = scenario({
      enemies: [orc('orc', 4, 2, 1)],
    });
    state = declareCharge(state, 'enemy', 'orc', { col: 1, row: 2 });
    state = { ...state, turn: 2 };

    const skipped = resolveEnemyActivation(state, 'orc');
    expect(skipped.kind).toBe('stunned');
    expect(skipped.state.charges).toHaveLength(1);

    const step = resolveChargeStep(skipped.state);
    expect(step.resolutions).toHaveLength(1);
    expect(step.resolutions[0].hitSide).toBe('player');
  });

  it('removes a charge when its declaring unit dies', () => {
    let state = scenario({
      player: { col: 1, row: 2 },
      enemies: [orc('orc', 2, 2, 0, 1)],
    });
    state = declareCharge(state, 'enemy', 'orc', { col: 1, row: 2 });
    const struck = basicStrike(state, { col: 2, row: 2 });

    expect(struck.killed?.enemyId).toBe('orc');
    expect(struck.state.charges).toHaveLength(0);
  });

  it('orders player charges first and removes a killed enemy declarer before its charge resolves', () => {
    let state = scenario({
      enemies: [orc('orc', 2, 2)],
    });
    state = declareCharge(state, 'enemy', 'orc', { col: 1, row: 2 });
    state = declareCharge(state, 'player', 'player', { col: 2, row: 2 }, COMBAT.orcHealth);
    state = { ...state, turn: 2 };

    expect(chargeResolutionOrder(state)).toEqual(['charge-2', 'charge-1']);
    const step = resolveChargeStep(state);
    expect(step.resolutions.map((result) => result.charge.id)).toEqual(['charge-2']);
    expect(step.state.enemies).toHaveLength(0);
    expect(step.state.playerHp).toBe(COMBAT.playerHealth);
  });
});

describe('enemy threat preview', () => {
  it('shows the live movement area, post-move attack area, and route to the player', () => {
    const state = scenario({
      player: { col: 1, row: 2 },
      enemies: [orc('orc', 3, 2)],
    });

    const preview = enemyThreatPreview(state, 'orc');

    expect(preview?.movementTiles).toContainEqual({ col: 2, row: 2 });
    expect(preview?.moveThenAttackTiles).toContainEqual(state.player);
    expect(preview?.attackOnlyTiles).not.toContainEqual(state.player);
    expect(preview?.attackTiles).toContainEqual(state.player);
    expect(preview?.approachPath).toEqual([{ col: 2, row: 2 }]);
    expect(preview?.attacksPlayerThisActivation).toBe(true);
    expect(state.enemies[0].position).toEqual({ col: 3, row: 2 });
  });

  it('shows no immediate range for an orc whose activation will be skipped', () => {
    const preview = enemyThreatPreview(
      scenario({ enemies: [orc('orc', 2, 2, 1)] }),
      'orc',
    );

    expect(preview?.movementTiles).toEqual([]);
    expect(preview?.attackOnlyTiles).toEqual([]);
    expect(preview?.moveThenAttackTiles).toEqual([]);
    expect(preview?.attackTiles).toEqual([]);
    expect(preview?.approachPath).toEqual([]);
    expect(preview?.attacksPlayerThisActivation).toBe(false);
  });

  it('separates immediate Strike coverage from move-then-Strike coverage', () => {
    const state = scenario({
      player: { col: 1, row: 2 },
      enemies: [orc('orc', 2, 2)],
    });

    const preview = enemyThreatPreview(state, 'orc');

    expect(preview?.attackOnlyTiles).toContainEqual(state.player);
    expect(preview?.moveThenAttackTiles).not.toContainEqual(state.player);
  });
});

describe('kick payoffs, cooldown, and stun', () => {
  it('repositions on open floor for zero damage', () => {
    const result = kick(scenario({ enemies: [orc('orc', 2, 2)] }), { col: 2, row: 2 });
    expect(result.damageAmount).toBe(COMBAT.kickBaseDamage);
    expect(result.pushedTo).toEqual({ col: 3, row: 2 });
    expect(enemyAt(result.state, { col: 3, row: 2 })?.hp).toBe(COMBAT.orcHealth);
  });

  it('deals forced impact damage and stuns on a wall or edge collision', () => {
    const result = kick(
      scenario({ player: { col: 1, row: 0 }, enemies: [orc('orc', 0, 0)] }),
      { col: 0, row: 0 },
    );

    expect(result.damageAmount).toBe(COMBAT.forcedImpactDamage);
    expect(enemyAt(result.state, { col: 0, row: 0 })?.stunnedActivations).toBe(COMBAT.stunDurationActivations);
    const skipped = resolveEnemyActivation(result.state, 'orc');
    expect(skipped.kind).toBe('stunned');
    expect(enemyAt(skipped.state, { col: 0, row: 0 })?.stunnedActivations).toBe(0);
  });

  it('stuns both units in a collision and damages only the pushed enemy', () => {
    const result = kick(
      scenario({ enemies: [orc('a', 2, 2), orc('b', 3, 2)] }),
      { col: 2, row: 2 },
    );

    expect(result.state.enemies.map(({ hp, stunnedActivations }) => ({ hp, stunnedActivations }))).toEqual([
      { hp: COMBAT.orcHealth - COMBAT.forcedImpactDamage, stunnedActivations: COMBAT.stunDurationActivations },
      { hp: COMBAT.orcHealth, stunnedActivations: COMBAT.stunDurationActivations },
    ]);
  });

  it('combines forced impact and spike damage to kill a full-health orc', () => {
    const result = kick(
      scenario({ spikes: [{ col: 3, row: 2 }], enemies: [orc('orc', 2, 2)] }),
      { col: 2, row: 2 },
    );

    expect(result.damageAmount).toBe(COMBAT.forcedImpactDamage + COMBAT.spikeDamage);
    expect(result.state.enemies).toHaveLength(0);
    expect(result.state.corpses.at(-1)?.position).toEqual({ col: 3, row: 2 });
  });

  it('counts configured cooldown across subsequent player turns', () => {
    applyCombatConfig({ ...COMBAT_DEFAULTS, kickCooldownRounds: 2 });
    let state = kick(scenario({ enemies: [orc('orc', 2, 2)] }), { col: 2, row: 2 }).state;

    state = finishEnemyTurn(state);
    expect(state.kickCooldownRemaining).toBe(2);
    expect(kick(state, { col: 3, row: 2 }).state).toBe(state);
    state = finishEnemyTurn(state);
    expect(state.kickCooldownRemaining).toBe(1);
    state = finishEnemyTurn(state);
    expect(state.kickCooldownRemaining).toBe(0);
  });
});

describe('spike entry and hazard-aware pathfinding', () => {
  it('damages a player entering spikes once', () => {
    const moved = movePlayer(
      scenario({ player: { col: 0, row: 2 }, spikes: [{ col: 1, row: 2 }] }),
      { col: 1, row: 2 },
    );
    expect(moved.playerHp).toBe(COMBAT.playerHealth - COMBAT.spikeDamage);
  });

  it('routes around spikes when safe and crosses them when unavoidable', () => {
    const safe = resolveEnemyActivation(
      scenario({
        player: { col: 4, row: 2 },
        spikes: [{ col: 1, row: 2 }],
        enemies: [orc('orc', 0, 2)],
      }),
      'orc',
    );
    expect(safe.path[0]).toEqual({ col: 0, row: 1 });

    const forced = resolveEnemyActivation(
      scenario({
        player: { col: 2, row: 2 },
        walls: [{ col: 0, row: 1 }, { col: 0, row: 3 }],
        spikes: [{ col: 1, row: 2 }],
        enemies: [orc('orc', 0, 2)],
      }),
      'orc',
    );
    expect(forced.path[0]).toEqual({ col: 1, row: 2 });
    expect(forced.hazardDamage).toBe(COMBAT.spikeDamage);
  });
});
