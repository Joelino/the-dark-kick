import {
  allGridCoords,
  coordsEqual,
  isInsideGrid,
  orthogonalNeighbors,
  type GridCoord,
  type GridSize,
  GRID_SIZE,
} from './grid';

export interface EnemySpawn {
  readonly id: string;
  readonly position: GridCoord;
}

export interface ChokeDefinition {
  readonly id: string;
  readonly orientation: 'horizontal' | 'vertical';
  readonly tiles: readonly GridCoord[];
}

export interface OpenAreaDefinition {
  readonly id: string;
  readonly tiles: readonly GridCoord[];
}

export interface LevelDefinition {
  readonly id: string;
  readonly playerStart: GridCoord;
  readonly exit: GridCoord;
  readonly walls: readonly GridCoord[];
  readonly spikes: readonly GridCoord[];
  readonly enemySpawns: readonly EnemySpawn[];
  readonly chokes: readonly ChokeDefinition[];
  readonly openAreas: readonly OpenAreaDefinition[];
}

const coords = (...pairs: ReadonlyArray<readonly [number, number]>): readonly GridCoord[] =>
  pairs.map(([col, row]) => ({ col, row }));

/**
 * Authored from docs/MAP_GENERATION.md:
 *
 *   ...###..
 *   ...F.^.E
 *   .P.###..
 *   ...###^.
 *   ^N......
 *   ..###...
 *
 * The upper route is shorter but hazardous and occupied. The lower route is
 * longer, spike-free, and passes through a second choke into the exit side.
 */
export const FIRST_CELLAR_LEVEL: LevelDefinition = {
  id: 'first-cellar-dual-route',
  playerStart: { col: 1, row: 2 },
  exit: { col: 7, row: 1 },
  walls: coords(
    [3, 0], [4, 0], [5, 0],
    [3, 2], [4, 2], [5, 2],
    [3, 3], [4, 3], [5, 3],
    [2, 5], [3, 5], [4, 5],
  ),
  spikes: coords([0, 4], [5, 1], [6, 3]),
  enemySpawns: [
    { id: 'near-orc', position: { col: 1, row: 4 } },
    { id: 'far-orc', position: { col: 3, row: 1 } },
    { id: 'cellar-orc', position: { col: 7, row: 4 } },
    { id: 'exit-orc', position: { col: 6, row: 0 } },
  ],
  chokes: [
    { id: 'upper-hazard-choke', orientation: 'horizontal', tiles: coords([3, 1], [4, 1], [5, 1]) },
    { id: 'lower-safe-choke', orientation: 'horizontal', tiles: coords([3, 4], [4, 4]) },
  ],
  openAreas: [
    {
      id: 'west-setup-room',
      tiles: coords(
        [0, 1], [1, 1], [2, 1],
        [0, 2], [1, 2], [2, 2],
        [0, 3], [1, 3], [2, 3],
        [0, 4], [1, 4], [2, 4],
      ),
    },
    {
      id: 'east-exit-room',
      tiles: coords(
        [5, 4], [6, 4], [7, 4],
        [5, 5], [6, 5], [7, 5],
      ),
    },
  ],
};

let activeLevel: LevelDefinition = FIRST_CELLAR_LEVEL;

export const getActiveLevel = (): LevelDefinition => activeLevel;

export const setActiveLevel = (level: LevelDefinition): void => {
  activeLevel = cloneLevel(level);
};

export const resetActiveLevel = (): void => {
  activeLevel = FIRST_CELLAR_LEVEL;
};

export interface LevelPathOptions {
  readonly avoidSpikes?: boolean;
  readonly occupied?: readonly GridCoord[];
}

export const findLevelPath = (
  level: LevelDefinition,
  from: GridCoord,
  to: GridCoord,
  options: LevelPathOptions = {},
  grid: GridSize = GRID_SIZE,
): readonly GridCoord[] | undefined => {
  const queue: Array<{ coord: GridCoord; path: readonly GridCoord[] }> = [{ coord: from, path: [] }];
  const seen = new Set([key(from)]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (coordsEqual(current.coord, to)) return current.path;
    for (const candidate of orthogonalNeighbors(current.coord)) {
      const candidateKey = key(candidate);
      if (
        seen.has(candidateKey) ||
        !isInsideGrid(candidate, grid) ||
        includesCoord(level.walls, candidate) ||
        (options.avoidSpikes === true && includesCoord(level.spikes, candidate)) ||
        options.occupied?.some((coord) => coordsEqual(coord, candidate))
      ) {
        continue;
      }
      seen.add(candidateKey);
      queue.push({ coord: candidate, path: [...current.path, candidate] });
    }
  }
  return undefined;
};

export const spikeKickApproaches = (
  level: LevelDefinition,
  spike: GridCoord,
  grid: GridSize = GRID_SIZE,
): readonly { readonly target: GridCoord; readonly player: GridCoord }[] => {
  const lines: Array<{ target: GridCoord; player: GridCoord }> = [];
  for (const target of orthogonalNeighbors(spike)) {
    const player = {
      col: target.col + (target.col - spike.col),
      row: target.row + (target.row - spike.row),
    };
    if (
      isInsideGrid(target, grid) &&
      isInsideGrid(player, grid) &&
      !includesCoord(level.walls, target) &&
      !includesCoord(level.walls, player)
    ) {
      lines.push({ target, player });
    }
  }
  return lines;
};

export const validateLevel = (
  level: LevelDefinition,
  grid: GridSize = GRID_SIZE,
): readonly string[] => {
  const issues: string[] = [];
  const placed = [
    { kind: 'player', coord: level.playerStart },
    { kind: 'exit', coord: level.exit },
    ...level.walls.map((coord) => ({ kind: 'wall', coord })),
    ...level.spikes.map((coord) => ({ kind: 'spike', coord })),
    ...level.enemySpawns.map((spawn) => ({ kind: `enemy ${spawn.id}`, coord: spawn.position })),
  ];

  for (const item of placed) {
    if (!isInsideGrid(item.coord, grid)) issues.push(`${item.kind} is outside the board at ${key(item.coord)}`);
  }

  for (let index = 0; index < placed.length; index += 1) {
    for (let other = index + 1; other < placed.length; other += 1) {
      if (coordsEqual(placed[index].coord, placed[other].coord)) {
        issues.push(`${placed[index].kind} overlaps ${placed[other].kind} at ${key(placed[index].coord)}`);
      }
    }
  }

  const safePath = findLevelPath(level, level.playerStart, level.exit, { avoidSpikes: true }, grid);
  if (!safePath) issues.push('player start has no spike-free path to the exit');

  const safeTiles = allGridCoords(grid).filter(
    (coord) => !includesCoord(level.walls, coord) && !includesCoord(level.spikes, coord),
  );
  const reachableSafeTiles = safeTiles.length > 0
    ? floodSafeTiles(level, safeTiles[0], grid)
    : [];
  if (reachableSafeTiles.length !== safeTiles.length) {
    issues.push('non-spike walkable tiles do not form one connected safe network');
  }

  for (const choke of level.chokes) {
    if (choke.tiles.length < 2) issues.push(`${choke.id} must be at least two tiles long`);
    for (const tile of choke.tiles) {
      if (includesCoord(level.walls, tile)) issues.push(`${choke.id} contains a wall at ${key(tile)}`);
      const sides = choke.orientation === 'horizontal'
        ? [{ col: tile.col, row: tile.row - 1 }, { col: tile.col, row: tile.row + 1 }]
        : [{ col: tile.col - 1, row: tile.row }, { col: tile.col + 1, row: tile.row }];
      if (!sides.every((side) => !isInsideGrid(side, grid) || includesCoord(level.walls, side))) {
        issues.push(`${choke.id} is wider than one tile at ${key(tile)}`);
      }
    }
  }

  for (const area of level.openAreas) {
    const traversable = area.tiles.filter((tile) => !includesCoord(level.walls, tile));
    if (traversable.length < 6) issues.push(`${area.id} is too small to support circling`);
  }

  for (const spike of level.spikes) {
    if (spikeKickApproaches(level, spike, grid).length === 0) {
      issues.push(`spike at ${key(spike)} has no two-tile Kick approach`);
    }
  }

  return issues;
};

const floodSafeTiles = (
  level: LevelDefinition,
  start: GridCoord,
  grid: GridSize,
): readonly GridCoord[] => {
  const queue = [start];
  const seen = new Set([key(start)]);
  const result: GridCoord[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const candidate of orthogonalNeighbors(current)) {
      const candidateKey = key(candidate);
      if (
        seen.has(candidateKey) ||
        !isInsideGrid(candidate, grid) ||
        includesCoord(level.walls, candidate) ||
        includesCoord(level.spikes, candidate)
      ) {
        continue;
      }
      seen.add(candidateKey);
      queue.push(candidate);
    }
  }
  return result;
};

const includesCoord = (coordsToSearch: readonly GridCoord[], coord: GridCoord): boolean =>
  coordsToSearch.some((candidate) => coordsEqual(candidate, coord));

const key = (coord: GridCoord): string => `${coord.col},${coord.row}`;

const cloneLevel = (level: LevelDefinition): LevelDefinition => ({
  ...level,
  playerStart: { ...level.playerStart },
  exit: { ...level.exit },
  walls: level.walls.map((coord) => ({ ...coord })),
  spikes: level.spikes.map((coord) => ({ ...coord })),
  enemySpawns: level.enemySpawns.map((spawn) => ({
    ...spawn,
    position: { ...spawn.position },
  })),
  chokes: level.chokes.map((choke) => ({
    ...choke,
    tiles: choke.tiles.map((coord) => ({ ...coord })),
  })),
  openAreas: level.openAreas.map((area) => ({
    ...area,
    tiles: area.tiles.map((coord) => ({ ...coord })),
  })),
});
