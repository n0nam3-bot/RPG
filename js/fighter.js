import * as THREE from 'three';

// Attack specs shared by every fighter — startup (no hitbox), active (hitbox
// live), recovery (vulnerable, can't act). Classic fighting-game frame data,
// simplified to real-time seconds instead of frame counts.
const ATTACK_SPECS = {
  light: { startup: 0.09, active: 0.09, recovery: 0.16, range: 1.7, meterGain: 6, knockback: 0.9 },
  heavy: { startup: 0.2, active: 0.12, recovery: 0.32, range: 1.95, meterGain: 12, knockback: 2.4 },
  special: { startup: 0.28, active: 0.22, recovery: 0.45, range: 2.4, meterGain: 0, knockback: 4.0 },
};

// Combo scaling: each successive light in a chain does less damage so
// strings can't be infinitely repeated for full damage.
const COMBO_SCALING = [1.0, 0.82, 0.66];

export class Fighter {
  constructor(scene, def, position, isPlayer = false) {
    this.scene = scene;
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

    // ===== State machine =====
    // idle, moving, attackWindup, attackActive, attackRecovery, blocking,
    // evading, hitstun, ko
    this.state = 'idle';
    this.stateTimer = 0;
    this.currentAttackType = null; // 'light' | 'heavy' | 'special'
    this.attackHitboxActive = false;
    this.attackTriggeredThisFrame = false;
    this.comboStep = 0;
    this.attackCooldown = 0;
    this.evadeCooldown = 0;
    this.invulnerable = false;
    this.blocking = false;

    // Input buffer: an attack pressed during recovery queues up and fires
    // the instant recovery ends, instead of being dropped — this is what
    // makes fighting-game controls feel responsive instead of laggy.
    this.bufferedAction = null;
    this.bufferedActionTimer = 0;

    this.facing = isPlayer ? Math.PI : 0; // face roughly toward the other fighter's default side
    this.alive = true;
    this.hasHitThisSwing = false; // combat.js clears this per attack window
  }

  _buildMesh() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: this.def.color ?? 0x5a4a3a, roughness: 0.6 });
    const scale = this.isBoss ? 1.3 : 1.0;

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
    this.attackOrigin.position.set(0, 1.1, -1.0);
    this.group.add(this.attackOrigin);
  }

  getAttackWorldPosition() {
    const pos = new THREE.Vector3();
    this.attackOrigin.getWorldPosition(pos);
    return pos;
  }

  faceToward(targetPos) {
    const dx = targetPos.x - this.group.position.x;
    const dz = targetPos.z - this.group.position.z;
    this.facing = Math.atan2(dx, dz);
    this.group.rotation.y = this.facing;
  }

  get canAct() {
    return this.state === 'idle' || this.state === 'moving';
  }

  // moveY: positive = toward opponent (along facing), negative = retreat.
  // moveX: perpendicular strafe/circle. Both already fight-axis-relative,
  // computed by the caller (main.js) from the vector between fighters.
  applyMovement(dt, moveX, moveY) {
    if (!this.canAct) return;
    const fwd = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    const right = new THREE.Vector3(Math.cos(this.facing), 0, -Math.sin(this.facing));
    const move = new THREE.Vector3().addScaledVector(fwd, moveY).addScaledVector(right, moveX);
    if (move.lengthSq() > 0.0009) {
      move.normalize();
      this.group.position.addScaledVector(move, this.moveSpeed * dt);
      this.state = 'moving';
    } else if (this.state === 'moving') {
      this.state = 'idle';
    }
  }

  tryLight() {
    if (!this.canAct || this.attackCooldown > 0) return false;
    this._startAttack('light');
    return true;
  }

  tryHeavy() {
    if (!this.canAct || this.attackCooldown > 0) return false;
    this._startAttack('heavy');
    this.comboStep = 0; // heavy resets the light string
    return true;
  }

  trySpecial() {
    if (!this.canAct || this.meter < this.maxMeter) return false;
    this.meter = 0;
    this._startAttack('special');
    return true;
  }

  // Preferred entry point for player-controlled input: if the attack can't
  // fire right now but we're in recovery, buffer it to fire the instant
  // recovery ends instead of just dropping the input on the floor.
  inputAttack(type) {
    const fired = type === 'light' ? this.tryLight() : type === 'heavy' ? this.tryHeavy() : this.trySpecial();
    if (!fired && this.state === 'attackRecovery') {
      this.bufferedAction = type;
      this.bufferedActionTimer = 0.18;
    }
  }

  tryEvade(awayFromPos) {
    if (!this.canAct || this.evadeCooldown > 0) return false;
    this.state = 'evading';
    this.stateTimer = 0.3;
    this.evadeCooldown = 0.7;
    this.invulnerable = true;
    setTimeout(() => { this.invulnerable = false; }, 320);
    const dir = new THREE.Vector3().subVectors(this.group.position, awayFromPos);
    dir.y = 0;
    if (dir.lengthSq() < 0.0001) dir.set(Math.sin(this.facing + Math.PI), 0, Math.cos(this.facing + Math.PI));
    dir.normalize();
    this.group.position.addScaledVector(dir, 2.6);
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
    if (type === 'light') this.comboStep = Math.min(this.comboStep + 1, COMBO_SCALING.length - 1);
  }

  getCurrentAttackDamage() {
    if (!this.currentAttackType) return 0;
    const base = this.def[`${this.currentAttackType}Damage`] ?? 10;
    const scale = this.currentAttackType === 'light' ? COMBO_SCALING[this.comboStep] : 1.0;
    return base * scale;
  }

  getCurrentAttackRange() {
    return ATTACK_SPECS[this.currentAttackType]?.range ?? 1.7;
  }

  getCurrentAttackKnockback() {
    return ATTACK_SPECS[this.currentAttackType]?.knockback ?? 0.8;
  }

  // Returns { landed, blocked, ko }. landed=false means i-frames/dead
  // absorbed it entirely — caller should skip all feedback.
  takeHit(amount, { isSpecial = false, knockbackDir = null, knockbackForce = 0 } = {}) {
    if (this.invulnerable || !this.alive) return { landed: false, blocked: false, ko: false };

    let dmg = amount;
    const blockedThisHit = this.blocking && !isSpecial;
    if (blockedThisHit) {
      dmg *= 0.3; // block cuts normal/heavy damage a lot
    } else if (this.blocking && isSpecial) {
      dmg *= 0.75; // specials still chip through a raised guard
    }

    this.health = Math.max(0, this.health - dmg);
    this.meter = Math.min(this.maxMeter, this.meter + dmg * 0.7);

    if (knockbackDir && knockbackForce > 0) {
      const force = blockedThisHit ? knockbackForce * 0.3 : knockbackForce;
      this.group.position.addScaledVector(knockbackDir, force);
    }

    if (blockedThisHit) {
      // Absorbed by the guard — brief blockstun, stays in blocking state,
      // no combo-breaking stagger.
      this.stateTimer = 0.12;
    } else {
      this.state = 'hitstun';
      this.stateTimer = isSpecial ? 0.55 : 0.3;
      this.comboStep = 0;
      this.invulnerable = false; // hit fighters aren't invulnerable, just stunned
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

  resetForNewRound(position) {
    this.health = this.maxHealth;
    this.meter = 0;
    this.state = 'idle';
    this.stateTimer = 0;
    this.comboStep = 0;
    this.currentAttackType = null;
    this.attackHitboxActive = false;
    this.hasHitThisSwing = false;
    this.attackCooldown = 0;
    this.evadeCooldown = 0;
    this.invulnerable = false;
    this.blocking = false;
    this.alive = true;
    this.bufferedAction = null;
    this.bufferedActionTimer = 0;
    this.group.position.copy(position);
    this.bodyMesh.rotation.set(0, 0, 0);
    this.weaponMesh.rotation.set(0, 0, 0);
    this.weaponMesh.scale.setScalar(1.0);
    this.bodyMesh.material.transparent = false;
    this.bodyMesh.material.opacity = 1;
  }

  // ================= Update =================
  update(dt) {
    this.attackTriggeredThisFrame = false;

    if (this.state === 'ko') {
      this.group.position.y = Math.max(this.group.position.y - dt * 1.2, -0.4);
      this.bodyMesh.rotation.z = THREE.MathUtils.lerp(this.bodyMesh.rotation.z, Math.PI / 2, dt * 4);
      return;
    }

    if (this.auraMesh) this.auraMesh.rotation.z += dt * 0.6;

    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.evadeCooldown > 0) this.evadeCooldown -= dt;

    // Attack phase progression
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
      // held externally via setBlocking(); stateTimer just tracks blockstun
      if (this.stateTimer > 0) this.stateTimer -= dt;
    }

    if (this.bufferedActionTimer > 0) {
      this.bufferedActionTimer -= dt;
      if (this.bufferedActionTimer <= 0) this.bufferedAction = null;
    }

    // Animation
    if (this.state === 'moving') {
      this.bodyMesh.position.y = (this.isBoss ? 1.3 : 1.0) + Math.sin(performance.now() * 0.012) * 0.03;
    } else {
      this.bodyMesh.position.y = this.isBoss ? 1.3 : 1.0;
    }

    if (this.state === 'attackWindup' || this.state === 'attackActive') {
      const spec = ATTACK_SPECS[this.currentAttackType];
      const totalDur = spec.startup + spec.active;
      const elapsed = totalDur - (this.state === 'attackWindup' ? this.stateTimer + spec.active : this.stateTimer);
      const t = Math.max(0, Math.min(1, elapsed / totalDur));
      const arc = this.currentAttackType === 'heavy' ? 3.0 : this.currentAttackType === 'special' ? 3.6 : 2.2;
      const startAngle = this.currentAttackType === 'special' ? -1.8 : -1.2;
      this.weaponMesh.rotation.z = startAngle + t * arc;
      this.weaponMesh.scale.setScalar(this.currentAttackType === 'heavy' ? 1.3 : this.currentAttackType === 'special' ? 1.6 : 1.0);
    } else if (this.state === 'blocking') {
      this.weaponMesh.rotation.z = -1.65;
      this.weaponMesh.rotation.x = -0.3;
      this.weaponMesh.scale.setScalar(1.0);
    } else {
      this.weaponMesh.rotation.z = 0;
      this.weaponMesh.rotation.x = 0;
      this.weaponMesh.scale.setScalar(1.0);
    }

    this.group.rotation.y = this.facing;
  }
}
