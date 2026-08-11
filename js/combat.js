import * as THREE from 'three';

// combat.js — resolves whether an attacking fighter's active hitbox connects
// with the defending fighter this frame. One hit per swing (attackActive
// window), matching the frame-data model in fighter.js. Also computes
// knockback direction and reports the hit point for FX/audio callers.

export function resolveAttack(attacker, defender, onResult) {
  if (!attacker.attackHitboxActive || attacker.hasHitThisSwing) return;
  if (!defender.alive) return;

  const origin = attacker.getAttackWorldPosition();
  const dist = origin.distanceTo(defender.group.position);
  const range = attacker.getCurrentAttackRange();

  if (dist <= range) {
    attacker.hasHitThisSwing = true;
    const dmg = attacker.getCurrentAttackDamage();
    const isSpecial = attacker.currentAttackType === 'special';

    const knockbackDir = new THREE.Vector3().subVectors(defender.group.position, attacker.group.position);
    knockbackDir.y = 0;
    if (knockbackDir.lengthSq() < 0.0001) knockbackDir.set(0, 0, 1);
    knockbackDir.normalize();
    const knockbackForce = attacker.getCurrentAttackKnockback();

    const result = defender.takeHit(dmg, { isSpecial, knockbackDir, knockbackForce });

    // Hit point roughly at the midpoint between attacker's weapon and the
    // defender, raised to chest height — good enough for a spark burst.
    const hitPoint = origin.clone().lerp(defender.group.position, 0.5);
    hitPoint.y = 1.2;

    if (onResult) onResult(result, attacker.currentAttackType, hitPoint);
  }
}
