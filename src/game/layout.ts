export const GAME_HEIGHT = 540;
export const MIN_GAME_WIDTH = 960;
export const MAX_GAME_WIDTH = 1600;

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface TextArea {
  readonly x: number;
  readonly headingY: number;
  readonly bodyY: number;
  readonly width: number;
}

export interface TacticalLayout {
  readonly gameWidth: number;
  readonly shortLandscape: boolean;
  readonly hasSeparateLogPanel: boolean;
  readonly tileSize: number;
  readonly tileStep: number;
  readonly spriteScale: number;
  readonly gridOrigin: { readonly x: number; readonly y: number };
  readonly boardFrame: Rect;
  readonly hudPanel: Rect;
  readonly logPanel?: Rect;
  readonly logArea: TextArea;
  readonly boardHeading: { readonly x: number; readonly y: number };
  readonly turn: { readonly x: number; readonly y: number };
  readonly title: { readonly x: number; readonly y: number };
  readonly subtitle: { readonly x: number; readonly y: number };
  readonly buttons: {
    readonly x: number;
    readonly width: number;
    readonly height: number;
    readonly actionYs: readonly [number, number, number];
    readonly resetY: number;
    readonly resetHeight: number;
  };
}

export const logicalGameWidthForViewport = (viewportWidth: number, viewportHeight: number): number => {
  if (!Number.isFinite(viewportWidth) || !Number.isFinite(viewportHeight) || viewportWidth <= 0 || viewportHeight <= 0) {
    return MIN_GAME_WIDTH;
  }

  return Math.min(MAX_GAME_WIDTH, Math.max(MIN_GAME_WIDTH, Math.round((GAME_HEIGHT * viewportWidth) / viewportHeight)));
};

export const createTacticalLayout = (gameWidth: number): TacticalLayout => {
  const width = Math.min(MAX_GAME_WIDTH, Math.max(MIN_GAME_WIDTH, Math.round(gameWidth)));
  if (width < 1080) return createStandardLayout(width);

  const boardFrame = {
    x: Math.max(320, Math.round((width - 660) / 2)),
    y: 28,
    width: 660,
    height: 500,
  };
  const hudPanel = { x: 20, y: 18, width: boardFrame.x - 40, height: 504 };
  const availableLogWidth = width - (boardFrame.x + boardFrame.width) - 40;
  const hasSeparateLogPanel = availableLogWidth >= 150;
  const logPanel = hasSeparateLogPanel
    ? { x: boardFrame.x + boardFrame.width + 20, y: 18, width: availableLogWidth, height: 504 }
    : undefined;
  const logArea = logPanel
    ? { x: logPanel.x + 16, headingY: 43, bodyY: 72, width: logPanel.width - 32 }
    : { x: hudPanel.x + 16, headingY: 448, bodyY: 472, width: hudPanel.width - 32 };

  return {
    gameWidth: width,
    shortLandscape: true,
    hasSeparateLogPanel,
    tileSize: 76,
    tileStep: 80,
    spriteScale: 76 / 32,
    gridOrigin: { x: boardFrame.x + 50, y: 78 },
    boardFrame,
    hudPanel,
    ...(logPanel ? { logPanel } : {}),
    logArea,
    boardHeading: { x: boardFrame.x + 16, y: 12 },
    turn: { x: boardFrame.x + boardFrame.width - 16, y: 12 },
    title: { x: hudPanel.x + 16, y: 35 },
    subtitle: { x: hudPanel.x + 17, y: 67 },
    buttons: {
      x: hudPanel.x + hudPanel.width / 2,
      width: Math.min(320, hudPanel.width - 40),
      height: 76,
      actionYs: [138, 224, 310],
      resetY: 398,
      resetHeight: 46,
    },
  };
};

const createStandardLayout = (gameWidth: number): TacticalLayout => {
  const boardFrame = { x: 304, y: 44, width: 568, height: 428 };
  const hudPanel = { x: 20, y: 18, width: 268, height: 504 };

  return {
    gameWidth,
    shortLandscape: false,
    hasSeparateLogPanel: false,
    tileSize: 64,
    tileStep: 68,
    spriteScale: 2,
    gridOrigin: { x: 348, y: 88 },
    boardFrame,
    hudPanel,
    logArea: { x: 36, headingY: 402, bodyY: 427, width: 238 },
    boardHeading: { x: 320, y: 24 },
    turn: { x: 856, y: 24 },
    title: { x: 36, y: 35 },
    subtitle: { x: 37, y: 67 },
    buttons: {
      x: 154,
      width: 224,
      height: 54,
      actionYs: [146, 212, 278],
      resetY: 350,
      resetHeight: 42,
    },
  };
};
