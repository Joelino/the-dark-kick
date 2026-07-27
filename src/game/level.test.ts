import { describe, expect, it } from 'vitest';
import { COMBAT } from '../config/combat';
import { coordsEqual } from './grid';
import {
  findLevelPath,
  FIRST_CELLAR_LEVEL,
  spikeKickApproaches,
  validateLevel,
} from './level';
import {
  basicStrike,
  declarePowerStrike,
  endPlayerTurn,
  enemyAt,
  movePlayer,
  resetGame,
} from './movement';

describe('first cellar map constraints', () => {
  it('satisfies the authored level contract', () => {
    expect(validateLevel(FIRST_CELLAR_LEVEL)).toEqual([]);
  });

  it('keeps every spike optional while making the hazardous route shorter', () => {
    const hazardous = findLevelPath(
      FIRST_CELLAR_LEVEL,
      FIRST_CELLAR_LEVEL.playerStart,
      FIRST_CELLAR_LEVEL.exit,
    );
    const safe = findLevelPath(
      FIRST_CELLAR_LEVEL,
      FIRST_CELLAR_LEVEL.playerStart,
      FIRST_CELLAR_LEVEL.exit,
      { avoidSpikes: true },
    );

    expect(hazardous).toBeDefined();
    expect(safe).toBeDefined();
    expect(hazardous!.length).toBeLessThan(safe!.length);
    expect(safe!.some((step) => FIRST_CELLAR_LEVEL.spikes.some((spike) => coordsEqual(spike, step)))).toBe(false);
  });

  it('gives every spike at least one two-tile Kick setup', () => {
    for (const spike of FIRST_CELLAR_LEVEL.spikes) {
      expect(spikeKickApproaches(FIRST_CELLAR_LEVEL, spike).length).toBeGreaterThan(0);
    }
  });

  it('supports an aggressive upper-route Power Strike opening without post-action movement', () => {
    let state = resetGame();
    state = movePlayer(state, { col: 2, row: 1 });
    expect(state.player).toEqual({ col: 2, row: 1 });
    expect(state.movePointsRemaining).toBe(0);

    state = declarePowerStrike(state, { col: 3, row: 1 }).state;
    expect(movePlayer(state, { col: 2, row: 0 })).toBe(state);
    state = endPlayerTurn(state);

    expect(state.turn).toBe(2);
    expect(state.playerHp).toBe(COMBAT.playerHealth - COMBAT.orcStrikeDamage);
    expect(enemyAt(state, { col: 3, row: 1 })?.hp).toBe(COMBAT.orcHealth - COMBAT.powerStrikeDamage);

    state = basicStrike(state, { col: 3, row: 1 }).state;
    state = endPlayerTurn(state);
    expect(state.turn).toBe(3);
    expect(state.enemies.some((enemy) => enemy.id === 'far-orc')).toBe(false);

    state = endPlayerTurn(movePlayer(state, { col: 4, row: 1 }));
    state = endPlayerTurn(movePlayer(state, { col: 6, row: 1 }));
    expect(state.playerHp).toBe(1);
    state = movePlayer(state, { col: 7, row: 1 });
    expect(state.won).toBe(true);
  });

  it('supports a longer spike-free route that uses speed to disengage', () => {
    let state = resetGame();

    state = movePlayer(state, { col: 2, row: 3 });
    state = declarePowerStrike(state, { col: 1, row: 3 }).state;
    state = endPlayerTurn(state);
    expect(enemyAt(state, { col: 1, row: 3 })?.hp).toBe(COMBAT.orcHealth - COMBAT.powerStrikeDamage);

    state = basicStrike(state, { col: 1, row: 3 }).state;
    state = endPlayerTurn(state);
    expect(state.playerHp).toBe(3);

    for (const destination of [
      { col: 3, row: 4 },
      { col: 5, row: 4 },
      { col: 6, row: 5 },
      { col: 7, row: 4 },
      { col: 7, row: 2 },
    ]) {
      state = movePlayer(state, destination);
      expect(state.player).toEqual(destination);
      state = endPlayerTurn(state);
      expect(state.lost).toBe(false);
    }

    state = movePlayer(state, { col: 7, row: 1 });
    expect(state.won).toBe(true);
    expect(state.playerHp).toBe(3);
  });
});
