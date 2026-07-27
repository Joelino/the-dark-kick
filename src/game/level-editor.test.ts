import { afterEach, describe, expect, it } from 'vitest';
import { allGridCoords } from './grid';
import {
  applyEditorTile,
  editorTilesToLevel,
  levelToEditorTiles,
  parseLevelFile,
  serializeLevelFile,
  type EditorTile,
} from './level-editor';
import {
  FIRST_CELLAR_LEVEL,
  resetActiveLevel,
  setActiveLevel,
} from './level';
import { createInitialState } from './state';

afterEach(() => {
  resetActiveLevel();
});

describe('single-slot level editor file', () => {
  it('round-trips the built-in room through the editor tile document', () => {
    const result = editorTilesToLevel(levelToEditorTiles(FIRST_CELLAR_LEVEL));

    expect(result.errors).toEqual([]);
    expect(result.level?.playerStart).toEqual(FIRST_CELLAR_LEVEL.playerStart);
    expect(result.level?.exit).toEqual(FIRST_CELLAR_LEVEL.exit);
    expect(result.level?.walls).toHaveLength(FIRST_CELLAR_LEVEL.walls.length);
    expect(result.level?.walls).toEqual(expect.arrayContaining([...FIRST_CELLAR_LEVEL.walls]));
    expect(result.level?.spikes).toHaveLength(FIRST_CELLAR_LEVEL.spikes.length);
    expect(result.level?.spikes).toEqual(expect.arrayContaining([...FIRST_CELLAR_LEVEL.spikes]));
    expect(result.level?.enemySpawns.map((spawn) => spawn.position)).toEqual(
      [...FIRST_CELLAR_LEVEL.enemySpawns]
        .sort((a, b) => a.position.row - b.position.row || a.position.col - b.position.col)
        .map((spawn) => spawn.position),
    );
  });

  it('moves unique player and exit markers instead of duplicating them', () => {
    let tiles = levelToEditorTiles(FIRST_CELLAR_LEVEL);
    const oldPlayerIndex = FIRST_CELLAR_LEVEL.playerStart.row * 8 + FIRST_CELLAR_LEVEL.playerStart.col;
    const replacementIndex = 0;

    tiles = applyEditorTile(tiles, replacementIndex, 'player');

    expect(tiles[oldPlayerIndex]).toBe('floor');
    expect(tiles[replacementIndex]).toBe('player');
    expect(tiles.filter((tile) => tile === 'player')).toHaveLength(1);
  });

  it('rejects a room whose walls remove every spike-free route to the exit', () => {
    const tiles: EditorTile[] = allGridCoords().map(() => 'floor');
    tiles[0] = 'player';
    tiles[2] = 'exit';
    tiles[3] = 'orc';
    for (const index of [1, 9, 17, 25, 33, 41]) tiles[index] = 'wall';

    const result = editorTilesToLevel(tiles);

    expect(result.level).toBeUndefined();
    expect(result.errors).toContain('The player needs a spike-free path to the exit.');
  });

  it('serializes, parses, and applies the one active level file', () => {
    const edited = editorTilesToLevel(levelToEditorTiles(FIRST_CELLAR_LEVEL)).level!;
    const parsed = parseLevelFile(serializeLevelFile(edited));

    expect(parsed.errors).toEqual([]);
    expect(parsed.level).toBeDefined();
    setActiveLevel(parsed.level!);
    const state = createInitialState();
    expect(state.player).toEqual(edited.playerStart);
    expect(state.exit).toEqual(edited.exit);
    expect(state.enemies).toHaveLength(4);
  });

  it('rejects malformed saved data', () => {
    expect(parseLevelFile('{oops').errors).toEqual(['Saved level data is not valid JSON.']);
    expect(parseLevelFile('{"version":2}').errors).toEqual([
      'Saved level data has an unsupported shape or version.',
    ]);
  });
});
