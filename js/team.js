// team.js — a 2-character team. Tracks which fighter is active vs benched,
// handles player/AI-initiated tags, and mandatory auto-tag when the active
// fighter is KO'd but the teammate still has health.

export class Team {
  constructor(fighters) {
    this.fighters = fighters; // [fighter0, fighter1]
    this.activeIndex = 0;
    fighters[0].tagIn();
    fighters[1].tagOut();
  }

  get active() { return this.fighters[this.activeIndex]; }
  get reserve() { return this.fighters[1 - this.activeIndex]; }

  get isDefeated() {
    return this.fighters.every(f => !f.alive);
  }

  // Player/AI-requested tag — only allowed while the active fighter can act
  // and the reserve is alive.
  tryTag() {
    if (!this.reserve.alive) return false;
    if (!this.active.canAct) return false;
    this._swap();
    return true;
  }

  // Called every frame by main.js; auto-swaps in the reserve the instant
  // the active fighter is KO'd, if possible. Returns true if a swap just
  // happened (so callers can trigger tag-in feedback/audio).
  checkMandatoryTag() {
    if (!this.active.alive && this.reserve.alive) {
      this._swap();
      return true;
    }
    return false;
  }

  _swap() {
    const outgoing = this.active;
    const incoming = this.reserve;
    outgoing.tagOut();
    this.activeIndex = 1 - this.activeIndex;
    incoming.tagIn();
    // Incoming fighter enters at roughly the same spot the outgoing one held.
    incoming.group.position.x = outgoing.group.position.x;
  }

  resetForNewMatch(positions) {
    this.activeIndex = 0;
    this.fighters[0].resetForNewMatch(positions[0]);
    this.fighters[1].resetForNewMatch(positions[1]);
    this.fighters[0].tagIn();
    this.fighters[1].tagOut();
  }
}
