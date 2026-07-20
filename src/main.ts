import Phaser from 'phaser';
import './style.css';
import { GAME_HEIGHT, logicalGameWidthForViewport } from './game/layout';
import { TacticalScene } from './scenes/TacticalScene';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app game mount.');

const getLogicalGameWidth = (): number => {
  const viewport = window.visualViewport;
  return logicalGameWidthForViewport(viewport?.width ?? app.clientWidth, viewport?.height ?? app.clientHeight);
};

const config: Phaser.Types.Core.GameConfig = {
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
};

const game = new Phaser.Game(config);
let resizeFrame: number | undefined;

const syncGameWidthToViewport = (): void => {
  if (resizeFrame !== undefined) window.cancelAnimationFrame(resizeFrame);
  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = undefined;
    const nextWidth = getLogicalGameWidth();
    if (game.scale.gameSize.width !== nextWidth) game.scale.setGameSize(nextWidth, GAME_HEIGHT);
  });
};

window.addEventListener('resize', syncGameWidthToViewport);
window.visualViewport?.addEventListener('resize', syncGameWidthToViewport);
