import Phaser from 'phaser';
import { allGridCoords, coordsEqual, type GridCoord } from '../game/grid';
import { legalMovesForPlayer, movePlayer, resetGame } from '../game/movement';
import { createInitialState, type GameState } from '../game/state';

const GAME_WIDTH = 960;
const GRID_ORIGIN = { x: 168, y: 72 };
const TILE_SIZE = 66;
const TILE_GAP = 4;

export class TacticalScene extends Phaser.Scene {
  private state: GameState = createInitialState();
  private selected = false;
  private tileLayer?: Phaser.GameObjects.Container;
  private turnText?: Phaser.GameObjects.Text;

  constructor() {
    super('tactical-scene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#111827');
    this.add
      .text(GAME_WIDTH / 2, 28, 'The Dark Kick: Tactical Prototype', {
        color: '#f8fafc',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '26px',
        fontStyle: '700',
      })
      .setOrigin(0.5);

    this.turnText = this.add.text(44, 86, '', {
      color: '#e5e7eb',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
    });

    this.addResetButton();
    this.renderBoard();
  }

  private addResetButton(): void {
    const button = this.add.rectangle(78, 154, 112, 48, 0x2563eb, 1).setStrokeStyle(2, 0x93c5fd);
    const label = this.add.text(78, 154, 'Reset', {
      color: '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      fontStyle: '700',
    }).setOrigin(0.5);

    button.setInteractive({ useHandCursor: true });
    button.on('pointerup', () => {
      this.state = resetGame();
      this.selected = false;
      this.renderBoard();
    });
    label.setInteractive({ useHandCursor: true });
    label.on('pointerup', () => button.emit('pointerup'));
  }

  private renderBoard(): void {
    this.tileLayer?.destroy(true);
    this.tileLayer = this.add.container(0, 0);
    this.turnText?.setText(`Turn ${this.state.turn}`);

    const legalMoves = this.selected ? legalMovesForPlayer(this.state) : [];

    for (const coord of allGridCoords()) {
      const position = this.gridToWorld(coord);
      const isPlayer = coordsEqual(coord, this.state.player);
      const isExit = coordsEqual(coord, this.state.exit);
      const isLegalDestination = legalMoves.some((move) => coordsEqual(move, coord));
      const fill = isLegalDestination ? 0x16a34a : isExit ? 0xf59e0b : 0x1f2937;
      const stroke = isLegalDestination ? 0xbbf7d0 : 0x64748b;

      const tile = this.add.rectangle(position.x, position.y, TILE_SIZE, TILE_SIZE, fill, 1).setStrokeStyle(3, stroke);
      tile.setInteractive({ useHandCursor: true });
      tile.on('pointerup', () => this.handleTileTap(coord));
      this.tileLayer.add(tile);

      if (isExit) {
        this.tileLayer.add(
          this.add.text(position.x, position.y, 'EXIT', {
            color: '#111827',
            fontFamily: 'system-ui, sans-serif',
            fontSize: '17px',
            fontStyle: '800',
          }).setOrigin(0.5),
        );
      }

      if (isPlayer) {
        const token = this.add.circle(position.x, position.y, 24, 0x38bdf8, 1).setStrokeStyle(this.selected ? 5 : 3, this.selected ? 0xf8fafc : 0x0f172a);
        token.setInteractive({ useHandCursor: true });
        token.on('pointerup', () => this.handleTileTap(coord));
        this.tileLayer.add(token);
      }
    }
  }

  private handleTileTap(coord: GridCoord): void {
    if (coordsEqual(coord, this.state.player)) {
      this.selected = !this.selected;
      this.renderBoard();
      return;
    }

    if (!this.selected) {
      return;
    }

    const nextState = movePlayer(this.state, coord);
    if (nextState !== this.state) {
      this.state = nextState;
      this.selected = false;
      this.renderBoard();
    }
  }

  private gridToWorld(coord: GridCoord): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      GRID_ORIGIN.x + coord.col * (TILE_SIZE + TILE_GAP),
      GRID_ORIGIN.y + coord.row * (TILE_SIZE + TILE_GAP),
    );
  }
}
