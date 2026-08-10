// roster.js — the arcade ladder. Each entry pairs a Fighter stat block with
// an AI archetype (approach behavior, block/evade reflexes, attack mix).
// Reuses the enemy identities from the earlier dungeon-crawl build for
// continuity, reframed as fighters.

export const ROSTER = [
  {
    def: { name: 'Dungeon Brute', health: 140, speed: 2.0, lightDamage: 8, heavyDamage: 18, specialDamage: 30, color: 0x5a4a3a },
    archetype: { preferredRange: 1.8, aggression: 0.5, attackChance: 0.5, attackMix: { heavy: 0.55 }, blockChance: 0.25, evadeChance: 0.05, specialAggression: 0.4, decisionInterval: 0.4 },
  },
  {
    def: { name: 'Blade Thrall', health: 85, speed: 4.0, lightDamage: 6, heavyDamage: 13, specialDamage: 26, color: 0x3a4a5a },
    archetype: { preferredRange: 1.6, aggression: 0.85, attackChance: 0.75, attackMix: { heavy: 0.25 }, blockChance: 0.1, evadeChance: 0.15, specialAggression: 0.5, decisionInterval: 0.28 },
  },
  {
    def: { name: 'Iron Guard', health: 150, speed: 2.3, lightDamage: 7, heavyDamage: 17, specialDamage: 28, color: 0x4a4a52 },
    archetype: { preferredRange: 1.8, aggression: 0.4, attackChance: 0.45, attackMix: { heavy: 0.5 }, blockChance: 0.45, evadeChance: 0.08, specialAggression: 0.35, decisionInterval: 0.4 },
  },
  {
    def: { name: 'Chain Flagellant', health: 95, speed: 3.6, lightDamage: 7, heavyDamage: 14, specialDamage: 27, color: 0x5a2a3a },
    archetype: { preferredRange: 2.0, aggression: 0.7, attackChance: 0.7, attackMix: { heavy: 0.3 }, blockChance: 0.15, evadeChance: 0.15, specialAggression: 0.5, decisionInterval: 0.3 },
  },
  {
    def: { name: 'Sentinel Hulk', health: 180, speed: 1.8, lightDamage: 9, heavyDamage: 20, specialDamage: 34, color: 0x35302a },
    archetype: { preferredRange: 1.9, aggression: 0.45, attackChance: 0.5, attackMix: { heavy: 0.65 }, blockChance: 0.3, evadeChance: 0.04, specialAggression: 0.45, decisionInterval: 0.42 },
  },
  {
    def: { name: 'Shadow Stalker', health: 80, speed: 4.6, lightDamage: 6, heavyDamage: 12, specialDamage: 25, color: 0x1a1a2a },
    archetype: { preferredRange: 2.1, aggression: 0.6, attackChance: 0.65, attackMix: { heavy: 0.2 }, blockChance: 0.1, evadeChance: 0.25, specialAggression: 0.55, decisionInterval: 0.26 },
  },
  {
    def: { name: 'The Hollow King', health: 260, speed: 2.8, lightDamage: 10, heavyDamage: 22, specialDamage: 40, color: 0x120a10, isBoss: true },
    archetype: { preferredRange: 2.0, aggression: 0.65, attackChance: 0.65, attackMix: { heavy: 0.4 }, blockChance: 0.3, evadeChance: 0.18, specialAggression: 0.6, decisionInterval: 0.3 },
  },
];

export const PLAYER_DEF = {
  name: 'The Paladin', health: 100, speed: 3.2, lightDamage: 7, heavyDamage: 15, specialDamage: 32,
  color: 0x2c2534, headColor: 0xcdc4b0,
};
