export class UI {
  constructor() {
    this.p1Name = document.getElementById('p1-name');
    this.p1HealthFill = document.getElementById('p1-health-fill');
    this.p1HealthTrail = document.getElementById('p1-health-trail');
    this.p1ReserveFill = document.getElementById('p1r-health-fill');
    this.p1ReserveName = document.getElementById('p1r-name');
    this.p1MeterFill = document.getElementById('p1-meter-fill');
    this.p1SkillChip = document.getElementById('p1-skill-chip');
    this.p1TagChip = document.getElementById('p1-tag-chip');

    this.p2Name = document.getElementById('p2-name');
    this.p2HealthFill = document.getElementById('p2-health-fill');
    this.p2HealthTrail = document.getElementById('p2-health-trail');
    this.p2ReserveFill = document.getElementById('p2r-health-fill');
    this.p2ReserveName = document.getElementById('p2r-name');
    this.p2MeterFill = document.getElementById('p2-meter-fill');

    this.matchTimer = document.getElementById('match-timer');
    this.ladderProgress = document.getElementById('ladder-progress');
    this.centerMsg = document.getElementById('center-msg');
    this.comboCounter = document.getElementById('combo-counter');
    this.hint = document.getElementById('hud-hint');
    this._msgTimeout = null;

    this.p1TrailPct = 100;
    this.p2TrailPct = 100;
  }

  setNames(p1Active, p1Reserve, p2Active, p2Reserve) {
    this.p1Name.textContent = p1Active.toUpperCase();
    this.p1ReserveName.textContent = p1Reserve.toUpperCase();
    this.p2Name.textContent = p2Active.toUpperCase();
    this.p2ReserveName.textContent = p2Reserve.toUpperCase();
  }

  resetTrails() {
    this.p1TrailPct = 100;
    this.p2TrailPct = 100;
  }

  updateHealth(p1Team, p2Team) {
    const p1 = p1Team.active, p1r = p1Team.reserve;
    const p2 = p2Team.active, p2r = p2Team.reserve;

    const p1Pct = Math.max(0, (p1.health / p1.maxHealth) * 100);
    const p2Pct = Math.max(0, (p2.health / p2.maxHealth) * 100);
    this.p1HealthFill.style.width = `${p1Pct}%`;
    this.p2HealthFill.style.width = `${p2Pct}%`;
    this.p1ReserveFill.style.width = `${Math.max(0, (p1r.health / p1r.maxHealth) * 100)}%`;
    this.p2ReserveFill.style.width = `${Math.max(0, (p2r.health / p2r.maxHealth) * 100)}%`;
    this.p1MeterFill.style.width = `${(p1.meter / p1.maxMeter) * 100}%`;
    this.p2MeterFill.style.width = `${(p2.meter / p2.maxMeter) * 100}%`;

    if (this.p1TrailPct < p1Pct) this.p1TrailPct = p1Pct;
    if (this.p2TrailPct < p2Pct) this.p2TrailPct = p2Pct;
    this._p1Target = p1Pct;
    this._p2Target = p2Pct;

    this.p1SkillChip.classList.toggle('ready', p1.meter >= 30 && p1.canAct);
    this.p1TagChip.classList.toggle('ready', p1r.alive && p1.canAct);
  }

  tick(dt) {
    const decayRate = 40;
    if (this.p1TrailPct > (this._p1Target ?? 100)) {
      this.p1TrailPct = Math.max(this._p1Target, this.p1TrailPct - decayRate * dt);
      this.p1HealthTrail.style.width = `${this.p1TrailPct}%`;
    }
    if (this.p2TrailPct > (this._p2Target ?? 100)) {
      this.p2TrailPct = Math.max(this._p2Target, this.p2TrailPct - decayRate * dt);
      this.p2HealthTrail.style.width = `${this.p2TrailPct}%`;
    }
  }

  setTimer(seconds) {
    this.matchTimer.textContent = Math.max(0, Math.ceil(seconds));
    this.matchTimer.style.color = seconds <= 20 ? '#c23b46' : '#cdc4b0';
  }

  setLadderProgress(current, total) {
    this.ladderProgress.textContent = `TEAM ${current} / ${total}`;
  }

  showMessage(text, duration = 1800) {
    this.centerMsg.textContent = text;
    this.centerMsg.classList.add('show');
    clearTimeout(this._msgTimeout);
    if (duration > 0) this._msgTimeout = setTimeout(() => this.centerMsg.classList.remove('show'), duration);
  }

  hideMessage() { this.centerMsg.classList.remove('show'); }

  showCombo(count) {
    if (count < 2) { this.comboCounter.classList.remove('show'); return; }
    this.comboCounter.textContent = `${count} HIT COMBO`;
    this.comboCounter.classList.add('show');
  }

  hideCombo() { this.comboCounter.classList.remove('show'); }

  setHint(text) { this.hint.textContent = text; }
}
