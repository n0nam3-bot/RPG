import * as THREE from 'three';

const PLAYER_ATTACK_RADIUS = 2.0;
const PLAYER_ATTACK_DAMAGE = 16;

// Tracks which enemies have already been hit during the current swing so a
// single attack doesn't multi-hit every frame the hitbox is active.
const hitThisSwing = new Set();

export function resolvePlayerAttacks(player, enemies, onEnemyKilled) {
  if (!player.attackHitboxActive) {
    hitThisSwing.clear();
    return;
  }
  const origin = player.getAttackWorldPosition();
  for (const enemy of enemies) {
    if (!enemy.alive || hitThisSwing.has(enemy)) continue;
    const dist = enemy.group.position.distanceTo(origin);
    if (dist <= PLAYER_ATTACK_RADIUS) {
      hitThisSwing.add(enemy);
      enemy.takeHit(PLAYER_ATTACK_DAMAGE);
      if (!enemy.alive && onEnemyKilled) onEnemyKilled(enemy);
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
