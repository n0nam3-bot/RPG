export class UI {
  constructor() {
    this.p1Name = document.getElementById('p1-name');
    this.p1HealthFill = document.getElementById('p1-health-fill');
    this.p1MeterFill = document.getElementById('p1-meter-fill');
    this.p1Pips = document.getElementById('p1-pips');

    this.p2Name = document.getElementById('p2-name');
    this.p2HealthFill = document.getElementById('p2-health-fill');
    this.p2MeterFill = document.getElementById('p2-meter-fill');
    this.p2Pips = document.getElementById('p2-pips');

    this.roundTimer = document.getElementById('round-timer');
    this.ladderProgress = document.getElementById('ladder-progress');
    this.centerMsg = document.getElementById('center-msg');
    this.hint = document.getElementById('hud-hint');
    this._msgTimeout = null;
  }

  setNames(p1Name, p2Name) {
    this.p1Name.textContent = p1Name.toUpperCase();
    this.p2Name.textContent = p2Name.toUpperCase();
  }

  updateHealth(p1, p2) {
    this.p1HealthFill.style.width = `${Math.max(0, (p1.health / p1.maxHealth) * 100)}%`;
    this.p2HealthFill.style.width = `${Math.max(0, (p2.health / p2.maxHealth) * 100)}%`;
    this.p1MeterFill.style.width = `${(p1.meter / p1.maxMeter) * 100}%`;
    this.p2MeterFill.style.width = `${(p2.meter / p2.maxMeter) * 100}%`;
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

  setHint(text) {
    this.hint.textContent = text;
  }
}
