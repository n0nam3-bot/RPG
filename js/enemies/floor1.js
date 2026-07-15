// Floor 1 enemy roster.
// grabChance = probability a landed attack becomes a heavy "vulnerable" grab
// (high damage, brief stun, extra sanity loss) instead of a normal hit —
// mirrors souls-like heavy-attack telegraphs rather than any scripted event.

export const DUNGEON_BRUTE = {
  name: 'Dungeon Brute',
  isNamed: false,
  health: 70,
  damage: 14,
  grabDamage: 24,
  speed: 2.1,
  detectRadius: 9,
  attackRange: 1.8,
  grabChance: 0.25,
  windupTime: 0.9,
  grabWindupTime: 1.3,
  recoverTime: 0.9,
  staggerThreshold: 3,
  color: 0x5a4a3a,
};

export const BLADE_THRALL = {
  name: 'Blade Thrall',
  isNamed: false,
  health: 55,
  damage: 10,
  grabDamage: 20,
  speed: 3.4,
  detectRadius: 10,
  attackRange: 1.6,
  grabChance: 0.15,
  windupTime: 0.5,
  grabWindupTime: 0.85,
  recoverTime: 0.5,
  staggerThreshold: 2,
  color: 0x3a4a5a,
};

export const THE_WARDEN = {
  name: 'The Warden',
  isNamed: true,
  health: 220,
  damage: 20,
  grabDamage: 32,
  speed: 2.6,
  detectRadius: 14,
  attackRange: 2.2,
  grabChance: 0.3,
  windupTime: 0.8,
  grabWindupTime: 1.2,
  recoverTime: 0.7,
  staggerThreshold: 5,
  color: 0x2a1015,
};

export const FLOOR1_ROSTER = [
  { def: DUNGEON_BRUTE, position: [-6, 0, -2] },
  { def: BLADE_THRALL, position: [6, 0, -4] },
  { def: THE_WARDEN, position: [0, 0, -14], isBoss: true },
];
