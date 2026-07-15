import Phaser from 'phaser';
import './style.css';
import { TacticalScene } from './scenes/TacticalScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#111827',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 540,
  },
  input: {
    activePointers: 2,
  },
  scene: [TacticalScene],
};

new Phaser.Game(config);
