export class UI {
  constructor() {
    this.healthFill = document.getElementById('health-fill');
    this.staminaFill = document.getElementById('stamina-fill');
    this.sanityFill = document.getElementById('sanity-fill');
    this.corruptionFill = document.getElementById('corruption-fill');
    this.armorReadout = document.getElementById('armor-readout');
    this.potionReadout = document.getElementById('potion-readout');
    this.floorReadout = document.getElementById('floor-readout');
    this.bossHud = document.getElementById('boss-hud');
    this.bossName = document.getElementById('boss-name');
    this.bossFill = document.getElementById('boss-fill');
    this.centerMsg = document.getElementById('center-msg');
    this.lockReticle = document.getElementById('lock-reticle');
    this.hint = document.getElementById('hud-hint');
    this._msgTimeout = null;
  }

  updatePlayerStats(player) {
    this.healthFill.style.width = `${(player.health / player.maxHealth) * 100}%`;
    this.staminaFill.style.width = `${(player.stamina / player.maxStamina) * 100}%`;
    this.sanityFill.style.width = `${(player.sanity / player.maxSanity) * 100}%`;
    this.corruptionFill.style.width = `${player.corruption}%`;
    this.armorReadout.textContent = `ARMOR: ${player.armorLabel}`;
    this.armorReadout.style.color = player.armorBroken ? '#c14a72' : '#b8974f';
    this.potionReadout.textContent = `FLASKS: ${player.potionCharges} / ${player.maxPotionCharges}`;
  }

  setFloor(current, total) {
    this.floorReadout.textContent = `FLOOR ${current} / ${total}`;
  }

  updateBoss(enemy) {
    if (!enemy || !enemy.alive) {
      this.bossHud.style.display = 'none';
      return;
    }
    this.bossHud.style.display = 'block';
    this.bossName.textContent = enemy.name.toUpperCase();
    this.bossFill.style.width = `${(enemy.health / enemy.maxHealth) * 100}%`;
  }

  showMessage(text, duration = 2200) {
    this.centerMsg.textContent = text;
    this.centerMsg.classList.add('show');
    clearTimeout(this._msgTimeout);
    this._msgTimeout = setTimeout(() => {
      this.centerMsg.classList.remove('show');
    }, duration);
  }

  setLockOn(active) {
    this.lockReticle.style.display = active ? 'block' : 'none';
  }

  setHint(text) {
    this.hint.textContent = text;
  }
}
