import { COMBAT } from '../config/combat';
import type { GridCoord } from './grid';

export type Terrain = 'floor' | 'wall' | 'exit' | 'spikes';

export interface Enemy {
  readonly id: string;
  readonly position: GridCoord;
  readonly hp: number;
  readonly stunnedTurns: number;
}

export type EnemyIntent =
  | { readonly enemyId: string; readonly kind: 'move'; readonly target: GridCoord }
  | { readonly enemyId: string; readonly kind: 'attack'; readonly target: GridCoord };

export interface Corpse {
  readonly enemyId: string;
  readonly position: GridCoord;
}

export interface GameState {
  readonly player: GridCoord;
  readonly playerHp: number;
  readonly exit: GridCoord;
  readonly spikes: readonly GridCoord[];
  readonly walls: readonly GridCoord[];
  readonly enemies: readonly Enemy[];
  readonly corpses: readonly Corpse[];
  readonly turn: number;
  readonly moved: boolean;
  readonly acted: boolean;
  readonly intents: readonly EnemyIntent[];
  readonly won: boolean;
  readonly lost: boolean;
}

export const INITIAL_STATE: GameState = {
  player: { col: 1, row: 2 },
  playerHp: COMBAT.playerMaxHealth,
  exit: { col: 6, row: 2 },
  spikes: [{ col: 4, row: 2 }],
  walls: [
    { col: 3, row: 1 },
    { col: 5, row: 4 },
  ],
  enemies: [
    { id: 'near-orc', position: { col: 3, row: 2 }, hp: COMBAT.orcMaxHealth, stunnedTurns: 0 },
    { id: 'far-orc', position: { col: 7, row: 4 }, hp: COMBAT.orcMaxHealth, stunnedTurns: 0 },
  ],
  corpses: [],
  turn: 1,
  moved: false,
  acted: false,
  intents: [],
  won: false,
  lost: false,
};

export const createInitialState = (): GameState => ({
  player: { ...INITIAL_STATE.player },
  playerHp: INITIAL_STATE.playerHp,
  exit: { ...INITIAL_STATE.exit },
  spikes: INITIAL_STATE.spikes.map((spike) => ({ ...spike })),
  walls: INITIAL_STATE.walls.map((wall) => ({ ...wall })),
  enemies: INITIAL_STATE.enemies.map((enemy) => ({ ...enemy, position: { ...enemy.position } })),
  corpses: INITIAL_STATE.corpses.map((corpse) => ({ ...corpse, position: { ...corpse.position } })),
  turn: INITIAL_STATE.turn,
  moved: INITIAL_STATE.moved,
  acted: INITIAL_STATE.acted,
  intents: [],
  won: INITIAL_STATE.won,
  lost: INITIAL_STATE.lost,
});
