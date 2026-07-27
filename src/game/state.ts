import { COMBAT } from '../config/combat';
import type { GridCoord } from './grid';
import { getActiveLevel } from './level';

export type Terrain = 'floor' | 'wall' | 'exit' | 'spikes';
export type UnitSide = 'player' | 'enemy';

export interface Enemy {
  readonly id: string;
  readonly position: GridCoord;
  readonly hp: number;
  readonly stunnedActivations: number;
}

export interface Charge {
  readonly id: string;
  readonly actorSide: UnitSide;
  readonly actorId: string;
  readonly action: 'power-strike';
  readonly target: GridCoord;
  readonly damage: number;
  readonly resolveOnRound: number;
}

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
  readonly charges: readonly Charge[];
  readonly nextChargeId: number;
  readonly turn: number;
  readonly movePointsRemaining: number;
  readonly acted: boolean;
  readonly kickCooldownRemaining: number;
  readonly kickUsedThisTurn: boolean;
  readonly won: boolean;
  readonly lost: boolean;
}

export const createInitialState = (): GameState => {
  const level = getActiveLevel();
  const enemySpawns = level.id === 'edited-cellar'
    ? level.enemySpawns
    : level.enemySpawns.slice(0, COMBAT.orcCount);
  return {
    player: { ...level.playerStart },
    playerHp: COMBAT.playerHealth,
    exit: { ...level.exit },
    spikes: level.spikes.map((spike) => ({ ...spike })),
    walls: level.walls.map((wall) => ({ ...wall })),
    enemies: enemySpawns.map((spawn) => ({
      id: spawn.id,
      position: { ...spawn.position },
      hp: COMBAT.orcHealth,
      stunnedActivations: 0,
    })),
    corpses: [],
    charges: [],
    nextChargeId: 1,
    turn: 1,
    movePointsRemaining: COMBAT.playerMovePoints,
    acted: false,
    kickCooldownRemaining: 0,
    kickUsedThisTurn: false,
    won: false,
    lost: false,
  };
};
