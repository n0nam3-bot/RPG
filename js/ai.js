// ai.js — lightweight decision-timer AI for opponent fighters. Not
// frame-perfect fighting-game AI, but enough archetype variety (rushdown,
// zoner, grappler, boss) to make the ladder feel distinct fight-to-fight.

export class FighterAI {
  constructor(fighter, archetype) {
    this.fighter = fighter;
    this.archetype = archetype;
    this.decisionTimer = 0;
    this.moveX = 0;
    this.moveY = 0;
  }

  update(dt, opponent) {
    const fighter = this.fighter;
    if (!fighter.alive || fighter.state === 'ko') return;

    fighter.faceToward(opponent.group.position);
    const dist = fighter.group.position.distanceTo(opponent.group.position);

    // Reactive evade: opponent mid-swing and close — chance to dodge out.
    const opponentSwinging = opponent.state === 'attackWindup' || opponent.state === 'attackActive';
    if (opponentSwinging && dist < opponent.getCurrentAttackRange() * 1.3 && fighter.canAct) {
      if (Math.random() < this.archetype.evadeChance) {
        fighter.tryEvade(opponent.group.position);
      }
    }

    // Reactive block: opponent threatening and close — chance to raise guard.
    const oppThreatening = opponentSwinging && dist < 3.2;
    if (oppThreatening && fighter.canAct) {
      fighter.setBlocking(Math.random() < this.archetype.blockChance);
    } else if (fighter.state === 'blocking') {
      fighter.setBlocking(false);
    }

    this.decisionTimer -= dt;
    if (this.decisionTimer <= 0) {
      this.decisionTimer = this.archetype.decisionInterval ?? 0.35;
      this._decideMovementAndAttack(dist, opponent);
    }

    if (fighter.canAct || fighter.state === 'moving') {
      fighter.applyMovement(dt, this.moveX, this.moveY);
    }
  }

  _decideMovementAndAttack(dist, opponent) {
    const fighter = this.fighter;
    const a = this.archetype;

    if (dist > a.preferredRange) {
      this.moveY = 1;
      this.moveX = (Math.random() - 0.5) * 0.5;
    } else if (dist < a.preferredRange * 0.55) {
      this.moveY = Math.random() < a.aggression ? 0.2 : -1;
      this.moveX = (Math.random() - 0.5) * 1.4;
    } else {
      this.moveY = 0;
      this.moveX = (Math.random() < 0.5 ? 1 : -1) * 0.9; // circle at range
    }

    if (dist <= 1.9 && fighter.canAct) {
      if (fighter.meter >= fighter.maxMeter && Math.random() < a.specialAggression) {
        fighter.trySpecial();
      } else if (Math.random() < a.attackChance) {
        if (Math.random() < a.attackMix.heavy) fighter.tryHeavy();
        else fighter.tryLight();
      }
    }
  }
}
