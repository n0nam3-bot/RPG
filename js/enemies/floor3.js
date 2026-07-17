// Floor 3 (final) enemy roster — the hardest floor. Same grab-attack
// convention: grabChance is the odds a landed hit is a heavy, longer-
// telegraphed unblockable move (bigger damage, stagger, extra sanity loss).

export const SENTINEL_HULK = {
  name: 'Sentinel Hulk',
  isNamed: false,
  health: 130,
  damage: 22,
  grabDamage: 34,
  speed: 1.9,
  detectRadius: 10,
  attackRange: 2.0,
  grabChance: 0.32,
  windupTime: 1.0,
  grabWindupTime: 1.4,
  recoverTime: 1.0,
  staggerThreshold: 5,
  color: 0x35302a,
};

export const SHADOW_STALKER = {
  name: 'Shadow Stalker',
  isNamed: false,
  health: 60,
  damage: 13,
  grabDamage: 24,
  speed: 4.4,
  detectRadius: 12,
  attackRange: 1.6,
  grabChance: 0.22,
  windupTime: 0.38,
  grabWindupTime: 0.7,
  recoverTime: 0.4,
  staggerThreshold: 2,
  color: 0x1a1a2a,
};

export const THE_HOLLOW_KING = {
  name: 'The Hollow King',
  isNamed: true,
  health: 400,
  damage: 28,
  grabDamage: 42,
  speed: 3.0,
  detectRadius: 16,
  attackRange: 2.4,
  grabChance: 0.34,
  windupTime: 0.65,
  grabWindupTime: 1.0,
  recoverTime: 0.55,
  staggerThreshold: 7,
  color: 0x120a10,
  hasSlam: true,
  slamRadius: 5.5,
  slamDamage: 40,
  slamWindupTime: 1.4,
  slamChance: 0.3,
};

export const FLOOR3_ROSTER = [
  { def: SENTINEL_HULK, position: [-7, 0, -2] },
  { def: SHADOW_STALKER, position: [7, 0, -4] },
  { def: SHADOW_STALKER, position: [-4, 0, -10] },
  { def: SENTINEL_HULK, position: [4, 0, -10] },
  { def: THE_HOLLOW_KING, position: [0, 0, -14], isBoss: true },
];
