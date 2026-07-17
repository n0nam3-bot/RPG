import * as THREE from 'three';

const PLAYER_ATTACK_RADIUS = 2.0;

// Tracks which enemies have already been hit during the current swing so a
// single attack doesn't multi-hit every frame the hitbox is active.
const hitThisSwing = new Set();

export function resolvePlayerAttacks(player, enemies, onEnemyHit) {
  if (!player.attackHitboxActive) {
    hitThisSwing.clear();
    return;
  }
  const origin = player.getAttackWorldPosition();
  const dmg = player.getCurrentAttackDamage();
  for (const enemy of enemies) {
    if (!enemy.alive || hitThisSwing.has(enemy)) continue;
    const dist = enemy.group.position.distanceTo(origin);
    if (dist <= PLAYER_ATTACK_RADIUS) {
      hitThisSwing.add(enemy);
      enemy.takeHit(dmg);
      if (onEnemyHit) onEnemyHit(enemy, !enemy.alive, player.lastAttackWasHeavy);
    }
  }
}

// Finds the nearest living enemy within lock-on range, cycling on repeated presses.
export function findLockOnTarget(playerPos, enemies, currentTarget) {
  const living = enemies.filter(e => e.alive);
  if (living.length === 0) return null;

  living.sort((a, b) => a.group.position.distanceTo(playerPos) - b.group.position.distanceTo(playerPos));

  if (!currentTarget || !currentTarget.alive) return living[0];

  const idx = living.indexOf(currentTarget);
  if (idx === -1) return living[0];
  return living[(idx + 1) % living.length];
}

const PERFECT_DODGE_WINDOW = 0.28; // seconds before an attack lands
const PERFECT_DODGE_RANGE_MULT = 1.8;

// Rewards dodging just before an enemy's telegraphed attack actually lands —
// the core souls-like "read the tell, dodge through it" skill expression.
// Returns the enemy that was perfectly dodged, or null.
export function checkPerfectDodge(playerPos, enemies) {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const inWindup = enemy.state === 'windup' || enemy.state === 'grabWindup' || enemy.state === 'slamWindup';
    if (!inWindup) continue;
    if (enemy.stateTimer > PERFECT_DODGE_WINDOW) continue;

    const range = enemy.hasSlam && enemy.state === 'slamWindup' ? enemy.slamRadius : enemy.attackRange * PERFECT_DODGE_RANGE_MULT;
    if (enemy.distanceTo(playerPos) <= range) {
      return enemy;
    }
  }
  return null;
}
