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
const GRID_ORIGIN = { x: 348, y: 88 };
const TILE_SIZE = 64;
const TILE_STEP = 68;
const PLAYER_FRAME = 8;
const ENEMY_FRAME = 0;
const FLOOR_FRAMES = [103, 104, 105] as const;
const WALL_FRAME = 34;
const EXIT_FRAME = 280;
const SPIKES_FRAME = 288;
const BLOOD_FRAMES = [374, 375] as const;

const ROGUES_URL = new URL('../../assets/raw/32rogues/32rogues/rogues.png', import.meta.url).href;
const MONSTERS_URL = new URL('../../assets/raw/32rogues/32rogues/monsters.png', import.meta.url).href;
const TILES_URL = new URL('../../assets/raw/32rogues/32rogues/tiles.png', import.meta.url).href;

export class TacticalScene extends Phaser.Scene {
  private state: GameState = createInitialState();
  private selectedAction: Action = 'move';
  private tileLayer?: Phaser.GameObjects.Container;
  private hudLayer?: Phaser.GameObjects.Container;
  private effectsLayer?: Phaser.GameObjects.Container;
  private turnText?: Phaser.GameObjects.Text;
  private feedback?: Phaser.GameObjects.Text;
  private playerSprite?: Phaser.GameObjects.Sprite;
  private readonly enemySprites = new Map<string, Phaser.GameObjects.Sprite>();
  private inputLocked = false;

  constructor() {
    super('tactical-scene');
  }

  preload(): void {
    this.load.spritesheet('rogues', ROGUES_URL, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('monsters', MONSTERS_URL, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('dungeon-tiles', TILES_URL, { frameWidth: 32, frameHeight: 32 });
  }

  create(): void {
    for (const texture of ['rogues', 'monsters', 'dungeon-tiles']) {
      this.textures.get(texture).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    this.cameras.main.setBackgroundColor('#120d13');
    this.addBackground();
    this.effectsLayer = this.add.container(0, 0).setDepth(30);
    this.turnText = this.add.text(856, 24, '', smallCapsStyle(16, '#d7bd87')).setOrigin(1, 0.5).setDepth(22);
    this.feedback = this.add
      .text(36, 427, 'Choose a path. Make the room your weapon.', bodyStyle(15, '#c8bda8'))
      .setWordWrapWidth(238)
      .setDepth(22);
    this.addHud();
    this.renderBoard();
  }

  private addBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x1c1319, 0x1c1319, 0x09070a, 0x09070a, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    graphics.fillStyle(0x0b090c, 0.9);
    graphics.fillRoundedRect(20, 18, 268, 504, 12);
    graphics.lineStyle(2, 0x544233, 1);
    graphics.strokeRoundedRect(20, 18, 268, 504, 12);

    graphics.fillStyle(0x080709, 0.88);
    graphics.fillRoundedRect(304, 44, 568, 428, 10);
    graphics.lineStyle(3, 0x3d3029, 1);
    graphics.strokeRoundedRect(304, 44, 568, 428, 10);

    this.add.text(36, 35, 'THE DARK KICK', smallCapsStyle(23, '#f0d69b')).setDepth(22);
    this.add.text(37, 67, 'A ROOM IS A WEAPON', smallCapsStyle(11, '#8f7b64')).setDepth(22);
    this.add.text(37, 402, 'COMBAT LOG', smallCapsStyle(11, '#8f7b64')).setDepth(22);
    this.add.text(320, 24, 'THE FIRST CELLAR', smallCapsStyle(10, '#786959')).setOrigin(0, 0.5).setDepth(22);
  }

  private addHud(): void {
    this.hudLayer?.destroy(true);
    this.hudLayer = this.add.container(0, 0).setDepth(20);

    this.addButton(154, 146, 224, 54, 'MOVE', 'Step to an adjacent tile', 'move', () => this.selectAction('move'));
    this.addButton(154, 212, 224, 54, 'STRIKE', '1 damage · adjacent', 'strike', () => this.selectAction('strike'));
    this.addButton(154, 278, 224, 54, 'KICK', 'Push · collision damage', 'kick', () => this.selectAction('kick'));
    this.addButton(154, 350, 224, 42, 'RESET RUN', '', undefined, () => this.reset());
  }

  private addButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    detail: string,
    action: Action | undefined,
    onTap: () => void,
  ): void {
    const active = action === this.selectedAction;
    const button = this.add
      .rectangle(x, y, width, height, active ? 0x5d3c20 : 0x21191c, 1)
      .setStrokeStyle(active ? 3 : 2, active ? 0xe6b85c : 0x57454a);
    const labelY = detail ? y - 9 : y;
    const text = this.add.text(x - width / 2 + 17, labelY, label, smallCapsStyle(17, active ? '#ffe0a1' : '#e4d9ca')).setOrigin(0, 0.5);
    const detailText = detail
      ? this.add.text(x - width / 2 + 17, y + 13, detail, bodyStyle(11, active ? '#dcb875' : '#8f8580')).setOrigin(0, 0.5)
      : undefined;
    const pip = action ? this.add.circle(x + width / 2 - 18, y, 5, active ? 0xffcc66 : 0x5c4d4f, 1) : undefined;

    const objects: Phaser.GameObjects.GameObject[] = [button, text];
    if (detailText) objects.push(detailText);
    if (pip) objects.push(pip);
    for (const object of objects) {
      object.setInteractive({ useHandCursor: true });
      object.on('pointerup', onTap);
      object.on('pointerover', () => button.setFillStyle(active ? 0x6a4728 : 0x302226));
      object.on('pointerout', () => button.setFillStyle(active ? 0x5d3c20 : 0x21191c));
      this.hudLayer?.add(object);
    }
  }

  private selectAction(action: Action): void {
    if (this.state.won || this.inputLocked) return;
    this.selectedAction = action;
    this.addHud();
    this.renderBoard();
    this.feedback?.setText(action === 'move' ? 'Green tiles are safe steps.' : action === 'strike' ? 'Strike an adjacent enemy.' : 'Kick toward walls, spikes, or trouble.');
  }

  private reset(): void {
    if (this.inputLocked) return;
    this.state = resetGame();
    this.selectedAction = 'move';
    this.feedback?.setText('A fresh room. Try kicking the orc onto the spikes.');
    this.addHud();
    this.renderBoard();
  }

  private renderBoard(): void {
    this.tileLayer?.destroy(true);
    this.tileLayer = this.add.container(0, 0).setDepth(10);
    this.enemySprites.clear();
    this.playerSprite = undefined;
    this.turnText?.setText(`TURN ${this.state.turn}`);

    const legalTargets = legalTargetsForAction(this.state, this.selectedAction);

    for (const coord of allGridCoords()) {
      const position = this.gridToWorld(coord);
      const terrain = terrainAt(this.state, coord);
      const floorFrame = FLOOR_FRAMES[(coord.col * 5 + coord.row * 3) % FLOOR_FRAMES.length];
      const backing = this.add.rectangle(position.x, position.y, TILE_SIZE, TILE_SIZE, 0x18151a, 1).setStrokeStyle(1, 0x332a2f);
      const floor = this.add.sprite(position.x, position.y, 'dungeon-tiles', floorFrame).setScale(2);
      this.tileLayer.add([backing, floor]);

      if (terrain === 'wall') {
        backing.setFillStyle(0x242027);
        this.tileLayer.add(this.add.sprite(position.x, position.y, 'dungeon-tiles', WALL_FRAME).setScale(2));
      }
      if (terrain === 'exit') {
        this.tileLayer.add(this.add.sprite(position.x, position.y, 'dungeon-tiles', EXIT_FRAME).setScale(2));
        this.tileLayer.add(this.add.text(position.x, position.y + 25, 'ESCAPE', smallCapsStyle(9, '#f4d183')).setOrigin(0.5));
      }
      if (terrain === 'spikes') {
        this.tileLayer.add(this.add.sprite(position.x, position.y, 'dungeon-tiles', SPIKES_FRAME).setScale(2));
      }

      const hitArea = this.add.rectangle(position.x, position.y, TILE_SIZE, TILE_SIZE, 0xffffff, 0.001);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on('pointerup', () => {
        void this.handleTileTap(coord);
      });
      this.tileLayer.add(hitArea);

      const legal = legalTargets.some((target) => coordsEqual(target, coord));
      if (legal) {
        const highlight = this.add.rectangle(position.x, position.y, TILE_SIZE - 4, TILE_SIZE - 4, 0x6fbd62, 0.16).setStrokeStyle(3, 0xa9e68f, 0.9);
        this.tileLayer.add(highlight);
        this.tweens.add({ targets: highlight, alpha: { from: 0.35, to: 0.65 }, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }
    }

    for (const corpse of this.state.corpses) this.addCorpse(corpse.position, corpse.enemyId);
    for (const enemy of this.state.enemies) this.addEnemy(enemy.id, enemy.position, enemy.hp);
    this.addPlayer(this.state.player);

    if (this.state.won) this.showVictoryPanel();
  }

  private addCorpse(position: GridCoord, enemyId: string): void {
    const world = this.gridToWorld(position);
    const bloodFrame = BLOOD_FRAMES[this.hash(enemyId) % BLOOD_FRAMES.length];
    const blood = this.add.sprite(world.x, world.y + 7, 'dungeon-tiles', bloodFrame).setScale(2).setAlpha(0.8);
    const corpse = this.add
      .sprite(world.x + 2, world.y + 8, 'monsters', ENEMY_FRAME)
      .setScale(1.6, 0.72)
      .setAngle(88)
      .setTint(0x62545b)
      .setAlpha(0.86);
    this.tileLayer?.add([blood, corpse]);
  }

  private addEnemy(id: string, position: GridCoord, hp: number): void {
    const world = this.gridToWorld(position);
    const shadow = this.add.ellipse(world.x, world.y + 22, 40, 13, 0x050405, 0.7);
    const sprite = this.add.sprite(world.x, world.y - 2, 'monsters', ENEMY_FRAME).setScale(2);
    const hpBack = this.add.rectangle(world.x, world.y - 29, 46, 7, 0x150e11, 0.95).setStrokeStyle(1, 0x5f3f43);
    const hpFill = this.add.rectangle(world.x - 22, world.y - 29, (44 * hp) / 4, 5, 0xb5413f, 1).setOrigin(0, 0.5);
    const hitArea = this.add.rectangle(world.x, world.y, TILE_SIZE, TILE_SIZE, 0xffffff, 0.001);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on('pointerup', () => {
      void this.handleTileTap(position);
    });
    this.enemySprites.set(id, sprite);
    this.tileLayer?.add([shadow, sprite, hpBack, hpFill, hitArea]);
  }

  private addPlayer(position: GridCoord): void {
    const world = this.gridToWorld(position);
    const shadow = this.add.ellipse(world.x, world.y + 22, 38, 12, 0x050405, 0.72);
    const ring = this.add.circle(world.x, world.y + 3, 27, 0x9ac7bc, 0.08).setStrokeStyle(2, 0x9ac7bc, 0.55);
    this.playerSprite = this.add.sprite(world.x, world.y - 2, 'rogues', PLAYER_FRAME).setScale(2);
    this.tileLayer?.add([shadow, ring, this.playerSprite]);
  }

  private async handleTileTap(coord: GridCoord): Promise<void> {
    if (this.state.won || this.inputLocked) return;

    const before = this.state;
    const action = this.selectedAction;
    let result: ActionResult | undefined;
    let nextState = before;

    if (action === 'move') nextState = movePlayer(before, coord);
    if (action === 'strike') result = basicStrike(before, coord);
    if (action === 'kick') result = kick(before, coord);
    if (result) nextState = result.state;
    if (nextState === before) return;

    this.inputLocked = true;
    if (action === 'move') {
      this.feedback?.setText(nextState.won ? 'The way out is open.' : 'Boots scrape across old stone.');
      await this.animateMove(before.player, coord);
    } else if (result) {
      this.feedback?.setText(
        result.killed
          ? 'Down. The body stays where it fell.'
          : result.pushedTo
            ? `Kick lands for ${result.damageAmount}. The orc is hurled back.`
            : action === 'kick'
              ? `CRUNCH. ${result.damageAmount} damage.`
              : `Steel bites for ${result.damageAmount} damage.`,
      );
      await this.animateAttack(action, before, coord, result);
    }

    this.state = nextState;
    this.selectedAction = 'move';
    this.addHud();
    this.renderBoard();
    this.inputLocked = false;
  }

  private async animateMove(from: GridCoord, to: GridCoord): Promise<void> {
    if (!this.playerSprite) return;
    const sprite = this.playerSprite;
    const start = this.gridToWorld(from);
    const end = this.gridToWorld(to);
    sprite.setFlipX(to.col < from.col);

    await this.tween({
      targets: sprite,
      x: Phaser.Math.Linear(start.x, end.x, 0.52),
      y: Phaser.Math.Linear(start.y, end.y, 0.52) - 10,
      scaleX: 1.82,
      scaleY: 2.18,
      duration: 80,
      ease: 'Quad.Out',
    });
    await this.tween({ targets: sprite, x: end.x, y: end.y - 2, scaleX: 2.12, scaleY: 1.88, duration: 92, ease: 'Quad.In' });
    await this.tween({ targets: sprite, scaleX: 2, scaleY: 2, duration: 55, ease: 'Back.Out' });
    this.spawnDust(end.x, end.y + 23);
  }

  private async animateAttack(action: Exclude<Action, 'move'>, before: GameState, target: GridCoord, result: ActionResult): Promise<void> {
    const player = this.playerSprite;
    const enemy = before.enemies.find((candidate) => coordsEqual(candidate.position, target));
    const enemySprite = enemy ? this.enemySprites.get(enemy.id) : undefined;
    if (!player || !enemy || !enemySprite) return;

    const start = this.gridToWorld(before.player);
    const targetWorld = this.gridToWorld(target);
    const dx = targetWorld.x - start.x;
    const dy = targetWorld.y - start.y;
    const reach = action === 'kick' ? 0.58 : 0.42;
    player.setFlipX(dx < 0);

    await this.tween({
      targets: player,
      x: start.x - dx * 0.09,
      y: start.y - dy * 0.09 - 3,
      angle: action === 'kick' ? -8 * Math.sign(dx || -dy) : -4 * Math.sign(dx || -dy),
      scaleX: 1.88,
      scaleY: 2.12,
      duration: action === 'kick' ? 105 : 75,
      ease: 'Quad.Out',
    });
    await this.tween({
      targets: player,
      x: start.x + dx * reach,
      y: start.y + dy * reach - 2,
      angle: action === 'kick' ? 13 * Math.sign(dx || -dy) : 8 * Math.sign(dx || -dy),
      scaleX: action === 'kick' ? 2.3 : 2.16,
      scaleY: action === 'kick' ? 1.7 : 1.88,
      duration: action === 'kick' ? 90 : 72,
      ease: 'Cubic.In',
    });

    this.spawnSlash(targetWorld, action);
    this.cameras.main.shake(action === 'kick' ? 105 : 72, action === 'kick' ? 0.004 : 0.0025);

    const impact = this.gridToWorld(result.pushedTo ?? target);
    if (result.pushedTo) {
      this.spawnDust(targetWorld.x, targetWorld.y + 22);
      await this.tween({
        targets: enemySprite,
        x: impact.x,
        y: impact.y - 5,
        angle: 12 * Math.sign(dx || -dy),
        scaleX: 2.25,
        scaleY: 1.72,
        duration: 150,
        ease: 'Back.Out',
      });
    }

    await this.animateHit(enemySprite, impact, result.damageAmount, result.killed !== undefined);
    await this.tween({ targets: player, x: start.x, y: start.y - 2, angle: 0, scaleX: 2, scaleY: 2, duration: 130, ease: 'Back.Out' });
  }

  private async animateHit(sprite: Phaser.GameObjects.Sprite, position: Phaser.Math.Vector2, damage: number, killed: boolean): Promise<void> {
    sprite.setTintFill(0xfff0cf);
    const damageText = this.add.text(position.x, position.y - 24, `-${damage}`, smallCapsStyle(20, '#ffce78')).setOrigin(0.5);
    this.effectsLayer?.add(damageText);
    void this.tween({ targets: damageText, y: position.y - 67, alpha: 0, duration: 500, ease: 'Cubic.Out', onComplete: () => damageText.destroy() });

    const ring = this.add.circle(position.x, position.y, 10, 0xf6c365, 0.05).setStrokeStyle(5, 0xf6c365, 0.95);
    this.effectsLayer?.add(ring);
    void this.tween({ targets: ring, scale: 3.2, alpha: 0, duration: 230, ease: 'Quad.Out', onComplete: () => ring.destroy() });

    await this.tween({ targets: sprite, scaleX: 2.42, scaleY: 1.48, duration: 55, yoyo: true, ease: 'Quad.Out' });
    sprite.clearTint();

    if (killed) {
      this.spawnBlood(position);
      await this.tween({
        targets: sprite,
        y: position.y + 12,
        angle: sprite.flipX ? -88 : 88,
        scaleX: 1.55,
        scaleY: 0.72,
        alpha: 0.32,
        duration: 250,
        ease: 'Cubic.In',
      });
    } else {
      await this.tween({ targets: sprite, x: position.x + 5, duration: 28, yoyo: true, repeat: 2, ease: 'Sine.InOut' });
    }
  }

  private spawnSlash(position: Phaser.Math.Vector2, action: Exclude<Action, 'move'>): void {
    const color = action === 'kick' ? 0xffb84d : 0xffedbd;
    const slash = this.add.rectangle(position.x, position.y, action === 'kick' ? 8 : 5, action === 'kick' ? 54 : 62, color, 0.95).setAngle(action === 'kick' ? 72 : 42);
    const echo = this.add.rectangle(position.x, position.y, 3, 44, 0xffffff, 0.78).setAngle(action === 'kick' ? 62 : -38);
    this.effectsLayer?.add([slash, echo]);
    void this.tween({ targets: [slash, echo], scaleY: 1.45, alpha: 0, duration: 170, ease: 'Quad.Out', onComplete: () => [slash, echo].forEach((object) => object.destroy()) });
  }

  private spawnDust(x: number, y: number): void {
    for (let index = 0; index < 4; index += 1) {
      const mote = this.add.circle(x + (index - 1.5) * 8, y, 3 + (index % 2), 0x8b7867, 0.65);
      this.effectsLayer?.add(mote);
      void this.tween({
        targets: mote,
        x: mote.x + (index - 1.5) * 6,
        y: mote.y - 9 - (index % 2) * 4,
        scale: 0.25,
        alpha: 0,
        duration: 260,
        ease: 'Quad.Out',
        onComplete: () => mote.destroy(),
      });
    }
  }

  private spawnBlood(position: Phaser.Math.Vector2): void {
    for (let index = 0; index < 7; index += 1) {
      const angle = Phaser.Math.DegToRad(-150 + index * 50);
      const drop = this.add.circle(position.x, position.y, index % 2 === 0 ? 3 : 2, 0x9e3039, 0.95);
      this.effectsLayer?.add(drop);
      void this.tween({
        targets: drop,
        x: position.x + Math.cos(angle) * (24 + index * 2),
        y: position.y + Math.sin(angle) * (18 + index),
        alpha: 0,
        duration: 330,
        ease: 'Quad.Out',
        onComplete: () => drop.destroy(),
      });
    }
  }

  private showVictoryPanel(): void {
    const shade = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x070507, 0.72);
    const panel = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 382, 220, 0x171116, 0.98).setStrokeStyle(3, 0xd2a855);
    const title = this.add.text(GAME_WIDTH / 2, 218, 'CELLAR CLEARED', smallCapsStyle(27, '#f3d28e')).setOrigin(0.5);
    const turns = this.add.text(GAME_WIDTH / 2, 263, `${this.state.turn - 1} turns · the dark waits below`, bodyStyle(15, '#b7a896')).setOrigin(0.5);
    const button = this.add.rectangle(GAME_WIDTH / 2, 325, 184, 48, 0x5d3c20, 1).setStrokeStyle(3, 0xe6b85c);
    const label = this.add.text(GAME_WIDTH / 2, 325, 'DESCEND AGAIN', smallCapsStyle(15, '#ffe0a1')).setOrigin(0.5);
    for (const object of [button, label]) {
      object.setInteractive({ useHandCursor: true });
      object.on('pointerup', () => this.reset());
    }
    this.tileLayer?.add([shade, panel, title, turns, button, label]);
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      const suppliedOnComplete = config.onComplete;
      this.tweens.add({
        ...config,
        onComplete: (tween, targets) => {
          suppliedOnComplete?.(tween, targets);
          resolve();
        },
      });
    });
  }

  private gridToWorld(coord: GridCoord): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(GRID_ORIGIN.x + coord.col * TILE_STEP, GRID_ORIGIN.y + coord.row * TILE_STEP);
  }

  private hash(value: string): number {
    return [...value].reduce((total, character) => total + character.charCodeAt(0), 0);
  }
}

const smallCapsStyle = (fontSize: number, color: string): Phaser.Types.GameObjects.Text.TextStyle => ({
  color,
  fontFamily: '"Courier New", monospace',
  fontSize: `${fontSize}px`,
  fontStyle: 'bold',
  letterSpacing: 1.5,
});

const bodyStyle = (fontSize: number, color: string): Phaser.Types.GameObjects.Text.TextStyle => ({
  color,
  fontFamily: 'Georgia, serif',
  fontSize: `${fontSize}px`,
  lineSpacing: 5,
});
