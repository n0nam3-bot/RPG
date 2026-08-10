// combat.js — resolves whether an attacking fighter's active hitbox connects
// with the defending fighter this frame. One hit per swing (attackActive
// window), matching the frame-data model in fighter.js.

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
    const result = defender.takeHit(dmg, { isSpecial });
    if (onResult) onResult(result, attacker.currentAttackType);
  }
}
