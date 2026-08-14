// roster.js — character stat blocks (light/medium/heavy/skill/ultimate) and
// AI archetypes, plus the player's 2-character team and the ladder of
// enemy teams.

export const CHARACTERS = {
  paladin: {
    name: 'The Paladin', health: 100, speed: 5.2,
    lightDamage: 5, mediumDamage: 8, heavyDamage: 14, skillDamage: 18, ultimateDamage: 32,
    color: 0x4a6b9e, headColor: 0xf0e4c8,
    archetype: { preferredRange: 1.8, aggression: 0.6, attackChance: 0.6, attackWeights: { light: 0.45, medium: 0.35, heavy: 0.2 }, blockChance: 0.25, evadeChance: 0.12, skillAggression: 0.35, ultimateAggression: 0.5, decisionInterval: 0.32 },
  },
  sistervow: {
    name: 'Sister Vow', health: 90, speed: 5.8,
    lightDamage: 4, mediumDamage: 7, heavyDamage: 12, skillDamage: 16, ultimateDamage: 30,
    color: 0x3ba888, headColor: 0xf0e4c8,
    archetype: { preferredRange: 1.7, aggression: 0.75, attackChance: 0.68, attackWeights: { light: 0.55, medium: 0.3, heavy: 0.15 }, blockChance: 0.15, evadeChance: 0.18, skillAggression: 0.4, ultimateAggression: 0.55, decisionInterval: 0.26 },
  },
  dungeonbrute: {
    name: 'Dungeon Brute', health: 140, speed: 3.4,
    lightDamage: 6, mediumDamage: 10, heavyDamage: 18, skillDamage: 22, ultimateDamage: 34,
    color: 0x8a6a3a, headColor: 0xd4b896,
    archetype: { preferredRange: 1.85, aggression: 0.5, attackChance: 0.5, attackWeights: { light: 0.3, medium: 0.35, heavy: 0.35 }, blockChance: 0.3, evadeChance: 0.06, skillAggression: 0.35, ultimateAggression: 0.4, decisionInterval: 0.4 },
  },
  bladethrall: {
    name: 'Blade Thrall', health: 85, speed: 6.4,
    lightDamage: 4, mediumDamage: 7, heavyDamage: 12, skillDamage: 16, ultimateDamage: 28,
    color: 0x4a6ec9, headColor: 0xd4b896,
    archetype: { preferredRange: 1.6, aggression: 0.85, attackChance: 0.75, attackWeights: { light: 0.55, medium: 0.3, heavy: 0.15 }, blockChance: 0.1, evadeChance: 0.16, skillAggression: 0.5, ultimateAggression: 0.5, decisionInterval: 0.24 },
  },
  ironguard: {
    name: 'Iron Guard', health: 150, speed: 3.6,
    lightDamage: 5, mediumDamage: 9, heavyDamage: 16, skillDamage: 20, ultimateDamage: 30,
    color: 0x7a7a8a, headColor: 0xd4b896,
    archetype: { preferredRange: 1.85, aggression: 0.4, attackChance: 0.45, attackWeights: { light: 0.3, medium: 0.4, heavy: 0.3 }, blockChance: 0.45, evadeChance: 0.08, skillAggression: 0.35, ultimateAggression: 0.35, decisionInterval: 0.4 },
  },
  chainflagellant: {
    name: 'Chain Flagellant', health: 95, speed: 5.9,
    lightDamage: 5, mediumDamage: 8, heavyDamage: 13, skillDamage: 18, ultimateDamage: 29,
    color: 0xb03a5a, headColor: 0xd4b896,
    archetype: { preferredRange: 2.0, aggression: 0.7, attackChance: 0.7, attackWeights: { light: 0.4, medium: 0.35, heavy: 0.25 }, blockChance: 0.15, evadeChance: 0.16, skillAggression: 0.45, ultimateAggression: 0.5, decisionInterval: 0.28 },
  },
  sentinelhulk: {
    name: 'Sentinel Hulk', health: 180, speed: 2.9,
    lightDamage: 7, mediumDamage: 11, heavyDamage: 19, skillDamage: 24, ultimateDamage: 36,
    color: 0x6a5a3a, headColor: 0xd4b896,
    archetype: { preferredRange: 1.9, aggression: 0.45, attackChance: 0.5, attackWeights: { light: 0.25, medium: 0.35, heavy: 0.4 }, blockChance: 0.3, evadeChance: 0.04, skillAggression: 0.4, ultimateAggression: 0.4, decisionInterval: 0.42 },
  },
  shadowstalker: {
    name: 'Shadow Stalker', health: 80, speed: 7.0,
    lightDamage: 4, mediumDamage: 6, heavyDamage: 11, skillDamage: 15, ultimateDamage: 27,
    color: 0x5a4ac9, headColor: 0xd4b896,
    archetype: { preferredRange: 2.1, aggression: 0.6, attackChance: 0.65, attackWeights: { light: 0.5, medium: 0.3, heavy: 0.2 }, blockChance: 0.1, evadeChance: 0.25, skillAggression: 0.5, ultimateAggression: 0.55, decisionInterval: 0.24 },
  },
  hollowking: {
    name: 'The Hollow King', health: 220, speed: 4.2, isBoss: true,
    lightDamage: 7, mediumDamage: 11, heavyDamage: 20, skillDamage: 25, ultimateDamage: 40,
    color: 0x8a1f3a, headColor: 0xe8d4d4,
    archetype: { preferredRange: 2.0, aggression: 0.65, attackChance: 0.65, attackWeights: { light: 0.35, medium: 0.35, heavy: 0.3 }, blockChance: 0.3, evadeChance: 0.18, skillAggression: 0.5, ultimateAggression: 0.55, decisionInterval: 0.3 },
  },
  herald: {
    name: 'The Herald', health: 150, speed: 4.6, isBoss: true,
    lightDamage: 6, mediumDamage: 10, heavyDamage: 17, skillDamage: 21, ultimateDamage: 33,
    color: 0xc94a3a, headColor: 0xe8d4d4,
    archetype: { preferredRange: 1.9, aggression: 0.6, attackChance: 0.6, attackWeights: { light: 0.4, medium: 0.35, heavy: 0.25 }, blockChance: 0.25, evadeChance: 0.14, skillAggression: 0.45, ultimateAggression: 0.5, decisionInterval: 0.3 },
  },
};

export const PLAYER_TEAM = ['paladin', 'sistervow'];

// Ladder: each entry is a 2-character enemy team.
export const LADDER = [
  { teamName: 'The Brutes', members: ['dungeonbrute', 'bladethrall'] },
  { teamName: 'The Wardens', members: ['ironguard', 'chainflagellant'] },
  { teamName: 'The Colossi', members: ['sentinelhulk', 'shadowstalker'] },
  { teamName: 'The Hollow Court', members: ['hollowking', 'herald'] },
];
