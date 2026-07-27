export interface CombatConfig {
  playerHealth: number;
  playerMovePoints: number;
  strikeDamage: number;
  kickBaseDamage: number;
  kickCooldownRounds: number;
  powerStrikeDamage: number;
  chargeWindupRounds: number;
  forcedImpactDamage: number;
  spikeDamage: number;
  stunDurationActivations: number;
  orcHealth: number;
  orcStrikeDamage: number;
  orcMovePoints: number;
  orcCount: number;
}

export type CombatConfigKey = keyof CombatConfig;

export interface CombatTuningDefinition {
  readonly key: CombatConfigKey;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

/** Defaults and valid ranges live together so rules and the tuning screen cannot drift. */
export const COMBAT_DEFAULTS: Readonly<CombatConfig> = Object.freeze({
  playerHealth: 5,
  playerMovePoints: 2,
  strikeDamage: 1,
  kickBaseDamage: 0,
  kickCooldownRounds: 0,
  powerStrikeDamage: 3,
  chargeWindupRounds: 1,
  forcedImpactDamage: 1,
  spikeDamage: 3,
  stunDurationActivations: 1,
  orcHealth: 4,
  orcStrikeDamage: 1,
  orcMovePoints: 1,
  orcCount: 2,
});

export const COMBAT_TUNING: readonly CombatTuningDefinition[] = [
  { key: 'playerHealth', label: 'Player health', min: 1, max: 20, step: 1 },
  { key: 'playerMovePoints', label: 'Player move points', min: 0, max: 6, step: 1 },
  { key: 'strikeDamage', label: 'Strike damage', min: 0, max: 10, step: 1 },
  { key: 'kickBaseDamage', label: 'Kick base damage', min: 0, max: 10, step: 1 },
  { key: 'kickCooldownRounds', label: 'Kick cooldown rounds', min: 0, max: 6, step: 1 },
  { key: 'powerStrikeDamage', label: 'Power Strike damage', min: 0, max: 12, step: 1 },
  { key: 'chargeWindupRounds', label: 'Charge wind-up rounds', min: 1, max: 5, step: 1 },
  { key: 'forcedImpactDamage', label: 'Forced impact damage', min: 0, max: 10, step: 1 },
  { key: 'spikeDamage', label: 'Spike damage', min: 0, max: 10, step: 1 },
  { key: 'stunDurationActivations', label: 'Stun activations', min: 0, max: 5, step: 1 },
  { key: 'orcHealth', label: 'Orc health', min: 1, max: 20, step: 1 },
  { key: 'orcStrikeDamage', label: 'Orc Strike damage', min: 0, max: 10, step: 1 },
  { key: 'orcMovePoints', label: 'Orc move points', min: 0, max: 4, step: 1 },
  { key: 'orcCount', label: 'Orc count', min: 1, max: 4, step: 1 },
] as const;

/** Mutable only through applyCombatConfig; one applied snapshot is used for an entire run. */
export const COMBAT: CombatConfig = { ...COMBAT_DEFAULTS };

export const clampCombatConfig = (candidate: Partial<CombatConfig>): CombatConfig => {
  const next: CombatConfig = { ...COMBAT_DEFAULTS };
  for (const definition of COMBAT_TUNING) {
    const supplied = candidate[definition.key];
    const value = typeof supplied === 'number' && Number.isFinite(supplied)
      ? Math.round(supplied)
      : COMBAT_DEFAULTS[definition.key];
    next[definition.key] = Math.min(definition.max, Math.max(definition.min, value));
  }
  return next;
};

export const applyCombatConfig = (candidate: Partial<CombatConfig>): CombatConfig => {
  const next = clampCombatConfig(candidate);
  Object.assign(COMBAT, next);
  return { ...COMBAT };
};
