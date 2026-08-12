// ai.js — decision-timer AI. FighterAI drives a single active fighter's
// movement/attack choices; shouldAITag() is a separate team-level check
// used by main.js to decide when the AI's bench character tags in.

export class FighterAI {
  constructor(fighter, archetype) {
    this.fighter = fighter;
    this.archetype = archetype;
    this.decisionTimer = 0;
    this.moveX = 0;
  }

  update(dt, opponent) {
    const fighter = this.fighter;
    if (!fighter.alive || fighter.state === 'ko' || fighter.benched) return;

    fighter.faceToward(opponent.group.position.x);
    const dist = Math.abs(fighter.group.position.x - opponent.group.position.x);

    const opponentSwinging = opponent.state === 'attackWindup' || opponent.state === 'attackActive';
    if (opponentSwinging && dist < opponent.getCurrentAttackRange() * 1.3 && fighter.canAct) {
      if (Math.random() < this.archetype.evadeChance) {
        fighter.tryEvade(opponent.group.position.x);
      }
    }

    const oppThreatening = opponentSwinging && dist < 3.0;
    if (oppThreatening && fighter.canAct) {
      fighter.setBlocking(Math.random() < this.archetype.blockChance);
    } else if (fighter.state === 'blocking') {
      fighter.setBlocking(false);
    }

    this.decisionTimer -= dt;
    if (this.decisionTimer <= 0) {
      this.decisionTimer = this.archetype.decisionInterval ?? 0.32;
      this._decide(dist, opponent);
    }

    if (fighter.canAct) fighter.applyMovement(dt, this.moveX);
  }

  _decide(dist, opponent) {
    const fighter = this.fighter;
    const a = this.archetype;

    if (dist > a.preferredRange) {
      this.moveX = fighter.group.position.x < opponent.group.position.x ? 1 : -1;
    } else if (dist < a.preferredRange * 0.5) {
      this.moveX = Math.random() < a.aggression ? 0 : (fighter.group.position.x < opponent.group.position.x ? -1 : 1);
    } else {
      this.moveX = 0;
    }

    if (dist <= 1.9 && fighter.canAct) {
      if (fighter.meter >= fighter.maxMeter && Math.random() < a.ultimateAggression) {
        fighter.tryUltimate();
        return;
      }
      if (fighter.meter >= 30 && Math.random() < a.skillAggression) {
        fighter.trySkill();
        return;
      }
      if (Math.random() < a.attackChance) {
        const r = Math.random();
        const w = a.attackWeights;
        if (r < w.light) fighter.tryLight();
        else if (r < w.light + w.medium) fighter.tryMedium();
        else fighter.tryHeavy();
      }
    } else if (dist > a.preferredRange * 1.4 && Math.random() < 0.08) {
      fighter.tryJump(); // occasional approach jump
    }
  }
}

// Team-level: should the AI's bench fighter tag in right now?
export function shouldAITag(active, reserve) {
  if (!reserve || !reserve.alive || reserve.benched === false) return false;
  if (!active.alive) return true; // handled as mandatory elsewhere, but safe
  const activeLow = active.health / active.maxHealth < 0.22;
  const reserveHealthier = reserve.health > active.health + 15;
  return activeLow && reserveHealthier && Math.random() < 0.02; // low per-frame chance, checked often
}
