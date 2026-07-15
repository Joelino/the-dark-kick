import { describe, expect, it } from 'vitest';
import { isLegalMove, movePlayer, resetGame } from './movement';
import { createInitialState } from './state';

describe('movement rules', () => {
  it('accepts orthogonally adjacent empty tiles as movement targets', () => {
    const state = createInitialState();

    expect(isLegalMove(state, { col: 1, row: 1 })).toBe(true);
    expect(isLegalMove(state, { col: 2, row: 2 })).toBe(true);
    expect(isLegalMove(state, { col: 1, row: 3 })).toBe(true);
    expect(isLegalMove(state, { col: 0, row: 2 })).toBe(true);
  });

  it('rejects diagonal tiles', () => {
    const state = createInitialState();

    expect(isLegalMove(state, { col: 2, row: 3 })).toBe(false);
  });

  it('rejects tiles more than one step away', () => {
    const state = createInitialState();

    expect(isLegalMove(state, { col: 3, row: 2 })).toBe(false);
  });

  it('rejects movement outside the grid', () => {
    const state = { ...createInitialState(), player: { col: 0, row: 0 } };

    expect(isLegalMove(state, { col: -1, row: 0 })).toBe(false);
    expect(isLegalMove(state, { col: 0, row: -1 })).toBe(false);
  });

  it('updates player position and turn count after a legal move', () => {
    const state = createInitialState();
    const nextState = movePlayer(state, { col: 2, row: 2 });

    expect(nextState.player).toEqual({ col: 2, row: 2 });
    expect(nextState.turn).toBe(2);
  });

  it('restores the original state on reset', () => {
    const movedState = movePlayer(createInitialState(), { col: 2, row: 2 });

    expect(resetGame()).toEqual(createInitialState());
    expect(resetGame()).not.toEqual(movedState);
  });
});
