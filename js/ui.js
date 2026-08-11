export class UI {
  constructor() {
    this.p1Name = document.getElementById('p1-name');
    this.p1HealthFill = document.getElementById('p1-health-fill');
    this.p1HealthTrail = document.getElementById('p1-health-trail');
    this.p1MeterFill = document.getElementById('p1-meter-fill');
    this.p1Pips = document.getElementById('p1-pips');

    this.p2Name = document.getElementById('p2-name');
    this.p2HealthFill = document.getElementById('p2-health-fill');
    this.p2HealthTrail = document.getElementById('p2-health-trail');
    this.p2MeterFill = document.getElementById('p2-meter-fill');
    this.p2Pips = document.getElementById('p2-pips');

    this.roundTimer = document.getElementById('round-timer');
    this.ladderProgress = document.getElementById('ladder-progress');
    this.centerMsg = document.getElementById('center-msg');
    this.comboCounter = document.getElementById('combo-counter');
    this.hint = document.getElementById('hud-hint');
    this._msgTimeout = null;

    // Damage-trail bars lag behind the real health % and drain down to meet
    // it over time — the classic Street Fighter/Tekken "recent damage" cue.
    this.p1TrailPct = 100;
    this.p2TrailPct = 100;
  }

  setNames(p1Name, p2Name) {
    this.p1Name.textContent = p1Name.toUpperCase();
    this.p2Name.textContent = p2Name.toUpperCase();
  }

  resetTrails() {
    this.p1TrailPct = 100;
    this.p2TrailPct = 100;
  }

  updateHealth(p1, p2) {
    const p1Pct = Math.max(0, (p1.health / p1.maxHealth) * 100);
    const p2Pct = Math.max(0, (p2.health / p2.maxHealth) * 100);
    this.p1HealthFill.style.width = `${p1Pct}%`;
    this.p2HealthFill.style.width = `${p2Pct}%`;
    this.p1MeterFill.style.width = `${(p1.meter / p1.maxMeter) * 100}%`;
    this.p2MeterFill.style.width = `${(p2.meter / p2.maxMeter) * 100}%`;

    // Trail can only ever be caught by the real bar, never fall behind it
    // (e.g. after a heal or round reset) — snap up if that happens.
    if (this.p1TrailPct < p1Pct) this.p1TrailPct = p1Pct;
    if (this.p2TrailPct < p2Pct) this.p2TrailPct = p2Pct;
    this._p1TargetPct = p1Pct;
    this._p2TargetPct = p2Pct;
  }

  // Call once per frame with dt to decay the trail bars toward current health.
  tick(dt) {
    const decayRate = 40; // % per second
    if (this.p1TrailPct > (this._p1TargetPct ?? 100)) {
      this.p1TrailPct = Math.max(this._p1TargetPct, this.p1TrailPct - decayRate * dt);
      this.p1HealthTrail.style.width = `${this.p1TrailPct}%`;
    }
    if (this.p2TrailPct > (this._p2TargetPct ?? 100)) {
      this.p2TrailPct = Math.max(this._p2TargetPct, this.p2TrailPct - decayRate * dt);
      this.p2HealthTrail.style.width = `${this.p2TrailPct}%`;
    }
  }

  setRoundPips(p1Wins, p2Wins, winsNeeded) {
    this._renderPips(this.p1Pips, p1Wins, winsNeeded);
    this._renderPips(this.p2Pips, p2Wins, winsNeeded);
  }

  _renderPips(container, wins, total) {
    container.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const pip = document.createElement('div');
      pip.className = 'pip' + (i < wins ? ' won' : '');
      container.appendChild(pip);
    }
  }

  setTimer(seconds) {
    this.roundTimer.textContent = Math.max(0, Math.ceil(seconds));
    this.roundTimer.style.color = seconds <= 10 ? '#c23b46' : '#cdc4b0';
  }

  setLadderProgress(current, total) {
    this.ladderProgress.textContent = `FIGHTER ${current} / ${total}`;
  }

  showMessage(text, duration = 1800) {
    this.centerMsg.textContent = text;
    this.centerMsg.classList.add('show');
    clearTimeout(this._msgTimeout);
    if (duration > 0) {
      this._msgTimeout = setTimeout(() => this.centerMsg.classList.remove('show'), duration);
    }
  }

  hideMessage() {
    this.centerMsg.classList.remove('show');
  }

  showCombo(count) {
    if (count < 2) {
      this.comboCounter.classList.remove('show');
      return;
    }
    this.comboCounter.textContent = `${count} HIT COMBO`;
    this.comboCounter.classList.add('show');
  }

  hideCombo() {
    this.comboCounter.classList.remove('show');
  }

  setHint(text) {
    this.hint.textContent = text;
  }
}
