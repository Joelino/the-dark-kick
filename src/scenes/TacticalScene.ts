import Phaser from 'phaser';
import { allGridCoords, coordsEqual, type GridCoord } from '../game/grid';
import {
  basicStrike,
  kick,
  legalTargetsForAction,
  movePlayer,
  resetGame,
  terrainAt,
  type Action,
  type ActionResult,
} from '../game/movement';
import { createInitialState, type GameState } from '../game/state';

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const GRID_ORIGIN = { x: 246, y: 62 };
const TILE_SIZE = 68;
const TILE_GAP = 4;

export class TacticalScene extends Phaser.Scene {
  private state: GameState = createInitialState();
  private selectedAction: Action = 'move';
  private tileLayer?: Phaser.GameObjects.Container;
  private hudLayer?: Phaser.GameObjects.Container;
  private turnText?: Phaser.GameObjects.Text;
  private feedback?: Phaser.GameObjects.Text;

  constructor() {
    super('tactical-scene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#111827');
    this.add.text(GAME_WIDTH / 2, 24, 'The Dark Kick', titleStyle(24, '800')).setOrigin(0.5);
    this.turnText = this.add.text(42, 78, '', titleStyle(20, '700'));
    this.feedback = this.add.text(42, 386, 'Tap an action, then a highlighted tile.', titleStyle(15, '600'));
    this.addHud();
    this.renderBoard();
  }

  private addHud(): void {
    this.hudLayer?.destroy(true);
    this.hudLayer = this.add.container(0, 0);

    this.addButton(96, 132, 116, 46, 'Move', () => this.selectAction('move'));
    this.addButton(96, 190, 116, 46, 'Strike', () => this.selectAction('strike'));
    this.addButton(96, 248, 116, 46, 'Kick', () => this.selectAction('kick'));
    this.addButton(96, 324, 116, 46, 'Reset', () => this.reset());
  }

  private addButton(x: number, y: number, width: number, height: number, label: string, onTap: () => void): void {
    const active = label.toLowerCase() === this.selectedAction;
    const button = this.add.rectangle(x, y, width, height, active ? 0x16a34a : 0x2563eb, 1).setStrokeStyle(2, active ? 0xbbf7d0 : 0x93c5fd);
    const text = this.add.text(x, y, label, titleStyle(18, '800')).setOrigin(0.5);
    for (const object of [button, text]) {
      object.setInteractive({ useHandCursor: true });
      object.on('pointerup', onTap);
      this.hudLayer?.add(object);
    }
  }

  private selectAction(action: Action): void {
    if (this.state.won) return;
    this.selectedAction = action;
    this.addHud();
    this.renderBoard();
  }

  private reset(): void {
    this.state = resetGame();
    this.selectedAction = 'move';
    this.feedback?.setText('Reset. Tap a highlighted tile to move.');
    this.addHud();
    this.renderBoard();
  }

  private renderBoard(result?: ActionResult): void {
    this.tileLayer?.destroy(true);
    this.tileLayer = this.add.container(0, 0);
    this.turnText?.setText(`Turn ${this.state.turn}`);

    const legalTargets = legalTargetsForAction(this.state, this.selectedAction);

    for (const coord of allGridCoords()) {
      const position = this.gridToWorld(coord);
      const terrain = terrainAt(this.state, coord);
      const isPlayer = coordsEqual(coord, this.state.player);
      const enemy = this.state.enemies.find((candidate) => coordsEqual(candidate.position, coord));
      const legal = legalTargets.some((target) => coordsEqual(target, coord));
      const damaged = result?.damage.some((target) => coordsEqual(target, coord));
      const fill = legal ? 0x16a34a : terrain === 'exit' ? 0xf59e0b : terrain === 'spikes' ? 0x7f1d1d : terrain === 'wall' ? 0x020617 : 0x1f2937;
      const tile = this.add.rectangle(position.x, position.y, TILE_SIZE, TILE_SIZE, fill, 1).setStrokeStyle(legal ? 4 : 3, legal ? 0xbbf7d0 : 0x64748b);
      tile.setInteractive({ useHandCursor: true });
      tile.on('pointerup', () => this.handleTileTap(coord));
      this.tileLayer.add(tile);

      if (terrain === 'exit') this.addTileText(position, 'EXIT', '#111827');
      if (terrain === 'spikes') this.addTileText(position, '▲▲', '#fecaca');
      if (terrain === 'wall') this.addTileText(position, 'WALL', '#cbd5e1');
      if (enemy) {
        const token = this.add.circle(position.x, position.y - 4, 24, damaged ? 0xf97316 : 0xef4444, 1).setStrokeStyle(3, 0x7f1d1d);
        const hp = this.add.text(position.x, position.y + 22, `${enemy.hp} HP`, titleStyle(14, '800')).setOrigin(0.5);
        token.setInteractive({ useHandCursor: true });
        token.on('pointerup', () => this.handleTileTap(coord));
        this.tileLayer.add([token, hp]);
      }
      if (isPlayer) {
        this.tileLayer.add(this.add.circle(position.x, position.y, 22, 0x38bdf8, 1).setStrokeStyle(4, 0xf8fafc));
      }
    }

    if (this.state.won) this.showVictoryPanel();
  }

  private addTileText(position: Phaser.Math.Vector2, label: string, color: string): void {
    this.tileLayer?.add(this.add.text(position.x, position.y, label, { ...titleStyle(15, '900'), color }).setOrigin(0.5));
  }

  private handleTileTap(coord: GridCoord): void {
    if (this.state.won) return;

    let result: ActionResult | undefined;
    const before = this.state;
    if (this.selectedAction === 'move') this.state = movePlayer(this.state, coord);
    if (this.selectedAction === 'strike') result = basicStrike(this.state, coord);
    if (this.selectedAction === 'kick') result = kick(this.state, coord);
    if (result) this.state = result.state;
    if (this.state === before) return;

    this.feedback?.setText(result?.pushedTo ? 'Kick landed: pushed!' : result ? 'Damage dealt.' : this.state.won ? 'Exit reached!' : 'Moved.');
    this.selectedAction = 'move';
    this.addHud();
    this.renderBoard(result);
  }

  private showVictoryPanel(): void {
    const panel = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 360, 210, 0x0f172a, 0.96).setStrokeStyle(4, 0xf59e0b);
    const title = this.add.text(GAME_WIDTH / 2, 226, 'Level Complete', titleStyle(30, '900')).setOrigin(0.5);
    const turns = this.add.text(GAME_WIDTH / 2, 270, `Turns used: ${this.state.turn - 1}`, titleStyle(20, '700')).setOrigin(0.5);
    const button = this.add.rectangle(GAME_WIDTH / 2, 326, 160, 50, 0x16a34a, 1).setStrokeStyle(3, 0xbbf7d0);
    const label = this.add.text(GAME_WIDTH / 2, 326, 'Play Again', titleStyle(20, '900')).setOrigin(0.5);
    for (const object of [button, label]) {
      object.setInteractive({ useHandCursor: true });
      object.on('pointerup', () => this.reset());
      this.tileLayer?.add(object);
    }
    this.tileLayer?.add([panel, title, turns]);
  }

  private gridToWorld(coord: GridCoord): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(GRID_ORIGIN.x + coord.col * (TILE_SIZE + TILE_GAP), GRID_ORIGIN.y + coord.row * (TILE_SIZE + TILE_GAP));
  }
}

const titleStyle = (fontSize: number, fontStyle: string): Phaser.Types.GameObjects.Text.TextStyle => ({
  color: '#f8fafc',
  fontFamily: 'system-ui, sans-serif',
  fontSize: `${fontSize}px`,
  fontStyle,
});
