import * as THREE from 'three';

// Attack specs — startup (no hitbox), active (hitbox live), recovery
// (vulnerable). Real-time seconds instead of frame counts, but the same
// shape as actual fighting-game frame data.
const ATTACK_SPECS = {
  light:    { startup: 0.07, active: 0.07, recovery: 0.12, range: 1.6, knockback: 0.6 },
  medium:   { startup: 0.13, active: 0.09, recovery: 0.20, range: 1.75, knockback: 1.3 },
  heavy:    { startup: 0.22, active: 0.12, recovery: 0.34, range: 1.9, knockback: 2.6 },
  skill:    { startup: 0.18, active: 0.16, recovery: 0.28, range: 2.1, knockback: 2.0 },
  ultimate: { startup: 0.30, active: 0.24, recovery: 0.50, range: 2.6, knockback: 4.2 },
};

const SKILL_METER_COST = 30; // %, out of 100
const GRAVITY = -18;
const JUMP_VELOCITY = 6.2;

export class Fighter {
  constructor(scene, charKey, def, position, isPlayer = false) {
    this.scene = scene;
    this.charKey = charKey;
    this.def = def;
    this.name = def.name;
    this.isPlayer = isPlayer;
    this.isBoss = !!def.isBoss;

    this.maxHealth = def.health;
    this.health = def.health;
    this.moveSpeed = def.speed;

    this.maxMeter = 100;
    this.meter = 0;

    this.group = new THREE.Group();
    this.group.position.copy(position);
    scene.add(this.group);
    this._buildMesh();

    // idle, moving, jumping, attackWindup, attackActive, attackRecovery,
    // blocking, evading, hitstun, tagging, ko, benched
    this.state = 'idle';
    this.stateTimer = 0;
    this.currentAttackType = null;
    this.attackHitboxActive = false;
    this.attackTriggeredThisFrame = false;
    this.attackCooldown = 0;
    this.evadeCooldown = 0;
    this.invulnerable = false;
    this.blocking = false;

    this.velocityY = 0;
    this.groundY = position.y;

    this.comboHitsLanded = 0; // consecutive hits landed without opponent escaping hitstun

    this.bufferedAction = null;
    this.bufferedActionTimer = 0;

    this.facing = isPlayer ? 1 : -1; // +1 faces +X, -1 faces -X
    this.alive = true;
    this.hasHitThisSwing = false;
    this.benched = false; // true while the teammate is active instead
  }

  _buildMesh() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: this.def.color ?? 0x5a4a3a, roughness: 0.6 });
    const scale = this.isBoss ? 1.3 : 1.0;
    this.scale = scale;

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35 * scale, 1.1 * scale, 4, 8), bodyMat);
    body.position.y = 1.0 * scale;
    this.group.add(body);
    this.bodyMesh = body;

    const headMat = new THREE.MeshStandardMaterial({ color: this.def.headColor ?? 0xcdc4b0, roughness: 0.6 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28 * scale, 12, 12), headMat);
    head.position.y = 1.75 * scale;
    this.group.add(head);

    const weaponMat = new THREE.MeshStandardMaterial({ color: 0xaaa9a5, metalness: 0.8, roughness: 0.3 });
    const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9 * scale, 0.04), weaponMat);
    weapon.position.set(0.55 * scale, 1.1 * scale, 0.1);
    this.group.add(weapon);
    this.weaponMesh = weapon;

    if (this.isBoss) {
      const auraGeo = new THREE.RingGeometry(0.6, 0.75, 24);
      const auraMat = new THREE.MeshBasicMaterial({ color: 0x8a1f2b, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
      const aura = new THREE.Mesh(auraGeo, auraMat);
      aura.rotation.x = -Math.PI / 2;
      aura.position.y = 0.02;
      this.group.add(aura);
      this.auraMesh = aura;
    }

    this.attackOrigin = new THREE.Object3D();
    this.attackOrigin.position.set(0, 1.1, 0);
    this.group.add(this.attackOrigin);
  }

  getAttackWorldPosition() {
    const pos = new THREE.Vector3();
    this.attackOrigin.getWorldPosition(pos);
    return pos;
  }

  faceToward(targetX) {
    this.facing = targetX >= this.group.position.x ? 1 : -1;
    this.group.rotation.y = this.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  get canAct() {
    return this.state === 'idle' || this.state === 'moving' || this.state === 'jumping';
  }

  setVisible(visible) {
    this.group.visible = visible;
  }

  // Movement is purely along world X — a true 2D fighting plane. moveX is
  // -1..1 (left/right); facing is handled separately via faceToward().
  applyMovement(dt, moveX) {
    if (!this.canAct) return;
    if (Math.abs(moveX) > 0.05) {
      this.group.position.x += moveX * this.moveSpeed * dt;
      if (this.state !== 'jumping') this.state = 'moving';
    } else if (this.state === 'moving') {
      this.state = 'idle';
    }
  }

  tryJump() {
    if (this.state !== 'idle' && this.state !== 'moving') return false;
    this.state = 'jumping';
    this.velocityY = JUMP_VELOCITY;
    return true;
  }

  tryLight() {
    if (!this.canAct || this.attackCooldown > 0) return false;
    this._startAttack('light');
    return true;
  }

  tryMedium() {
    if (!this.canAct || this.attackCooldown > 0) return false;
    this._startAttack('medium');
    return true;
  }

  tryHeavy() {
    if (!this.canAct || this.attackCooldown > 0) return false;
    this._startAttack('heavy');
    return true;
  }

  trySkill() {
    if (!this.canAct || this.attackCooldown > 0 || this.meter < SKILL_METER_COST) return false;
    this.meter -= SKILL_METER_COST;
    this._startAttack('skill');
    return true;
  }

  tryUltimate() {
    if (!this.canAct || this.meter < this.maxMeter) return false;
    this.meter = 0;
    this._startAttack('ultimate');
    return true;
  }

  // Preferred entry point for player input — buffers into recovery instead
  // of dropping the input, so strings feel tight instead of laggy.
  inputAttack(type) {
    const fns = { light: () => this.tryLight(), medium: () => this.tryMedium(), heavy: () => this.tryHeavy(), skill: () => this.trySkill(), ultimate: () => this.tryUltimate() };
    const fired = fns[type]();
    if (!fired && this.state === 'attackRecovery') {
      this.bufferedAction = type;
      this.bufferedActionTimer = 0.18;
    }
  }

  tryEvade(directionAwayFromX) {
    if (!this.canAct || this.evadeCooldown > 0) return false;
    this.state = 'evading';
    this.stateTimer = 0.28;
    this.evadeCooldown = 0.65;
    this.invulnerable = true;
    setTimeout(() => { this.invulnerable = false; }, 300);
    const dir = this.group.position.x >= directionAwayFromX ? 1 : -1;
    this.group.position.x += dir * 2.4;
    return true;
  }

  setBlocking(held) {
    if (held && this.canAct) {
      this.blocking = true;
      this.state = 'blocking';
    } else if (!held && this.state === 'blocking') {
      this.blocking = false;
      this.state = 'idle';
    }
  }

  _startAttack(type) {
    const spec = ATTACK_SPECS[type];
    this.currentAttackType = type;
    this.state = 'attackWindup';
    this.stateTimer = spec.startup;
    this.attackTriggeredThisFrame = true;
    this.hasHitThisSwing = false;
    this.attackCooldown = spec.startup + spec.active + spec.recovery;
  }

  getCurrentAttackDamage() {
    if (!this.currentAttackType) return 0;
    const base = this.def[`${this.currentAttackType}Damage`] ?? 10;
    // Combo scaling: each consecutive hit (opponent still in hitstun when
    // this one landed) does progressively less, floor 35%.
    const scale = Math.max(0.35, 1 - (this.comboHitsLanded - 1) * 0.1);
    return base * scale;
  }

  getCurrentAttackRange() {
    return ATTACK_SPECS[this.currentAttackType]?.range ?? 1.6;
  }

  getCurrentAttackKnockback() {
    return ATTACK_SPECS[this.currentAttackType]?.knockback ?? 0.6;
  }

  // Returns { landed, blocked, ko }.
  takeHit(amount, { isUltimate = false, knockbackX = 0 } = {}) {
    if (this.invulnerable || !this.alive) return { landed: false, blocked: false, ko: false };

    let dmg = amount;
    const blockedThisHit = this.blocking && !isUltimate;
    if (blockedThisHit) {
      dmg *= 0.3;
    } else if (this.blocking && isUltimate) {
      dmg *= 0.75; // ultimates chip through a raised guard
    }

    this.health = Math.max(0, this.health - dmg);
    this.meter = Math.min(this.maxMeter, this.meter + dmg * 0.7);

    if (knockbackX !== 0) {
      const force = blockedThisHit ? knockbackX * 0.3 : knockbackX;
      this.group.position.x += force;
    }

    if (blockedThisHit) {
      this.stateTimer = 0.1;
    } else {
      this.state = 'hitstun';
      this.stateTimer = isUltimate ? 0.5 : 0.28;
    }

    if (this.health <= 0) {
      this._die();
      return { landed: true, blocked: blockedThisHit, ko: true };
    }
    return { landed: true, blocked: blockedThisHit, ko: false };
  }

  _die() {
    this.alive = false;
    this.state = 'ko';
    this.stateTimer = 0;
  }

  resetForNewMatch(position) {
    this.health = this.maxHealth;
    this.meter = 0;
    this.state = 'idle';
    this.stateTimer = 0;
    this.currentAttackType = null;
    this.attackHitboxActive = false;
    this.hasHitThisSwing = false;
    this.attackCooldown = 0;
    this.evadeCooldown = 0;
    this.invulnerable = false;
    this.blocking = false;
    this.alive = true;
    this.comboHitsLanded = 0;
    this.bufferedAction = null;
    this.bufferedActionTimer = 0;
    this.velocityY = 0;
    this.group.position.copy(position);
    this.group.position.y = this.groundY;
    this.bodyMesh.rotation.set(0, 0, 0);
    this.weaponMesh.rotation.set(0, 0, 0);
    this.weaponMesh.scale.setScalar(1.0);
    this.bodyMesh.material.transparent = false;
    this.bodyMesh.material.opacity = 1;
    this.setVisible(true);
  }

  // Called when tagged in — brief invulnerability so tag-ins aren't a free
  // punish, matching real tag-fighter conventions.
  tagIn() {
    this.benched = false;
    this.setVisible(true);
    this.state = 'idle';
    this.comboHitsLanded = 0;
    this.invulnerable = true;
    setTimeout(() => { this.invulnerable = false; }, 250);
  }

  tagOut() {
    this.benched = true;
    this.setVisible(false);
    this.blocking = false;
  }

  // ================= Update =================
  update(dt) {
    this.attackTriggeredThisFrame = false;

    if (this.benched) return;

    if (this.state === 'ko') {
      this.group.position.y = Math.max(this.group.position.y - dt * 1.2, this.groundY - 0.4);
      this.bodyMesh.rotation.z = THREE.MathUtils.lerp(this.bodyMesh.rotation.z, Math.PI / 2, dt * 4);
      return;
    }

    if (this.auraMesh) this.auraMesh.rotation.z += dt * 0.6;

    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.evadeCooldown > 0) this.evadeCooldown -= dt;

    // Jump physics
    if (this.state === 'jumping') {
      this.velocityY += GRAVITY * dt;
      this.group.position.y += this.velocityY * dt;
      if (this.group.position.y <= this.groundY) {
        this.group.position.y = this.groundY;
        this.velocityY = 0;
        this.state = 'idle';
      }
    }

    if (this.state === 'attackWindup') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = 'attackActive';
        this.stateTimer = ATTACK_SPECS[this.currentAttackType].active;
        this.attackHitboxActive = true;
      }
    } else if (this.state === 'attackActive') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.attackHitboxActive = false;
        this.state = 'attackRecovery';
        this.stateTimer = ATTACK_SPECS[this.currentAttackType].recovery;
      }
    } else if (this.state === 'attackRecovery') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = 'idle';
        this.currentAttackType = null;
        if (this.bufferedAction) {
          const action = this.bufferedAction;
          this.bufferedAction = null;
          this.inputAttack(action);
        }
      }
    } else if (this.state === 'evading' || this.state === 'hitstun') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.state = 'idle';
    } else if (this.state === 'blocking') {
      if (this.stateTimer > 0) this.stateTimer -= dt;
    }

    if (this.bufferedActionTimer > 0) {
      this.bufferedActionTimer -= dt;
      if (this.bufferedActionTimer <= 0) this.bufferedAction = null;
    }

    // Animation
    const baseY = this.groundY + (this.isBoss ? 1.3 : 1.0) * this.scale;
    if (this.state === 'moving') {
      this.bodyMesh.position.y = baseY + Math.sin(performance.now() * 0.012) * 0.03;
    } else {
      this.bodyMesh.position.y = baseY;
    }

    if (this.state === 'attackWindup' || this.state === 'attackActive') {
      const spec = ATTACK_SPECS[this.currentAttackType];
      const totalDur = spec.startup + spec.active;
      const elapsed = totalDur - (this.state === 'attackWindup' ? this.stateTimer + spec.active : this.stateTimer);
      const t = Math.max(0, Math.min(1, elapsed / totalDur));
      const arc = this.currentAttackType === 'heavy' ? 3.0 : this.currentAttackType === 'ultimate' ? 3.8 : this.currentAttackType === 'skill' ? 3.2 : this.currentAttackType === 'medium' ? 2.5 : 2.0;
      const startAngle = this.currentAttackType === 'ultimate' ? -1.9 : -1.2;
      this.weaponMesh.rotation.z = startAngle + t * arc;
      const scaleAmt = this.currentAttackType === 'ultimate' ? 1.7 : this.currentAttackType === 'skill' ? 1.4 : this.currentAttackType === 'heavy' ? 1.3 : 1.0;
      this.weaponMesh.scale.setScalar(scaleAmt);
    } else if (this.state === 'blocking') {
      this.weaponMesh.rotation.z = -1.65;
      this.weaponMesh.rotation.x = -0.3;
      this.weaponMesh.scale.setScalar(1.0);
    } else {
      this.weaponMesh.rotation.z = 0;
      this.weaponMesh.rotation.x = 0;
      this.weaponMesh.scale.setScalar(1.0);
    }

    this.group.rotation.y = this.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
}
