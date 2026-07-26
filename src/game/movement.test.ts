import { describe, expect, it } from 'vitest';
import { COMBAT } from '../config/combat';
import { basicStrike, chooseEnemyIntents, endPlayerTurn, enemyAt, kick, movePlayer, resetGame, withEnemyIntents } from './movement';
import type { GameState } from './state';

const scenario = (partial: Partial<GameState> = {}): GameState => withEnemyIntents({
  ...resetGame(), walls: [], spikes: [], enemies: [], intents: [], ...partial,
});
const orc = (id: string, col: number, row: number, stunnedTurns = 0) => ({ id, position: { col, row }, hp: COMBAT.orcMaxHealth, stunnedTurns });

describe('strict player and enemy turns', () => {
  it('permits one move and one action in either order, then advances the enemy turn', () => {
    let state = scenario({ player: { col: 1, row: 2 }, enemies: [orc('orc', 3, 2)] });
    state = movePlayer(state, { col: 2, row: 2 });
    expect(state.moved).toBe(true);
    expect(movePlayer(state, { col: 2, row: 1 })).toBe(state);
    state = basicStrike(state, { col: 3, row: 2 }).state;
    expect(state.acted).toBe(true);
    expect(enemyAt(state, { col: 3, row: 2 })?.hp).toBe(3);
    const next = endPlayerTurn(state);
    expect(next.turn).toBe(2);
    expect(next.moved).toBe(false);
    expect(next.acted).toBe(false);
  });

  it('gives every unstunned orc one deterministic move or adjacent attack intent', () => {
    const state = scenario({ player: { col: 1, row: 2 }, enemies: [orc('near', 2, 2), orc('far', 7, 4)] });
    expect(chooseEnemyIntents(state)).toEqual([
      { enemyId: 'near', kind: 'attack', target: { col: 1, row: 2 } },
      { enemyId: 'far', kind: 'move', target: { col: 7, row: 3 } },
    ]);
    const resolved = endPlayerTurn({ ...state, moved: true });
    expect(resolved.playerHp).toBe(COMBAT.playerMaxHealth - COMBAT.orcStrikeDamage);
    expect(enemyAt(resolved, { col: 7, row: 3 })?.id).toBe('far');
  });
});

describe('kick payoffs and stun', () => {
  it('repositions on open floor for zero damage', () => {
    const state = scenario({ player: { col: 1, row: 2 }, enemies: [orc('orc', 2, 2)] });
    const result = kick(state, { col: 2, row: 2 });
    expect(result.damageAmount).toBe(0);
    expect(result.pushedTo).toEqual({ col: 3, row: 2 });
    expect(enemyAt(result.state, { col: 3, row: 2 })?.hp).toBe(4);
  });

  it('deals one and stuns for the next action on a wall or edge collision', () => {
    const state = scenario({ player: { col: 1, row: 0 }, enemies: [orc('orc', 0, 0)] });
    const kicked = kick(state, { col: 0, row: 0 });
    expect(kicked.damageAmount).toBe(1);
    expect(enemyAt(kicked.state, { col: 0, row: 0 })?.stunnedTurns).toBe(1);
    expect(chooseEnemyIntents(kicked.state)).toEqual([]);
    const next = endPlayerTurn(kicked.state);
    expect(enemyAt(next, { col: 0, row: 0 })?.stunnedTurns).toBe(0);
    expect(next.playerHp).toBe(COMBAT.playerMaxHealth);
    expect(next.intents).toHaveLength(1);
  });

  it('stuns both enemies in an enemy collision and damages only the pushed enemy', () => {
    const state = scenario({ player: { col: 1, row: 2 }, enemies: [orc('a', 2, 2), orc('b', 3, 2)] });
    const result = kick(state, { col: 2, row: 2 });
    expect(result.damageAmount).toBe(1);
    expect(result.state.enemies.map(({ hp, stunnedTurns }) => ({ hp, stunnedTurns }))).toEqual([
      { hp: 3, stunnedTurns: 1 }, { hp: 4, stunnedTurns: 1 },
    ]);
  });

  it('combines the three-point spike bonus with impact to kill a full-health orc', () => {
    const state = scenario({ player: { col: 1, row: 2 }, spikes: [{ col: 3, row: 2 }], enemies: [orc('orc', 2, 2)] });
    const result = kick(state, { col: 2, row: 2 });
    expect(result.damageAmount).toBe(COMBAT.wallCollisionDamage + COMBAT.spikePushDamage);
    expect(result.state.enemies).toHaveLength(0);
    expect(result.state.corpses.at(-1)?.position).toEqual({ col: 3, row: 2 });
  });
});
