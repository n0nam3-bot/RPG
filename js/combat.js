// combat.js — resolves whether an attacker's active hitbox connects with
// the defender this frame. Tracks combo continuation (was the defender
// already in hitstun when this hit landed?) so Fighter.getCurrentAttackDamage
// can apply combo scaling.

export function resolveAttack(attacker, defender, onResult) {
  if (attacker.benched || defender.benched) return;
  if (!attacker.attackHitboxActive || attacker.hasHitThisSwing) return;
  if (!defender.alive) return;

  const origin = attacker.getAttackWorldPosition();
  const dist = Math.abs(origin.x - defender.group.position.x);
  const range = attacker.getCurrentAttackRange();

  if (dist <= range) {
    attacker.hasHitThisSwing = true;

    const wasAlreadyStunned = defender.state === 'hitstun';
    attacker.comboHitsLanded = wasAlreadyStunned ? attacker.comboHitsLanded + 1 : 1;

    const dmg = attacker.getCurrentAttackDamage();
    const isUltimate = attacker.currentAttackType === 'ultimate';
    const knockbackForce = attacker.getCurrentAttackKnockback();
    const knockbackX = defender.group.position.x >= attacker.group.position.x ? knockbackForce : -knockbackForce;

    const result = defender.takeHit(dmg, { isUltimate, knockbackX });

    const hitPointX = (origin.x + defender.group.position.x) / 2;
    const hitPoint = { x: hitPointX, y: 1.2, z: 0 };

    if (onResult) onResult(result, attacker.currentAttackType, hitPoint);
  }
}
