export interface GridCoord {
  readonly col: number;
  readonly row: number;
}

export interface GridSize {
  readonly columns: number;
  readonly rows: number;
}

export const GRID_SIZE: GridSize = {
  columns: 8,
  rows: 6,
};

export const coordsEqual = (a: GridCoord, b: GridCoord): boolean => a.col === b.col && a.row === b.row;

export const isInsideGrid = (coord: GridCoord, grid: GridSize = GRID_SIZE): boolean =>
  coord.col >= 0 && coord.col < grid.columns && coord.row >= 0 && coord.row < grid.rows;

export const manhattanDistance = (a: GridCoord, b: GridCoord): number =>
  Math.abs(a.col - b.col) + Math.abs(a.row - b.row);

export const allGridCoords = (grid: GridSize = GRID_SIZE): GridCoord[] => {
  const coords: GridCoord[] = [];

  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.columns; col += 1) {
      coords.push({ col, row });
    }
  }

  return coords;
};
