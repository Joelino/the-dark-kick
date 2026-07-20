import { describe, expect, it } from 'vitest';
import { createTacticalLayout, GAME_HEIGHT, logicalGameWidthForViewport, MAX_GAME_WIDTH, MIN_GAME_WIDTH } from './layout';

describe('responsive tactical layout', () => {
  it('keeps the original logical size for a 16:9 viewport', () => {
    expect(logicalGameWidthForViewport(1920, 1080)).toBe(MIN_GAME_WIDTH);
    expect(createTacticalLayout(MIN_GAME_WIDTH).shortLandscape).toBe(false);
  });

  it('uses a wider layout for a landscape iPhone with browser chrome', () => {
    const width = logicalGameWidthForViewport(2556, 860);
    const layout = createTacticalLayout(width);

    expect(width).toBe(MAX_GAME_WIDTH);
    expect(layout.shortLandscape).toBe(true);
    expect(layout.hasSeparateLogPanel).toBe(true);
    expect(layout.boardFrame.y + layout.boardFrame.height).toBeLessThanOrEqual(GAME_HEIGHT);
    expect(layout.boardFrame.x).toBeGreaterThan(layout.hudPanel.x + layout.hudPanel.width);
  });

  it('gives a standalone landscape viewport a larger board and uses the remaining width for feedback', () => {
    const width = logicalGameWidthForViewport(2556, 1179);
    const layout = createTacticalLayout(width);

    expect(width).toBe(1171);
    expect(layout.shortLandscape).toBe(true);
    expect(layout.hasSeparateLogPanel).toBe(true);
    expect(layout.tileSize).toBeGreaterThan(createTacticalLayout(MIN_GAME_WIDTH).tileSize);
  });

  it('falls back safely for missing viewport measurements', () => {
    expect(logicalGameWidthForViewport(0, 0)).toBe(MIN_GAME_WIDTH);
  });
});
