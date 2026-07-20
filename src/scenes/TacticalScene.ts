import Phaser from 'phaser';
import { allGridCoords, coordsEqual, type GridCoord } from '../game/grid';
import { createTacticalLayout, GAME_HEIGHT, MIN_GAME_WIDTH, type TacticalLayout } from '../game/layout';
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
  private layout: TacticalLayout = createTacticalLayout(MIN_GAME_WIDTH);
  private selectedAction: Action = 'move';
  private tileLayer?: Phaser.GameObjects.Container;
  private hudLayer?: Phaser.GameObjects.Container;
  private effectsLayer?: Phaser.GameObjects.Container;
  private turnText?: Phaser.GameObjects.Text;
  private feedback?: Phaser.GameObjects.Text;
  private playerSprite?: Phaser.GameObjects.Sprite;
  private highlightTween?: Phaser.Tweens.Tween;
  private readonly enemySprites = new Map<string, Phaser.GameObjects.Sprite>();
  private inputLocked = false;
  private pendingLayoutWidth?: number;
  private feedbackMessage = 'Choose a path. Make the room your weapon.';

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
    this.layout = createTacticalLayout(this.scale.gameSize.width);
    this.buildDisplay();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this));
  }

  private buildDisplay(): void {
    this.addBackground();
    this.effectsLayer = this.add.container(0, 0).setDepth(30);
    this.turnText = this.add
      .text(this.layout.turn.x, this.layout.turn.y, '', smallCapsStyle(this.layout.shortLandscape ? 18 : 16, '#d7bd87'))
      .setOrigin(1, 0.5)
      .setDepth(22);
    this.feedback = this.add
      .text(this.layout.logArea.x, this.layout.logArea.bodyY, this.feedbackMessage, bodyStyle(this.layout.shortLandscape ? 17 : 15, '#c8bda8'))
      .setWordWrapWidth(this.layout.logArea.width)
      .setDepth(22);
    this.addHud();
    this.renderBoard();
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    const nextWidth = Math.round(gameSize.width);
    if (nextWidth === this.layout.gameWidth) return;
    if (this.inputLocked) {
      this.pendingLayoutWidth = nextWidth;
      return;
    }
    this.rebuildDisplay(nextWidth);
  }

  private rebuildDisplay(gameWidth: number): void {
    this.highlightTween?.stop();
    this.highlightTween = undefined;
    this.children.removeAll(true);
    this.tileLayer = undefined;
    this.hudLayer = undefined;
    this.effectsLayer = undefined;
    this.turnText = undefined;
    this.feedback = undefined;
    this.playerSprite = undefined;
    this.enemySprites.clear();
    this.layout = createTacticalLayout(gameWidth);
    this.buildDisplay();
  }

  private flushPendingLayout(): void {
    if (this.pendingLayoutWidth === undefined) return;
    const nextWidth = this.pendingLayoutWidth;
    this.pendingLayoutWidth = undefined;
    if (nextWidth !== this.layout.gameWidth) this.rebuildDisplay(nextWidth);
  }

  private setFeedback(message: string): void {
    this.feedbackMessage = message;
    this.feedback?.setText(message);
  }

  private addBackground(): void {
    const { boardFrame, gameWidth, hudPanel, logArea, logPanel } = this.layout;
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x1c1319, 0x1c1319, 0x09070a, 0x09070a, 1);
    graphics.fillRect(0, 0, gameWidth, GAME_HEIGHT);

    graphics.fillStyle(0x0b090c, 0.9);
    graphics.fillRoundedRect(hudPanel.x, hudPanel.y, hudPanel.width, hudPanel.height, 12);
    graphics.lineStyle(2, 0x544233, 1);
    graphics.strokeRoundedRect(hudPanel.x, hudPanel.y, hudPanel.width, hudPanel.height, 12);

    if (logPanel) {
      graphics.fillStyle(0x0b090c, 0.9);
      graphics.fillRoundedRect(logPanel.x, logPanel.y, logPanel.width, logPanel.height, 12);
      graphics.lineStyle(2, 0x544233, 1);
      graphics.strokeRoundedRect(logPanel.x, logPanel.y, logPanel.width, logPanel.height, 12);
    }

    graphics.fillStyle(0x080709, 0.88);
    graphics.fillRoundedRect(boardFrame.x, boardFrame.y, boardFrame.width, boardFrame.height, 10);
    graphics.lineStyle(3, 0x3d3029, 1);
    graphics.strokeRoundedRect(boardFrame.x, boardFrame.y, boardFrame.width, boardFrame.height, 10);

    this.add.text(this.layout.title.x, this.layout.title.y, 'THE DARK KICK', smallCapsStyle(this.layout.shortLandscape ? 25 : 23, '#f0d69b')).setDepth(22);
    this.add.text(this.layout.subtitle.x, this.layout.subtitle.y, 'A ROOM IS A WEAPON', smallCapsStyle(this.layout.shortLandscape ? 12 : 11, '#8f7b64')).setDepth(22);
    this.add.text(logArea.x, logArea.headingY, 'COMBAT LOG', smallCapsStyle(this.layout.shortLandscape ? 12 : 11, '#8f7b64')).setDepth(22);
    this.add
      .text(this.layout.boardHeading.x, this.layout.boardHeading.y, 'THE FIRST CELLAR', smallCapsStyle(this.layout.shortLandscape ? 12 : 10, '#786959'))
      .setOrigin(0, 0.5)
      .setDepth(22);
  }

  private addHud(): void {
    this.hudLayer?.destroy(true);
    this.hudLayer = this.add.container(0, 0).setDepth(20);

    const { actionYs, height, resetHeight, resetY, width, x } = this.layout.buttons;
    this.addButton(x, actionYs[0], width, height, 'MOVE', 'Step to an adjacent tile', 'move', () => this.selectAction('move'));
    this.addButton(x, actionYs[1], width, height, 'STRIKE', '1 damage · adjacent', 'strike', () => this.selectAction('strike'));
    this.addButton(x, actionYs[2], width, height, 'KICK', 'Push · collision damage', 'kick', () => this.selectAction('kick'));
    this.addButton(x, resetY, width, resetHeight, 'RESET RUN', '', undefined, () => this.reset());
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
    const text = this.add
      .text(x - width / 2 + 17, labelY, label, smallCapsStyle(this.layout.shortLandscape ? 19 : 17, active ? '#ffe0a1' : '#e4d9ca'))
      .setOrigin(0, 0.5);
    const detailText = detail
      ? this.add.text(x - width / 2 + 17, y + 13, detail, bodyStyle(this.layout.shortLandscape ? 13 : 11, active ? '#dcb875' : '#8f8580')).setOrigin(0, 0.5)
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
    this.setFeedback(action === 'move' ? 'Green tiles are safe steps.' : action === 'strike' ? 'Strike an adjacent enemy.' : 'Kick toward walls, spikes, or trouble.');
  }

  private reset(): void {
    if (this.inputLocked) return;
    this.state = resetGame();
    this.selectedAction = 'move';
    this.setFeedback('A fresh room. Try kicking the orc onto the spikes.');
    this.addHud();
    this.renderBoard();
  }

  private renderBoard(): void {
    this.highlightTween?.stop();
    this.highlightTween = undefined;
    this.tileLayer?.destroy(true);
    this.tileLayer = this.add.container(0, 0).setDepth(10);
    this.enemySprites.clear();
    this.playerSprite = undefined;
    this.turnText?.setText(`TURN ${this.state.turn}`);
    const { spriteScale, tileSize } = this.layout;

    const legalTargets = legalTargetsForAction(this.state, this.selectedAction);
    const highlights: Phaser.GameObjects.Rectangle[] = [];

    for (const coord of allGridCoords()) {
      const position = this.gridToWorld(coord);
      const terrain = terrainAt(this.state, coord);
      const floorFrame = FLOOR_FRAMES[(coord.col * 5 + coord.row * 3) % FLOOR_FRAMES.length];
      const backing = this.add.rectangle(position.x, position.y, tileSize, tileSize, 0x18151a, 1).setStrokeStyle(1, 0x332a2f);
      const floor = this.add.sprite(position.x, position.y, 'dungeon-tiles', floorFrame).setScale(spriteScale);
      this.tileLayer.add([backing, floor]);

      if (terrain === 'wall') {
        backing.setFillStyle(0x242027);
        this.tileLayer.add(this.add.sprite(position.x, position.y, 'dungeon-tiles', WALL_FRAME).setScale(spriteScale));
      }
      if (terrain === 'exit') {
        this.tileLayer.add(this.add.sprite(position.x, position.y, 'dungeon-tiles', EXIT_FRAME).setScale(spriteScale));
        this.tileLayer.add(this.add.text(position.x, position.y + tileSize * 0.39, 'ESCAPE', smallCapsStyle(this.layout.shortLandscape ? 10 : 9, '#f4d183')).setOrigin(0.5));
      }
      if (terrain === 'spikes') {
        this.tileLayer.add(this.add.sprite(position.x, position.y, 'dungeon-tiles', SPIKES_FRAME).setScale(spriteScale));
      }

      const hitArea = this.add.rectangle(position.x, position.y, tileSize, tileSize, 0xffffff, 0.001);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on('pointerup', () => {
        void this.handleTileTap(coord);
      });
      this.tileLayer.add(hitArea);

      const legal = legalTargets.some((target) => coordsEqual(target, coord));
      if (legal) {
        const highlight = this.add.rectangle(position.x, position.y, tileSize - 4, tileSize - 4, 0x6fbd62, 0.16).setStrokeStyle(3, 0xa9e68f, 0.9);
        this.tileLayer.add(highlight);
        highlights.push(highlight);
      }
    }

    if (highlights.length > 0) {
      this.highlightTween = this.tweens.add({ targets: highlights, alpha: { from: 0.35, to: 0.65 }, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }

    for (const corpse of this.state.corpses) this.addCorpse(corpse.position, corpse.enemyId);
    for (const enemy of this.state.enemies) this.addEnemy(enemy.id, enemy.position, enemy.hp);
    this.addPlayer(this.state.player);

    if (this.state.won) this.showVictoryPanel();
  }

  private addCorpse(position: GridCoord, enemyId: string): void {
    const world = this.gridToWorld(position);
    const scale = this.layout.spriteScale;
    const bloodFrame = BLOOD_FRAMES[this.hash(enemyId) % BLOOD_FRAMES.length];
    const blood = this.add.sprite(world.x, world.y + this.layout.tileSize * 0.11, 'dungeon-tiles', bloodFrame).setScale(scale).setAlpha(0.8);
    const corpse = this.add
      .sprite(world.x + 2, world.y + this.layout.tileSize * 0.125, 'monsters', ENEMY_FRAME)
      .setScale(scale * 0.8, scale * 0.36)
      .setAngle(88)
      .setTint(0x62545b)
      .setAlpha(0.86);
    this.tileLayer?.add([blood, corpse]);
  }

  private addEnemy(id: string, position: GridCoord, hp: number): void {
    const world = this.gridToWorld(position);
    const { spriteScale, tileSize } = this.layout;
    const hpWidth = tileSize * 0.72;
    const shadow = this.add.ellipse(world.x, world.y + tileSize * 0.34, tileSize * 0.625, tileSize * 0.2, 0x050405, 0.7);
    const sprite = this.add.sprite(world.x, world.y - 2, 'monsters', ENEMY_FRAME).setScale(spriteScale);
    const hpBack = this.add.rectangle(world.x, world.y - tileSize * 0.45, hpWidth, 7, 0x150e11, 0.95).setStrokeStyle(1, 0x5f3f43);
    const hpFill = this.add.rectangle(world.x - hpWidth / 2 + 1, world.y - tileSize * 0.45, ((hpWidth - 2) * hp) / 4, 5, 0xb5413f, 1).setOrigin(0, 0.5);
    const hitArea = this.add.rectangle(world.x, world.y, tileSize, tileSize, 0xffffff, 0.001);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on('pointerup', () => {
      void this.handleTileTap(position);
    });
    this.enemySprites.set(id, sprite);
    this.tileLayer?.add([shadow, sprite, hpBack, hpFill, hitArea]);
  }

  private addPlayer(position: GridCoord): void {
    const world = this.gridToWorld(position);
    const { spriteScale, tileSize } = this.layout;
    const shadow = this.add.ellipse(world.x, world.y + tileSize * 0.34, tileSize * 0.59, tileSize * 0.19, 0x050405, 0.72);
    const ring = this.add.circle(world.x, world.y + 3, tileSize * 0.42, 0x9ac7bc, 0.08).setStrokeStyle(2, 0x9ac7bc, 0.55);
    this.playerSprite = this.add.sprite(world.x, world.y - 2, 'rogues', PLAYER_FRAME).setScale(spriteScale);
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
      this.setFeedback(nextState.won ? 'The way out is open.' : 'Boots scrape across old stone.');
      await this.animateMove(before.player, coord);
    } else if (result) {
      this.setFeedback(
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
    this.flushPendingLayout();
  }

  private async animateMove(from: GridCoord, to: GridCoord): Promise<void> {
    if (!this.playerSprite) return;
    const sprite = this.playerSprite;
    const scale = this.layout.spriteScale;
    const start = this.gridToWorld(from);
    const end = this.gridToWorld(to);
    sprite.setFlipX(to.col < from.col);

    await this.tween({
      targets: sprite,
      x: Phaser.Math.Linear(start.x, end.x, 0.52),
      y: Phaser.Math.Linear(start.y, end.y, 0.52) - 10,
      scaleX: scale * 0.91,
      scaleY: scale * 1.09,
      duration: 80,
      ease: 'Quad.Out',
    });
    await this.tween({ targets: sprite, x: end.x, y: end.y - 2, scaleX: scale * 1.06, scaleY: scale * 0.94, duration: 92, ease: 'Quad.In' });
    await this.tween({ targets: sprite, scaleX: scale, scaleY: scale, duration: 55, ease: 'Back.Out' });
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
    const scale = this.layout.spriteScale;
    player.setFlipX(dx < 0);

    await this.tween({
      targets: player,
      x: start.x - dx * 0.09,
      y: start.y - dy * 0.09 - 3,
      angle: action === 'kick' ? -8 * Math.sign(dx || -dy) : -4 * Math.sign(dx || -dy),
      scaleX: scale * 0.94,
      scaleY: scale * 1.06,
      duration: action === 'kick' ? 105 : 75,
      ease: 'Quad.Out',
    });
    await this.tween({
      targets: player,
      x: start.x + dx * reach,
      y: start.y + dy * reach - 2,
      angle: action === 'kick' ? 13 * Math.sign(dx || -dy) : 8 * Math.sign(dx || -dy),
      scaleX: scale * (action === 'kick' ? 1.15 : 1.08),
      scaleY: scale * (action === 'kick' ? 0.85 : 0.94),
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
        scaleX: scale * 1.125,
        scaleY: scale * 0.86,
        duration: 150,
        ease: 'Back.Out',
      });
    }

    await this.animateHit(enemySprite, impact, result.damageAmount, result.killed !== undefined);
    await this.tween({ targets: player, x: start.x, y: start.y - 2, angle: 0, scaleX: scale, scaleY: scale, duration: 130, ease: 'Back.Out' });
  }

  private async animateHit(sprite: Phaser.GameObjects.Sprite, position: Phaser.Math.Vector2, damage: number, killed: boolean): Promise<void> {
    const scale = this.layout.spriteScale;
    sprite.setTintFill(0xfff0cf);
    const damageText = this.add.text(position.x, position.y - 24, `-${damage}`, smallCapsStyle(this.layout.shortLandscape ? 23 : 20, '#ffce78')).setOrigin(0.5);
    this.effectsLayer?.add(damageText);
    void this.tween({ targets: damageText, y: position.y - 67, alpha: 0, duration: 500, ease: 'Cubic.Out', onComplete: () => damageText.destroy() });

    const ring = this.add.circle(position.x, position.y, 10, 0xf6c365, 0.05).setStrokeStyle(5, 0xf6c365, 0.95);
    this.effectsLayer?.add(ring);
    void this.tween({ targets: ring, scale: 3.2, alpha: 0, duration: 230, ease: 'Quad.Out', onComplete: () => ring.destroy() });

    await this.tween({ targets: sprite, scaleX: scale * 1.21, scaleY: scale * 0.74, duration: 55, yoyo: true, ease: 'Quad.Out' });
    sprite.clearTint();

    if (killed) {
      this.spawnBlood(position);
      await this.tween({
        targets: sprite,
        y: position.y + 12,
        angle: sprite.flipX ? -88 : 88,
        scaleX: scale * 0.775,
        scaleY: scale * 0.36,
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
    const centerX = this.layout.boardFrame.x + this.layout.boardFrame.width / 2;
    const shade = this.add.rectangle(this.layout.gameWidth / 2, GAME_HEIGHT / 2, this.layout.gameWidth, GAME_HEIGHT, 0x070507, 0.72);
    const panel = this.add.rectangle(centerX, GAME_HEIGHT / 2, 382, 220, 0x171116, 0.98).setStrokeStyle(3, 0xd2a855);
    const title = this.add.text(centerX, 218, 'CELLAR CLEARED', smallCapsStyle(27, '#f3d28e')).setOrigin(0.5);
    const turns = this.add.text(centerX, 263, `${this.state.turn - 1} turns · the dark waits below`, bodyStyle(15, '#b7a896')).setOrigin(0.5);
    const button = this.add.rectangle(centerX, 325, 184, 48, 0x5d3c20, 1).setStrokeStyle(3, 0xe6b85c);
    const label = this.add.text(centerX, 325, 'DESCEND AGAIN', smallCapsStyle(15, '#ffe0a1')).setOrigin(0.5);
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
    return new Phaser.Math.Vector2(this.layout.gridOrigin.x + coord.col * this.layout.tileStep, this.layout.gridOrigin.y + coord.row * this.layout.tileStep);
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
