// Floor 2 enemy roster — noticeably tougher than floor 1. Same grab-attack
// convention: grabChance is the odds a landed hit is a heavy, longer-
// telegraphed unblockable move (bigger damage, stagger, extra sanity loss).

export const IRON_WARDEN_GUARD = {
  name: 'Iron Guard',
  isNamed: false,
  health: 95,
  damage: 17,
  grabDamage: 28,
  speed: 2.3,
  detectRadius: 10,
  attackRange: 1.9,
  grabChance: 0.28,
  windupTime: 0.85,
  grabWindupTime: 1.25,
  recoverTime: 0.85,
  staggerThreshold: 4,
  color: 0x4a4a52,
};

export const CHAIN_FLAGELLANT = {
  name: 'Chain Flagellant',
  isNamed: false,
  health: 65,
  damage: 12,
  grabDamage: 22,
  speed: 3.8,
  detectRadius: 11,
  attackRange: 2.4, // chain reaches further
  grabChance: 0.2,
  windupTime: 0.45,
  grabWindupTime: 0.8,
  recoverTime: 0.45,
  staggerThreshold: 2,
  color: 0x5a2a3a,
};

export const THE_TORMENTOR = {
  name: 'The Tormentor',
  isNamed: true,
  health: 300,
  damage: 24,
  grabDamage: 36,
  speed: 2.9,
  detectRadius: 15,
  attackRange: 2.3,
  grabChance: 0.32,
  windupTime: 0.7,
  grabWindupTime: 1.05,
  recoverTime: 0.6,
  staggerThreshold: 6,
  color: 0x1a1520,
  hasSlam: true,
  slamRadius: 5.0,
  slamDamage: 34,
  slamWindupTime: 1.5,
  slamChance: 0.26,
};

export const FLOOR2_ROSTER = [
  { def: IRON_WARDEN_GUARD, position: [-7, 0, -2] },
  { def: CHAIN_FLAGELLANT, position: [7, 0, -4] },
  { def: IRON_WARDEN_GUARD, position: [-4, 0, -10] },
  { def: THE_TORMENTOR, position: [0, 0, -14], isBoss: true },
];
