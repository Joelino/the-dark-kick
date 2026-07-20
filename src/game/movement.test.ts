import { describe, expect, it } from 'vitest';
import { basicStrike, enemyAt, isLegalAttackTarget, isLegalMove, kick, movePlayer, resetGame } from './movement';
import { createInitialState, type GameState } from './state';

const withPlayer = (state: GameState, col: number, row: number): GameState => ({ ...state, player: { col, row } });

describe('tactical rules', () => {
  it('allows movement onto the traversable exit and wins the level', () => {
    const state = withPlayer(createInitialState(), 5, 2);
    expect(isLegalMove(state, { col: 6, row: 2 })).toBe(true);

    const won = movePlayer(state, { col: 6, row: 2 });
    expect(won.won).toBe(true);
    expect(won.player).toEqual({ col: 6, row: 2 });
  });

  it('rejects movement after victory', () => {
    const won = movePlayer(withPlayer(createInitialState(), 5, 2), { col: 6, row: 2 });

    expect(movePlayer(won, { col: 7, row: 2 })).toBe(won);
  });

  it('rejects diagonal, ranged, wall, and occupied movement', () => {
    const state = createInitialState();

    expect(isLegalMove(state, { col: 2, row: 3 })).toBe(false);
    expect(isLegalMove(state, { col: 3, row: 2 })).toBe(false);
    expect(isLegalMove(withPlayer(state, 3, 0), { col: 3, row: 1 })).toBe(false);
    expect(isLegalMove(state, { col: 3, row: 2 })).toBe(false);
  });

  it('basic strike is legal only against adjacent orthogonal enemies and deals 1 damage', () => {
    const state = withPlayer(createInitialState(), 2, 2);

    expect(isLegalAttackTarget(state, { col: 3, row: 2 })).toBe(true);
    expect(isLegalAttackTarget(state, { col: 4, row: 2 })).toBe(false);
    expect(isLegalAttackTarget(withPlayer(state, 2, 1), { col: 3, row: 2 })).toBe(false);

    const result = basicStrike(state, { col: 3, row: 2 }).state;
    expect(enemyAt(result, { col: 3, row: 2 })?.hp).toBe(3);
    expect(result.turn).toBe(2);
  });

  it('kick pushes directly away into an empty tile and deals base damage', () => {
    const state: GameState = {
      ...withPlayer(createInitialState(), 3, 3),
      walls: [],
    };
    const result = kick(state, { col: 3, row: 2 });

    expect(result.pushedFrom).toEqual({ col: 3, row: 2 });
    expect(result.pushedTo).toEqual({ col: 3, row: 1 });
    expect(enemyAt(result.state, { col: 3, row: 1 })?.hp).toBe(3);
  });

  it('kick collision against a wall prevents movement and deals additional damage', () => {
    const state = withPlayer(createInitialState(), 3, 3);
    const result = kick(state, { col: 3, row: 2 });

    expect(enemyAt(result.state, { col: 3, row: 2 })?.hp).toBe(2);
  });

  it('kick onto spikes kills the enemy and leaves a persistent corpse at the landing tile', () => {
    const state = withPlayer(createInitialState(), 2, 2);
    const result = kick(state, { col: 3, row: 2 });

    expect(result.pushedTo).toEqual({ col: 4, row: 2 });
    expect(enemyAt(result.state, { col: 4, row: 2 })).toBeUndefined();
    expect(result.state.enemies).toHaveLength(0);
    expect(result.state.corpses).toEqual([{ enemyId: 'training-dummy', position: { col: 4, row: 2 } }]);

    const moved = movePlayer(result.state, { col: 2, row: 1 });
    expect(moved.corpses).toEqual(result.state.corpses);
  });

  it('failed push against a blocked ordinary obstacle keeps base kick damage', () => {
    const state: GameState = {
      ...withPlayer(createInitialState(), 2, 2),
      enemies: [
        { id: 'a', position: { col: 3, row: 2 }, hp: 4 },
        { id: 'b', position: { col: 4, row: 2 }, hp: 4 },
      ],
    };

    const result = kick(state, { col: 3, row: 2 });
    expect(enemyAt(result.state, { col: 3, row: 2 })?.hp).toBe(3);
    expect(enemyAt(result.state, { col: 4, row: 2 })?.hp).toBe(4);
  });

  it('reset and play again restore enemy HP, positions, turn count, and victory state', () => {
    const damaged = basicStrike(withPlayer(createInitialState(), 2, 2), { col: 3, row: 2 }).state;
    const won = movePlayer(withPlayer(damaged, 5, 2), { col: 6, row: 2 });

    expect(won).not.toEqual(createInitialState());
    expect(resetGame()).toEqual(createInitialState());
    expect(resetGame().corpses).toEqual([]);
  });
});
