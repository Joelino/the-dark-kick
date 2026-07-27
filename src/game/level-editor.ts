import { allGridCoords, coordsEqual, isInsideGrid, type GridCoord, GRID_SIZE } from './grid';
import { findLevelPath, type LevelDefinition } from './level';

export const LEVEL_STORAGE_KEY = 'the-dark-kick.active-level.v1';
export const LEVEL_FILE_VERSION = 1;

export type EditorTile = 'floor' | 'wall' | 'spikes' | 'exit' | 'player' | 'orc';

export interface LevelFile {
  readonly version: typeof LEVEL_FILE_VERSION;
  readonly level: LevelDefinition;
}

export interface EditorLevelResult {
  readonly level?: LevelDefinition;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export const levelToEditorTiles = (level: LevelDefinition): readonly EditorTile[] =>
  allGridCoords().map((coord): EditorTile => {
    if (coordsEqual(coord, level.playerStart)) return 'player';
    if (level.enemySpawns.some((spawn) => coordsEqual(spawn.position, coord))) return 'orc';
    if (coordsEqual(coord, level.exit)) return 'exit';
    if (level.walls.some((wall) => coordsEqual(wall, coord))) return 'wall';
    if (level.spikes.some((spike) => coordsEqual(spike, coord))) return 'spikes';
    return 'floor';
  });

export const editorTilesToLevel = (tiles: readonly EditorTile[]): EditorLevelResult => {
  if (tiles.length !== GRID_SIZE.columns * GRID_SIZE.rows) {
    return {
      errors: [`Level must contain exactly ${GRID_SIZE.columns * GRID_SIZE.rows} tiles.`],
      warnings: [],
    };
  }

  const playerIndexes = indexesOf(tiles, 'player');
  const exitIndexes = indexesOf(tiles, 'exit');
  const enemyIndexes = indexesOf(tiles, 'orc');
  const errors: string[] = [];
  const warnings: string[] = [];

  if (playerIndexes.length !== 1) errors.push('Place exactly one player.');
  if (exitIndexes.length !== 1) errors.push('Place exactly one exit.');
  if (enemyIndexes.length === 0) errors.push('Place at least one orc.');
  if (enemyIndexes.length > 4) errors.push('Place no more than four orcs.');
  if (errors.length > 0) return { errors, warnings };

  const level: LevelDefinition = {
    id: 'edited-cellar',
    playerStart: coordForIndex(playerIndexes[0]),
    exit: coordForIndex(exitIndexes[0]),
    walls: indexesOf(tiles, 'wall').map(coordForIndex),
    spikes: indexesOf(tiles, 'spikes').map(coordForIndex),
    enemySpawns: enemyIndexes.map((index, enemyIndex) => ({
      id: `orc-${enemyIndex + 1}`,
      position: coordForIndex(index),
    })),
    chokes: [],
    openAreas: [],
  };

  if (!findLevelPath(level, level.playerStart, level.exit, { avoidSpikes: true })) {
    errors.push('The player needs a spike-free path to the exit.');
  }
  if (level.spikes.length === 0) warnings.push('The room has no spikes for Kick setups.');
  if (level.walls.length < 4) warnings.push('The room may feel too open; add walls to shape movement.');

  return errors.length > 0 ? { errors, warnings } : { level, errors, warnings };
};

export const serializeLevelFile = (level: LevelDefinition): string =>
  JSON.stringify({ version: LEVEL_FILE_VERSION, level } satisfies LevelFile, null, 2);

export const parseLevelFile = (serialized: string): EditorLevelResult => {
  let candidate: unknown;
  try {
    candidate = JSON.parse(serialized);
  } catch {
    return { errors: ['Saved level data is not valid JSON.'], warnings: [] };
  }
  if (!isLevelFile(candidate)) {
    return { errors: ['Saved level data has an unsupported shape or version.'], warnings: [] };
  }
  return editorTilesToLevel(levelToEditorTiles(candidate.level));
};

export const applyEditorTile = (
  tiles: readonly EditorTile[],
  index: number,
  selected: EditorTile,
): readonly EditorTile[] => {
  if (index < 0 || index >= tiles.length) return tiles;
  const next = [...tiles];
  if (selected === 'player' || selected === 'exit') {
    for (let tileIndex = 0; tileIndex < next.length; tileIndex += 1) {
      if (next[tileIndex] === selected) next[tileIndex] = 'floor';
    }
  }
  next[index] = selected;
  return next;
};

const indexesOf = (tiles: readonly EditorTile[], tile: EditorTile): number[] =>
  tiles.flatMap((candidate, index) => candidate === tile ? [index] : []);

const coordForIndex = (index: number): GridCoord => ({
  col: index % GRID_SIZE.columns,
  row: Math.floor(index / GRID_SIZE.columns),
});

const isLevelFile = (candidate: unknown): candidate is LevelFile => {
  if (!isRecord(candidate) || candidate.version !== LEVEL_FILE_VERSION || !isRecord(candidate.level)) return false;
  const level = candidate.level;
  return (
    typeof level.id === 'string' &&
    isCoord(level.playerStart) &&
    isCoord(level.exit) &&
    isCoordArray(level.walls) &&
    isCoordArray(level.spikes) &&
    Array.isArray(level.enemySpawns) &&
    level.enemySpawns.every(
      (spawn) => isRecord(spawn) && typeof spawn.id === 'string' && isCoord(spawn.position),
    )
  );
};

const isCoordArray = (candidate: unknown): candidate is readonly GridCoord[] =>
  Array.isArray(candidate) && candidate.every(isCoord);

const isCoord = (candidate: unknown): candidate is GridCoord =>
  isRecord(candidate) &&
  Number.isInteger(candidate.col) &&
  Number.isInteger(candidate.row) &&
  isInsideGrid({ col: Number(candidate.col), row: Number(candidate.row) });

const isRecord = (candidate: unknown): candidate is Record<string, unknown> =>
  typeof candidate === 'object' && candidate !== null;
