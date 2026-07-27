import Phaser from 'phaser';
import './style.css';
import {
  applyCombatConfig,
  clampCombatConfig,
  COMBAT_DEFAULTS,
  COMBAT_TUNING,
  type CombatConfig,
} from './config/combat';
import { GRID_SIZE } from './game/grid';
import { GAME_HEIGHT, logicalGameWidthForViewport } from './game/layout';
import {
  applyEditorTile,
  editorTilesToLevel,
  LEVEL_STORAGE_KEY,
  levelToEditorTiles,
  parseLevelFile,
  serializeLevelFile,
  type EditorTile,
} from './game/level-editor';
import { getActiveLevel, setActiveLevel } from './game/level';
import { TacticalScene } from './scenes/TacticalScene';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app game mount.');

let game: Phaser.Game | undefined;
let resizeFrame: number | undefined;

const EDITOR_TOOLS: readonly {
  readonly tile: EditorTile;
  readonly label: string;
  readonly glyph: string;
  readonly description: string;
}[] = [
  { tile: 'floor', label: 'Floor', glyph: '·', description: 'Clear a tile' },
  { tile: 'wall', label: 'Wall', glyph: '▦', description: 'Blocks movement' },
  { tile: 'spikes', label: 'Spikes', glyph: '⌃', description: 'Damages entrants' },
  { tile: 'exit', label: 'Exit', glyph: '⇥', description: 'One required' },
  { tile: 'player', label: 'Player', glyph: 'P', description: 'One required' },
  { tile: 'orc', label: 'Orc', glyph: 'O', description: 'One to four' },
] as const;

const getLogicalGameWidth = (): number => {
  const viewport = window.visualViewport;
  const width = app.clientWidth || viewport?.width || window.innerWidth;
  const height = app.clientHeight || viewport?.height || window.innerHeight;
  return logicalGameWidthForViewport(width, height);
};

const syncGameWidthToViewport = (): void => {
  if (!game) return;
  if (resizeFrame !== undefined) window.cancelAnimationFrame(resizeFrame);
  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = undefined;
    const nextWidth = getLogicalGameWidth();
    if (game && game.scale.gameSize.width !== nextWidth) game.scale.setGameSize(nextWidth, GAME_HEIGHT);
  });
};

const startGame = (tuning: CombatConfig): void => {
  if (game) return;
  applyCombatConfig(tuning);
  document.querySelector('#home-screen')?.remove();
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#111827',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: getLogicalGameWidth(),
      height: GAME_HEIGHT,
    },
    input: {
      activePointers: 2,
    },
    scene: [TacticalScene],
  });
  window.addEventListener('resize', syncGameWidthToViewport);
  window.visualViewport?.addEventListener('resize', syncGameWidthToViewport);
};

const replaceHomeScreen = (panel: HTMLElement): void => {
  document.querySelector('#home-screen')?.remove();
  const screen = document.createElement('main');
  screen.id = 'home-screen';
  screen.append(panel);
  document.body.append(screen);
};

const showTuningScreen = (initialDraft: CombatConfig = { ...COMBAT_DEFAULTS }): void => {
  let draft: CombatConfig = { ...initialDraft };

  const panel = document.createElement('section');
  panel.className = 'tuning-panel';
  panel.setAttribute('aria-labelledby', 'tuning-title');

  const heading = document.createElement('header');
  heading.className = 'tuning-heading';
  const titleGroup = document.createElement('div');
  const title = document.createElement('h1');
  title.id = 'tuning-title';
  title.textContent = 'THE DARK KICK';
  const subtitle = document.createElement('p');
  subtitle.textContent = 'Tune the cellar, then test the room.';
  titleGroup.append(title, subtitle);

  const headingActions = document.createElement('div');
  headingActions.className = 'home-actions';
  const editor = document.createElement('button');
  editor.className = 'secondary-button';
  editor.type = 'button';
  editor.textContent = 'LEVEL EDITOR';
  editor.addEventListener('click', () => showLevelEditor(draft));
  const start = document.createElement('button');
  start.className = 'primary-button';
  start.type = 'button';
  start.textContent = 'START RUN';
  start.addEventListener('click', () => startGame(draft));
  headingActions.append(editor, start);
  heading.append(titleGroup, headingActions);

  const list = document.createElement('div');
  list.className = 'tuning-list';
  list.setAttribute('aria-label', 'Combat tuning values');

  const renderRows = (): void => {
    list.replaceChildren();
    for (const definition of COMBAT_TUNING) {
      if (definition.key === 'orcCount' && getActiveLevel().id === 'edited-cellar') continue;
      const row = document.createElement('div');
      row.className = 'tuning-row';

      const label = document.createElement('span');
      label.className = 'tuning-label';
      label.textContent = definition.label;

      const controls = document.createElement('div');
      controls.className = 'stepper';
      const minus = document.createElement('button');
      minus.type = 'button';
      minus.textContent = '−';
      minus.setAttribute('aria-label', `Decrease ${definition.label}`);
      const value = document.createElement('output');
      value.value = String(draft[definition.key]);
      value.textContent = String(draft[definition.key]);
      value.setAttribute('aria-label', `${definition.label}: ${draft[definition.key]}`);
      const plus = document.createElement('button');
      plus.type = 'button';
      plus.textContent = '+';
      plus.setAttribute('aria-label', `Increase ${definition.label}`);

      const update = (direction: -1 | 1): void => {
        draft = clampCombatConfig({
          ...draft,
          [definition.key]: draft[definition.key] + direction * definition.step,
        });
        renderRows();
      };
      minus.disabled = draft[definition.key] <= definition.min;
      plus.disabled = draft[definition.key] >= definition.max;
      minus.addEventListener('click', () => update(-1));
      plus.addEventListener('click', () => update(1));
      controls.append(minus, value, plus);
      row.append(label, controls);
      list.append(row);
    }
  };

  const footer = document.createElement('footer');
  footer.className = 'tuning-footer';
  const note = document.createElement('p');
  note.textContent = getActiveLevel().id === 'edited-cellar'
    ? `Edited level active · ${getActiveLevel().enemySpawns.length} map orcs will spawn.`
    : 'Built-in level active · values apply to the next run.';
  const reset = document.createElement('button');
  reset.className = 'secondary-button';
  reset.type = 'button';
  reset.textContent = 'RESET TO DEFAULTS';
  reset.addEventListener('click', () => {
    draft = { ...COMBAT_DEFAULTS };
    renderRows();
  });
  footer.append(note, reset);

  renderRows();
  panel.append(heading, list, footer);
  replaceHomeScreen(panel);
};

const showLevelEditor = (tuningDraft: CombatConfig): void => {
  const activeLevel = getActiveLevel();
  let tiles = levelToEditorTiles({
    ...activeLevel,
    enemySpawns: activeLevel.id === 'edited-cellar'
      ? activeLevel.enemySpawns
      : activeLevel.enemySpawns.slice(0, tuningDraft.orcCount),
  });
  let selected: EditorTile = 'wall';

  const panel = document.createElement('section');
  panel.className = 'editor-panel';
  panel.setAttribute('aria-labelledby', 'editor-title');

  const heading = document.createElement('header');
  heading.className = 'editor-heading';
  const titleGroup = document.createElement('div');
  const title = document.createElement('h1');
  title.id = 'editor-title';
  title.textContent = 'LEVEL EDITOR';
  const subtitle = document.createElement('p');
  subtitle.textContent = 'Paint one active 8×6 room.';
  titleGroup.append(title, subtitle);
  const back = document.createElement('button');
  back.className = 'secondary-button compact-button';
  back.type = 'button';
  back.textContent = 'BACK';
  back.addEventListener('click', () => showTuningScreen(tuningDraft));
  heading.append(titleGroup, back);

  const body = document.createElement('div');
  body.className = 'editor-body';
  const palette = document.createElement('div');
  palette.className = 'editor-palette';
  palette.setAttribute('aria-label', 'Level tile selector');
  const grid = document.createElement('div');
  grid.className = 'level-editor-grid';
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', 'Editable level grid');

  const status = document.createElement('p');
  status.className = 'editor-status';
  status.setAttribute('role', 'status');
  status.textContent = 'Select a tile type, then tap the room.';

  const renderPalette = (): void => {
    palette.replaceChildren();
    for (const tool of EDITOR_TOOLS) {
      const button = document.createElement('button');
      button.className = `editor-tool tile-${tool.tile}`;
      button.type = 'button';
      button.setAttribute('aria-pressed', String(selected === tool.tile));
      button.setAttribute('aria-label', `${tool.label}: ${tool.description}`);
      const glyph = document.createElement('span');
      glyph.className = 'editor-tool-glyph';
      glyph.textContent = tool.glyph;
      const label = document.createElement('span');
      label.textContent = tool.label;
      button.append(glyph, label);
      button.addEventListener('click', () => {
        selected = tool.tile;
        status.textContent = `${tool.label} selected.`;
        renderPalette();
      });
      palette.append(button);
    }
  };

  const renderGrid = (): void => {
    grid.replaceChildren();
    tiles.forEach((tile, index) => {
      const coord = {
        col: index % GRID_SIZE.columns,
        row: Math.floor(index / GRID_SIZE.columns),
      };
      const tool = EDITOR_TOOLS.find((candidate) => candidate.tile === tile)!;
      const cell = document.createElement('button');
      cell.className = `level-editor-cell tile-${tile}`;
      cell.type = 'button';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute(
        'aria-label',
        `Column ${coord.col + 1}, row ${coord.row + 1}: ${tool.label}`,
      );
      cell.textContent = tool.glyph;
      cell.addEventListener('click', () => {
        tiles = applyEditorTile(tiles, index, selected);
        status.textContent = `${toolLabel(selected)} placed at ${coord.col + 1},${coord.row + 1}.`;
        renderGrid();
      });
      grid.append(cell);
    });
  };

  body.append(palette, grid);

  const footer = document.createElement('footer');
  footer.className = 'editor-footer';
  const save = document.createElement('button');
  save.className = 'primary-button';
  save.type = 'button';
  save.textContent = 'SAVE LEVEL';
  save.addEventListener('click', () => {
    const result = editorTilesToLevel(tiles);
    if (!result.level) {
      status.classList.add('is-error');
      status.textContent = result.errors.join(' ');
      return;
    }
    status.classList.remove('is-error');
    setActiveLevel(result.level);
    const serialized = serializeLevelFile(result.level);
    try {
      window.localStorage.setItem(LEVEL_STORAGE_KEY, serialized);
    } catch {
      status.classList.add('is-error');
      status.textContent = 'The browser could not persist this level.';
      return;
    }
    downloadLevelFile(serialized);
    status.textContent = [
      'Saved as the active level; level.json download started.',
      ...result.warnings,
    ].join(' ');
  });
  footer.append(status, save);

  renderPalette();
  renderGrid();
  panel.append(heading, body, footer);
  replaceHomeScreen(panel);
};

const toolLabel = (tile: EditorTile): string =>
  EDITOR_TOOLS.find((tool) => tool.tile === tile)?.label ?? tile;

const downloadLevelFile = (serialized: string): void => {
  const url = URL.createObjectURL(new Blob([serialized], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'level.json';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const restoreSavedLevel = (): void => {
  let serialized: string | null = null;
  try {
    serialized = window.localStorage.getItem(LEVEL_STORAGE_KEY);
  } catch {
    return;
  }
  if (!serialized) return;
  const result = parseLevelFile(serialized);
  if (result.level) setActiveLevel(result.level);
};

restoreSavedLevel();
showTuningScreen();
