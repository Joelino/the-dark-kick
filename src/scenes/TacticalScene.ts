import Phaser from 'phaser';
import { BUILD_LABEL } from '../config/build';
import { COMBAT } from '../config/combat';
import { allGridCoords, coordsEqual, type GridCoord } from '../game/grid';
import { createTacticalLayout, GAME_HEIGHT, MIN_GAME_WIDTH, type TacticalLayout } from '../game/layout';
import {
  basicStrike,
  enemyTurnOrder,
  finishEnemyTurn,
  kick,
  legalTargetsForAction,
  movePlayer,
  resetGame,
  resolveEnemyAction,
  terrainAt,
  type Action,
  type ActionResult,
  type EnemyActionResult,
} from '../game/movement';
import { type EnemyIntent, type GameState } from '../game/state';

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
  private state: GameState = resetGame();
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
  private panelTab: 'order' | 'log' = 'order';
  private combatLog: string[] = ['T1 Objective: reach the exit.'];
  private activeEnemyQueue?: readonly string[];

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
      .text(
        this.layout.logArea.x,
        this.layout.logArea.bodyY + 36,
        '',
        bodyStyle(this.layout.logArea.width < 180 ? 10 : this.layout.shortLandscape ? 15 : 13, '#c8bda8'),
      )
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

  private appendCombatLog(message: string, turn = this.state.turn): void {
    this.combatLog = [...this.combatLog, `T${turn} ${message}`].slice(-4);
    this.renderInfoPanel();
  }

  private renderInfoPanel(): void {
    if (!this.feedback) return;
    this.feedback.setVisible(this.panelTab === 'log');
    this.feedback.setText(this.panelTab === 'log' ? this.combatLog.join('\n') : '');
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
    this.add.text(this.layout.subtitle.x, this.layout.subtitle.y + 18, `BUILD ${BUILD_LABEL}`, smallCapsStyle(10, '#6f6258')).setDepth(22);
    this.add.text(logArea.x, logArea.headingY, 'TACTICAL READOUT', smallCapsStyle(this.layout.shortLandscape ? 12 : 11, '#8f7b64')).setDepth(22);
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
    this.addButton(x, actionYs[1], width, height, 'STRIKE', `${COMBAT.playerStrikeDamage} damage · adjacent`, 'strike', () => this.selectAction('strike'));
    this.addButton(x, actionYs[2], width, height, 'KICK', 'Push · collision damage', 'kick', () => this.selectAction('kick'));
    this.addButton(x - width * 0.26, resetY, width * 0.46, resetHeight, 'END TURN', '', undefined, () => this.finishPlayerTurn());
    this.addButton(x + width * 0.26, resetY, width * 0.46, resetHeight, 'RESET', '', undefined, () => this.reset());
    const narrowReadout = this.layout.logArea.width < 180;
    this.addPanelTab(this.layout.logArea.x, this.layout.logArea.bodyY, narrowReadout ? 'ORDER' : 'TURN ORDER', 'order');
    this.addPanelTab(this.layout.logArea.x + Math.min(132, this.layout.logArea.width * 0.54), this.layout.logArea.bodyY, narrowReadout ? 'LOG' : 'COMBAT LOG', 'log');
    if (this.panelTab === 'order') this.addTurnOrderCards();
    this.renderInfoPanel();
  }

  private addPanelTab(x: number, y: number, label: string, tab: 'order' | 'log'): void {
    const active = this.panelTab === tab;
    const width = Math.min(122, this.layout.logArea.width * 0.48);
    const button = this.add.rectangle(x, y, width, 27, active ? 0x5d3c20 : 0x21191c).setOrigin(0).setStrokeStyle(1, active ? 0xe6b85c : 0x57454a);
    const text = this.add
      .text(x + width / 2, y + 14, label, smallCapsStyle(this.layout.logArea.width < 180 ? 9 : this.layout.shortLandscape ? 11 : 10, active ? '#ffe0a1' : '#a99c91'))
      .setOrigin(0.5);
    for (const object of [button, text]) {
      object.setInteractive({ useHandCursor: true });
      object.on('pointerup', () => {
        this.panelTab = tab;
        this.addHud();
        this.renderInfoPanel();
      });
      this.hudLayer?.add(object);
    }
  }

  private addTurnOrderCards(): void {
    const enemies = [...this.state.enemies].sort((a, b) => a.position.row - b.position.row || a.position.col - b.position.col);
    const queue = this.activeEnemyQueue
      ? this.activeEnemyQueue.map((id) => ({ kind: 'enemy' as const, id }))
      : [{ kind: 'player' as const, id: 'player' }, ...enemies.map((enemy) => ({ kind: 'enemy' as const, id: enemy.id }))];
    const compact = !this.layout.hasSeparateLogPanel || this.layout.logArea.width < 180;
    const cardHeight = compact ? (this.layout.shortLandscape ? 37 : 36) : 62;
    const gap = compact ? 3 : 6;
    const startY = this.layout.logArea.bodyY + 31;
    const width = this.layout.logArea.width;
    const narrowCard = width < 180;

    queue.forEach((entry, index) => {
      const y = startY + index * (cardHeight + gap);
      const active = index === 0;
      const background = this.add
        .rectangle(this.layout.logArea.x, y, width, cardHeight, active ? 0x49311f : 0x171216, 0.98)
        .setOrigin(0)
        .setStrokeStyle(active ? 2 : 1, active ? 0xe6b85c : 0x4d3e43);
      const portraitSize = Math.max(18, Math.min(cardHeight - 8, compact ? 28 : 42));
      const portraitX = this.layout.logArea.x + 7 + portraitSize / 2;
      const portraitY = y + cardHeight / 2;
      const portraitBack = this.add.rectangle(portraitX, portraitY, portraitSize + 4, portraitSize + 4, active ? 0x271d16 : 0x0d0a0c).setStrokeStyle(1, active ? 0xb98d48 : 0x493b40);
      const portrait = this.add
        .sprite(portraitX, portraitY, entry.kind === 'player' ? 'rogues' : 'monsters', entry.kind === 'player' ? PLAYER_FRAME : ENEMY_FRAME)
        .setScale(portraitSize / 32);
      const textX = portraitX + portraitSize / 2 + 8;
      const textWidth = width - (textX - this.layout.logArea.x) - 8;

      let name = 'YOU';
      let status = this.playerTurnStatus();
      let stats = `HP ${this.state.playerHp}/${COMBAT.playerMaxHealth} · ATK ${COMBAT.playerStrikeDamage}`;
      if (entry.kind === 'enemy') {
        const enemy = this.state.enemies.find((candidate) => candidate.id === entry.id);
        if (!enemy) return;
        const intent = this.state.intents.find((candidate) => candidate.enemyId === enemy.id);
        name = enemy.id === 'near-orc' ? (narrowCard ? 'NEAR' : 'NEAR ORC') : enemy.id === 'far-orc' ? (narrowCard ? 'FAR' : 'FAR ORC') : 'ORC';
        stats = `HP ${enemy.hp}/${COMBAT.orcMaxHealth} · ATK ${COMBAT.orcStrikeDamage}`;
        status = enemy.stunnedTurns > 0
          ? narrowCard ? 'STUN · SKIP' : 'STUNNED · SKIPS'
          : intent?.kind === 'attack'
            ? narrowCard ? 'ATTACK YOU' : 'STRIKE → YOU'
            : intent
              ? narrowCard ? `MOVE ${intent.target.col},${intent.target.row}` : `MOVE → ${intent.target.col},${intent.target.row}`
              : 'WAIT';
      } else if (narrowCard && status === 'MOVE + ACTION') {
        status = 'MOVE + ACT';
      }
      if (!compact) name += `  ·  ${stats}`;

      const nameText = this.add
        .text(textX, compact ? y + 2 : y + 10, name, smallCapsStyle(compact ? (narrowCard ? 9 : 10) : 14, active ? '#ffe0a1' : '#d8cabc'))
        .setOrigin(0)
        .setWordWrapWidth(textWidth);
      const statsText = compact
        ? this.add
            .text(textX, y + 14, stats, smallCapsStyle(narrowCard ? 7 : 8, active ? '#d8c6a1' : '#9d9190'))
            .setOrigin(0)
            .setWordWrapWidth(textWidth)
        : undefined;
      const statusText = this.add
        .text(textX, compact ? y + cardHeight - 2 : y + 38, status, smallCapsStyle(compact ? (narrowCard ? 7 : 8) : 11, active ? '#e6b85c' : '#8f8580'))
        .setOrigin(0, compact ? 1 : 0.5)
        .setWordWrapWidth(textWidth);
      const objects: Phaser.GameObjects.GameObject[] = [background, portraitBack, portrait, nameText, statusText];
      if (statsText) objects.push(statsText);
      if (active && !compact) {
        objects.push(this.add.text(this.layout.logArea.x + width - 9, y + 9, 'NEXT', smallCapsStyle(9, '#ffe0a1')).setOrigin(1, 0));
      }
      this.hudLayer?.add(objects);
    });
  }

  private playerTurnStatus(): string {
    if (this.state.moved && this.state.acted) return 'TURN ENDING';
    if (this.state.moved) return 'ACTION LEFT';
    if (this.state.acted) return 'MOVE LEFT';
    return 'MOVE + ACTION';
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
    const completed = action === 'move' ? this.state.moved : action !== undefined ? this.state.acted : false;
    const active = !completed && action === this.selectedAction;
    const button = this.add
      .rectangle(x, y, width, height, completed ? 0x171316 : active ? 0x5d3c20 : 0x21191c, 1)
      .setStrokeStyle(active ? 3 : 2, completed ? 0x3d3438 : active ? 0xe6b85c : 0x57454a);
    const labelY = detail ? y - 9 : y;
    const centeredLabel = detail.length === 0;
    const labelSize = centeredLabel ? (this.layout.shortLandscape ? 15 : 14) : this.layout.shortLandscape ? 19 : 17;
    const text = this.add
      .text(centeredLabel ? x : x - width / 2 + 17, labelY, `${label}${completed ? '  ✓' : ''}`, smallCapsStyle(labelSize, completed ? '#71686a' : active ? '#ffe0a1' : '#e4d9ca'))
      .setOrigin(centeredLabel ? 0.5 : 0, 0.5);
    const detailText = detail
      ? this.add.text(x - width / 2 + 17, y + 13, detail, bodyStyle(this.layout.shortLandscape ? 13 : 11, completed ? '#5f585a' : active ? '#dcb875' : '#8f8580')).setOrigin(0, 0.5)
      : undefined;
    const pip = action ? this.add.circle(x + width / 2 - 18, y, 5, completed ? 0x47705d : active ? 0xffcc66 : 0x5c4d4f, 1) : undefined;

    const objects: Phaser.GameObjects.GameObject[] = [button, text];
    if (detailText) objects.push(detailText);
    if (pip) objects.push(pip);
    for (const object of objects) {
      if (completed) {
        this.hudLayer?.add(object);
        continue;
      }
      object.setInteractive({ useHandCursor: true });
      object.on('pointerup', onTap);
      object.on('pointerover', () => button.setFillStyle(active ? 0x6a4728 : 0x302226));
      object.on('pointerout', () => button.setFillStyle(active ? 0x5d3c20 : 0x21191c));
      this.hudLayer?.add(object);
    }
  }

  private selectAction(action: Action): void {
    if (
      this.state.won ||
      this.state.lost ||
      this.inputLocked ||
      (action === 'move' ? this.state.moved : this.state.acted)
    ) return;
    this.selectedAction = action;
    this.addHud();
    this.renderBoard();
    this.renderInfoPanel();
  }

  private reset(): void {
    if (this.inputLocked) return;
    this.state = resetGame();
    this.selectedAction = 'move';
    this.panelTab = 'order';
    this.combatLog = ['T1 Objective: reach the exit.'];
    this.activeEnemyQueue = undefined;
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
    this.turnText?.setText(`TURN ${this.state.turn}  ·  ${this.activeEnemyQueue ? 'ENEMIES' : 'YOU'}  ·  HP ${this.state.playerHp}/${COMBAT.playerMaxHealth}`);
    this.renderInfoPanel();
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
    for (const enemy of this.state.enemies) this.addEnemy(enemy.id, enemy.position, enemy.hp, enemy.stunnedTurns > 0);
    this.addPlayer(this.state.player);
    for (const intent of this.state.intents) this.addIntent(intent);

    if (this.state.won || this.state.lost) this.showEndPanel();
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

  private addIntent(intent: EnemyIntent): void {
    const enemy = this.state.enemies.find((candidate) => candidate.id === intent.enemyId);
    if (!enemy) return;
    const from = this.gridToWorld(enemy.position);
    const to = this.gridToWorld(intent.target);
    if (intent.kind === 'attack') {
      const { tileSize } = this.layout;
      const target = this.add
        .rectangle(to.x, to.y, tileSize - 8, tileSize - 8, 0xa5262e, 0.08)
        .setStrokeStyle(3, 0xff655f, 0.9);
      const badge = this.add
        .rectangle(to.x, to.y + tileSize * 0.41, Math.min(58, tileSize - 10), 15, 0x56151b, 0.96)
        .setStrokeStyle(1, 0xff8a7c, 0.95);
      const label = this.add.text(to.x, badge.y, 'ATTACK', smallCapsStyle(this.layout.shortLandscape ? 9 : 8, '#ffd0be')).setOrigin(0.5);
      this.tileLayer?.add([target, badge, label]);
      return;
    }

    const marker = this.add
      .text((from.x + to.x) / 2, (from.y + to.y) / 2, '➜', smallCapsStyle(30, '#f0b85c'))
      .setOrigin(0.5)
      .setAngle(Phaser.Math.RadToDeg(Math.atan2(to.y - from.y, to.x - from.x)))
      .setAlpha(0.92);
    this.tileLayer?.add(marker);
  }

  private addEnemy(id: string, position: GridCoord, hp: number, stunned: boolean): void {
    const world = this.gridToWorld(position);
    const { spriteScale, tileSize } = this.layout;
    const hpWidth = tileSize * 0.72;
    const shadow = this.add.ellipse(world.x, world.y + tileSize * 0.34, tileSize * 0.625, tileSize * 0.2, 0x050405, 0.7);
    const sprite = this.add.sprite(world.x, world.y - 2, 'monsters', ENEMY_FRAME).setScale(spriteScale);
    const hpBack = this.add.rectangle(world.x, world.y - tileSize * 0.45, hpWidth, 7, 0x150e11, 0.95).setStrokeStyle(1, 0x5f3f43);
    const hpFill = this.add.rectangle(world.x - hpWidth / 2 + 1, world.y - tileSize * 0.45, ((hpWidth - 2) * hp) / COMBAT.orcMaxHealth, 5, 0xb5413f, 1).setOrigin(0, 0.5);
    const hitArea = this.add.rectangle(world.x, world.y, tileSize, tileSize, 0xffffff, 0.001);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on('pointerup', () => {
      void this.handleTileTap(position);
    });
    this.enemySprites.set(id, sprite);
    this.tileLayer?.add([shadow, sprite, hpBack, hpFill, hitArea]);
    if (stunned) {
      const marker = this.add.text(world.x, world.y - tileSize * 0.25, '★  ★', smallCapsStyle(18, '#ffe36e')).setOrigin(0.5).setStroke('#3a2700', 4);
      this.tileLayer?.add(marker);
    }
  }

  private addPlayer(position: GridCoord): void {
    const world = this.gridToWorld(position);
    const { spriteScale, tileSize } = this.layout;
    const hpWidth = tileSize * 0.72;
    const shadow = this.add.ellipse(world.x, world.y + tileSize * 0.34, tileSize * 0.59, tileSize * 0.19, 0x050405, 0.72);
    const ring = this.add.circle(world.x, world.y + 3, tileSize * 0.42, 0x9ac7bc, 0.08).setStrokeStyle(2, 0x9ac7bc, 0.55);
    this.playerSprite = this.add.sprite(world.x, world.y - 2, 'rogues', PLAYER_FRAME).setScale(spriteScale);
    const hpBack = this.add.rectangle(world.x, world.y - tileSize * 0.45, hpWidth, 7, 0x0b1112, 0.95).setStrokeStyle(1, 0x3f625d);
    const hpFill = this.add
      .rectangle(world.x - hpWidth / 2 + 1, world.y - tileSize * 0.45, ((hpWidth - 2) * this.state.playerHp) / COMBAT.playerMaxHealth, 5, 0x5aa58e, 1)
      .setOrigin(0, 0.5);
    this.tileLayer?.add([shadow, ring, this.playerSprite, hpBack, hpFill]);
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
      const spikeDamage = before.playerHp - nextState.playerHp;
      this.appendCombatLog(
        nextState.won
          ? 'You: exit reached.'
          : `You: move to ${coord.col},${coord.row}${spikeDamage > 0 ? ` · ${spikeDamage} spike damage` : ''}.`,
      );
      await this.animateMove(before.player, coord);
      if (spikeDamage > 0 && this.playerSprite) {
        await this.animatePlayerHit(this.playerSprite, this.gridToWorld(coord), spikeDamage);
      }
    } else if (result) {
      this.appendCombatLog(
        action === 'strike'
          ? `You: strike · ${result.damageAmount} damage${result.killed ? ' · kill' : ''}.`
          : `You: kick · ${result.damageAmount} damage${result.pushedTo ? ` · push to ${result.pushedTo.col},${result.pushedTo.row}` : ''}${result.killed ? ' · kill' : ''}.`,
      );
      await this.animateAttack(action, before, coord, result);
    }

    this.state = nextState;
    if (this.state.moved && this.state.acted && !this.state.won && !this.state.lost) {
      // Render the resolved player action before consuming stun in the enemy
      // phase. In particular, a move-then-kick must not erase its static stun
      // marker in the same frame in which it is applied.
      this.renderBoard();
      await this.delay(280);
      await this.playEnemyTurn();
    }
    this.selectedAction = this.state.acted ? 'move' : this.state.moved ? 'strike' : 'move';
    this.addHud();
    this.renderBoard();
    this.inputLocked = false;
    this.flushPendingLayout();
  }

  private async finishPlayerTurn(): Promise<void> {
    if (this.inputLocked || this.state.won || this.state.lost) return;
    this.inputLocked = true;
    await this.delay(180);
    await this.playEnemyTurn();
    this.selectedAction = 'move';
    this.addHud();
    this.renderBoard();
    this.inputLocked = false;
    this.flushPendingLayout();
  }

  private async playEnemyTurn(): Promise<void> {
    const queue = [...enemyTurnOrder(this.state)];
    this.activeEnemyQueue = queue;
    this.addHud();
    this.renderBoard();

    for (let index = 0; index < queue.length; index += 1) {
      const enemyId = queue[index];
      const result = resolveEnemyAction(this.state, enemyId);
      await this.animateEnemyAction(result);
      this.state = result.state;
      this.appendEnemyAction(result);
      this.activeEnemyQueue = queue.slice(index + 1);
      this.addHud();
      this.renderBoard();
      if (this.state.lost) break;
      await this.delay(110);
    }

    this.state = finishEnemyTurn(this.state);
    this.activeEnemyQueue = undefined;
  }

  private appendEnemyAction(result: EnemyActionResult): void {
    const name = result.enemyId === 'near-orc' ? 'Near Orc' : result.enemyId === 'far-orc' ? 'Far Orc' : 'Orc';
    if (result.kind === 'attack') {
      this.appendCombatLog(`${name}: strike · ${result.damageAmount} damage · you have ${result.state.playerHp}/${COMBAT.playerMaxHealth} HP.`);
      return;
    }
    if (result.kind === 'move' && result.target) {
      this.appendCombatLog(
        `${name}: move to ${result.target.col},${result.target.row}${result.damageAmount > 0 ? ` · ${result.damageAmount} spike damage` : ''}${result.killed ? ' · dies' : ''}.`,
      );
      return;
    }
    if (result.kind === 'miss') {
      this.appendCombatLog(`${name}: strikes your old position · misses.`);
      return;
    }
    if (result.kind === 'stunned') {
      this.appendCombatLog(`${name}: stunned · skips.`);
      return;
    }
    this.appendCombatLog(`${name}: blocked · waits.`);
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

  private async animateEnemyAction(result: EnemyActionResult): Promise<void> {
    const sprite = this.enemySprites.get(result.enemyId);
    if (!sprite) return;
    const scale = this.layout.spriteScale;

    if (result.kind === 'stunned') {
      sprite.setTint(0xffe36e);
      await this.tween({ targets: sprite, angle: { from: -5, to: 5 }, y: sprite.y - 4, duration: 95, yoyo: true, repeat: 2, ease: 'Sine.InOut' });
      sprite.clearTint();
      sprite.setAngle(0);
      return;
    }

    if (result.kind === 'wait') {
      await this.tween({ targets: sprite, scaleY: scale * 0.88, alpha: 0.7, duration: 120, yoyo: true, ease: 'Sine.InOut' });
      return;
    }

    if (result.kind === 'move' && result.target) {
      const start = this.gridToWorld(result.from);
      const end = this.gridToWorld(result.target);
      sprite.setFlipX(result.target.col < result.from.col);
      await this.tween({
        targets: sprite,
        x: Phaser.Math.Linear(start.x, end.x, 0.52),
        y: Phaser.Math.Linear(start.y, end.y, 0.52) - 9,
        scaleX: scale * 0.91,
        scaleY: scale * 1.09,
        duration: 105,
        ease: 'Quad.Out',
      });
      await this.tween({ targets: sprite, x: end.x, y: end.y - 2, scaleX: scale * 1.06, scaleY: scale * 0.94, duration: 115, ease: 'Quad.In' });
      await this.tween({ targets: sprite, scaleX: scale, scaleY: scale, duration: 55, ease: 'Back.Out' });
      this.spawnDust(end.x, end.y + 23);
      if (result.damageAmount > 0) await this.animateHit(sprite, end, result.damageAmount, result.killed !== undefined);
      return;
    }

    if (!result.target) return;
    const start = this.gridToWorld(result.from);
    const target = this.gridToWorld(result.target);
    const dx = target.x - start.x;
    const dy = target.y - start.y;
    sprite.setFlipX(dx < 0);

    await this.tween({
      targets: sprite,
      x: start.x - dx * 0.08,
      y: start.y - dy * 0.08 - 3,
      angle: -6 * Math.sign(dx || -dy),
      scaleX: scale * 0.93,
      scaleY: scale * 1.08,
      duration: 95,
      ease: 'Quad.Out',
    });
    await this.tween({
      targets: sprite,
      x: start.x + dx * 0.54,
      y: start.y + dy * 0.54 - 2,
      angle: 10 * Math.sign(dx || -dy),
      scaleX: scale * 1.11,
      scaleY: scale * 0.89,
      duration: 92,
      ease: 'Cubic.In',
    });
    this.spawnEnemySlash(target, result.kind === 'miss');
    this.cameras.main.shake(result.kind === 'attack' ? 92 : 55, result.kind === 'attack' ? 0.003 : 0.0015);
    if (result.kind === 'attack' && this.playerSprite) {
      await this.animatePlayerHit(this.playerSprite, target, result.damageAmount);
    } else {
      await this.delay(90);
    }
    await this.tween({ targets: sprite, x: start.x, y: start.y - 2, angle: 0, scaleX: scale, scaleY: scale, duration: 135, ease: 'Back.Out' });
  }

  private async animatePlayerHit(sprite: Phaser.GameObjects.Sprite, position: Phaser.Math.Vector2, damage: number): Promise<void> {
    const scale = this.layout.spriteScale;
    sprite.setTintFill(0xff8b75);
    const damageText = this.add.text(position.x, position.y - 24, `-${damage}`, smallCapsStyle(this.layout.shortLandscape ? 23 : 20, '#ff8b75')).setOrigin(0.5);
    this.effectsLayer?.add(damageText);
    void this.tween({ targets: damageText, y: position.y - 67, alpha: 0, duration: 500, ease: 'Cubic.Out', onComplete: () => damageText.destroy() });
    const ring = this.add.circle(position.x, position.y, 10, 0xff655f, 0.05).setStrokeStyle(5, 0xff655f, 0.95);
    this.effectsLayer?.add(ring);
    void this.tween({ targets: ring, scale: 3, alpha: 0, duration: 230, ease: 'Quad.Out', onComplete: () => ring.destroy() });
    await this.tween({ targets: sprite, x: position.x + 6, scaleX: scale * 1.15, scaleY: scale * 0.78, duration: 48, yoyo: true, repeat: 2, ease: 'Sine.InOut' });
    sprite.clearTint();
    sprite.setPosition(position.x, position.y - 2).setScale(scale);
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
    if (damage > 0) {
      const damageText = this.add.text(position.x, position.y - 24, `-${damage}`, smallCapsStyle(this.layout.shortLandscape ? 23 : 20, '#ffce78')).setOrigin(0.5);
      this.effectsLayer?.add(damageText);
      void this.tween({ targets: damageText, y: position.y - 67, alpha: 0, duration: 500, ease: 'Cubic.Out', onComplete: () => damageText.destroy() });
    }

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

  private spawnEnemySlash(position: Phaser.Math.Vector2, missed: boolean): void {
    const slash = this.add.rectangle(position.x, position.y, 6, 58, missed ? 0x9d8583 : 0xff655f, 0.95).setAngle(-45);
    const echo = this.add.rectangle(position.x, position.y, 3, 42, missed ? 0xc2aaa7 : 0xffc0a8, 0.72).setAngle(48);
    this.effectsLayer?.add([slash, echo]);
    void this.tween({ targets: [slash, echo], scaleY: 1.4, alpha: 0, duration: 190, ease: 'Quad.Out', onComplete: () => [slash, echo].forEach((object) => object.destroy()) });
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

  private showEndPanel(): void {
    const centerX = this.layout.boardFrame.x + this.layout.boardFrame.width / 2;
    const shade = this.add.rectangle(this.layout.gameWidth / 2, GAME_HEIGHT / 2, this.layout.gameWidth, GAME_HEIGHT, 0x070507, 0.72);
    const panel = this.add.rectangle(centerX, GAME_HEIGHT / 2, 382, 220, 0x171116, 0.98).setStrokeStyle(3, 0xd2a855);
    const title = this.add.text(centerX, 218, this.state.won ? 'CELLAR CLEARED' : 'FALLEN', smallCapsStyle(27, '#f3d28e')).setOrigin(0.5);
    const turns = this.add.text(centerX, 263, `Turn ${this.state.turn} · the dark waits below`, bodyStyle(15, '#b7a896')).setOrigin(0.5);
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

  private delay(duration: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(duration, resolve));
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
