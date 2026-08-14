import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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

// ===== Shared GLTF loading (module-level so every Fighter reuses one loader
// and the animation library is fetched/parsed exactly once, not per-fighter) =====
const _loader = new GLTFLoader();
let _animLibraryPromise = null;
const ANIMATION_LIBRARY_PATH = 'assets/animations/UAL2_Standard.glb';

function loadAnimationLibrary() {
  if (!_animLibraryPromise) {
    _animLibraryPromise = new Promise((resolve, reject) => {
      _loader.load(ANIMATION_LIBRARY_PATH, (gltf) => resolve(gltf.animations), undefined, reject);
    });
  }
  return _animLibraryPromise;
}

function loadModel(path) {
  return new Promise((resolve, reject) => {
    _loader.load(path, resolve, undefined, reject);
  });
}

export class Fighter {
  constructor(scene, charKey, def, position, isPlayer = false) {
    this.scene = scene;
    this.charKey = charKey;
    this.def = def;
    this.name = def.name;
    this.isPlayer = isPlayer;
    this.isBoss = !!def.isBoss;
    this.useModel = !!def.modelPath;
    this.modelLoaded = false;

    this.maxHealth = def.health;
    this.health = def.health;
    this.moveSpeed = def.speed;

    this.maxMeter = 100;
    this.meter = 0;

    this.group = new THREE.Group();
    this.group.position.copy(position);
    scene.add(this.group);

    const scale = this.isBoss ? 1.3 : 1.0;
    this.scale = scale;
    // Shadow/shield/attack-origin exist immediately for every fighter,
    // model-based or not — the model itself loads asynchronously, but
    // update() runs every frame from construction onward and must not
    // hit undefined properties during that loading window.
    this._buildAuxMeshes(scale);

    if (this.useModel) {
      this.lightSwingIndex = 0;
      this._loadModel();
    } else {
      this._buildPrimitiveMesh(scale);
    }

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
    this.isAirborne = false;
    this.groundY = position.y;

    this.comboHitsLanded = 0; // consecutive hits landed without opponent escaping hitstun

    this.bufferedAction = null;
    this.bufferedActionTimer = 0;

    this.facing = isPlayer ? 1 : -1; // +1 faces +X, -1 faces -X
    this.alive = true;
    this.hasHitThisSwing = false;
    this.benched = false; // true while the teammate is active instead
  }

  // Meshes every fighter needs regardless of visual representation.
  _buildAuxMeshes(scale) {
    this.attackOrigin = new THREE.Object3D();
    this.attackOrigin.position.set(0, 1.1, 0);
    this.group.add(this.attackOrigin);

    // Clear block indicator — a translucent shield plane, much easier to
    // read at a glance than a subtle weapon-angle change.
    const shieldMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const shield = new THREE.Mesh(new THREE.PlaneGeometry(0.6 * scale, 1.3 * scale), shieldMat);
    shield.position.set(0.45 * scale, 1.05 * scale, 0.3);
    this.group.add(shield);
    this.shieldMesh = shield;

    // Ground shadow — helps read spacing and jump height against a flat
    // stage. Its local Y gets compensated each frame in update() so it
    // stays pinned to ground level even while the parent group is airborne.
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 });
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5 * scale, 20), shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, 0.01, 0);
    this.group.add(shadow);
    this.shadowMesh = shadow;
  }

  _buildPrimitiveMesh(scale) {
    const bodyMat = new THREE.MeshStandardMaterial({ color: this.def.color ?? 0x5a4a3a, roughness: 0.6 });

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
  }

  async _loadModel() {
    try {
      const [gltf, animClips] = await Promise.all([
        loadModel(this.def.modelPath),
        loadAnimationLibrary(),
      ]);

      const model = gltf.scene;
      model.scale.setScalar(this.scale);
      model.rotation.y = this.def.modelYOffset ?? 0;
      model.traverse((o) => {
        if (o.isMesh) {
          o.frustumCulled = false;
          if (o.material) o.material.needsUpdate = true;
        }
      });
      this.group.add(model);
      this.modelRoot = model;

      this.mixer = new THREE.AnimationMixer(model);
      this.clips = {};
      for (const clip of animClips) this.clips[clip.name] = clip;
      this.currentAction = null;
      this.currentClipName = null;
      this.modelLoaded = true;
      this._playClip(this._resolveIdleClip(), true);
    } catch (err) {
      console.error(`Failed to load model for ${this.name} (${this.def.modelPath}):`, err);
      // Fail safe: fall back to the primitive mesh so a missing/bad asset
      // path doesn't leave the fighter invisible for the whole match.
      this.useModel = false;
      this._buildPrimitiveMesh(this.scale);
    }
  }

  _resolveIdleClip() {
    return this.def.animMap?.idle ?? 'Idle_FoldArms_Loop';
  }

  _playClip(name, loop = true, timeScale = 1, fadeDuration = 0.1) {
    if (!this.mixer || !this.clips[name]) return;
    if (name === this.currentClipName) {
      // Same clip already playing/queued — just retarget speed, don't restart.
      if (this.currentAction) this.currentAction.timeScale = timeScale;
      return;
    }
    const clip = this.clips[name];
    const nextAction = this.mixer.clipAction(clip);
    nextAction.reset();
    nextAction.timeScale = timeScale;
    nextAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    nextAction.clampWhenFinished = !loop;
    nextAction.fadeIn(fadeDuration);
    nextAction.play();
    if (this.currentAction && this.currentAction !== nextAction) {
      this.currentAction.fadeOut(fadeDuration);
    }
    this.currentAction = nextAction;
    this.currentClipName = name;
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
      if (this.state === 'idle') this.state = 'moving'; // don't clobber 'jumping'
    } else if (this.state === 'moving') {
      this.state = 'idle';
    }
  }

  tryJump() {
    if (this.isAirborne || (this.state !== 'idle' && this.state !== 'moving')) return false;
    this.state = 'jumping';
    this.isAirborne = true;
    this.velocityY = JUMP_VELOCITY;
    return true;
  }

  tryLight() {
    if (!this.canAct || this.attackCooldown > 0) return false;
    if (this.useModel) this.lightSwingIndex = (this.lightSwingIndex + 1) % 3;
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
    this.isAirborne = false;
    this.group.position.copy(position);
    this.group.position.y = this.groundY;
    if (this.useModel) {
      if (this.modelLoaded) this._playClip(this._resolveIdleClip(), true);
    } else if (this.bodyMesh) {
      this.bodyMesh.rotation.set(0, 0, 0);
      this.weaponMesh.rotation.set(0, 0, 0);
      this.weaponMesh.scale.setScalar(1.0);
      this.bodyMesh.material.transparent = false;
      this.bodyMesh.material.opacity = 1;
    }
    this.setVisible(true);
  }

  // Called when tagged in — brief invulnerability so tag-ins aren't a free
  // punish, matching real tag-fighter conventions. Always enters grounded.
  tagIn() {
    this.benched = false;
    this.setVisible(true);
    this.state = 'idle';
    this.comboHitsLanded = 0;
    this.isAirborne = false;
    this.velocityY = 0;
    this.group.position.y = this.groundY;
    this.invulnerable = true;
    setTimeout(() => { this.invulnerable = false; }, 250);
  }

  tagOut() {
    this.benched = true;
    this.setVisible(false);
    this.blocking = false;
    this.isAirborne = false;
    this.velocityY = 0;
    this.group.position.y = this.groundY;
  }

  // ================= Update =================
  update(dt) {
    this.attackTriggeredThisFrame = false;

    if (this.benched) return;

    // Keep the ground shadow pinned to the floor even while airborne, and
    // shrink it slightly with height for a clearer "how high am I" read.
    // Runs even during KO so the shadow tracks the falling body correctly.
    const heightAboveGround = this.group.position.y - this.groundY;
    this.shadowMesh.position.y = 0.01 - heightAboveGround;
    const shadowScale = Math.max(0.5, 1 - heightAboveGround * 0.15);
    this.shadowMesh.scale.setScalar(shadowScale);
    this.shadowMesh.material.opacity = 0.35 * shadowScale;

    if (this.state === 'ko') {
      this.group.position.y = Math.max(this.group.position.y - dt * 1.2, this.groundY - 0.4);
      if (this.useModel && this.modelLoaded) {
        this.mixer.update(dt);
        this._updateModelAnimation();
      } else if (this.bodyMesh) {
        this.bodyMesh.rotation.z = THREE.MathUtils.lerp(this.bodyMesh.rotation.z, Math.PI / 2, dt * 4);
      }
      return;
    }

    if (this.auraMesh) this.auraMesh.rotation.z += dt * 0.6;

    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.evadeCooldown > 0) this.evadeCooldown -= dt;

    // Jump physics — runs off isAirborne, not the state label, so attacking
    // mid-jump (state becomes 'attackWindup') doesn't freeze the fighter
    // in the air forever.
    if (this.isAirborne) {
      this.velocityY += GRAVITY * dt;
      this.group.position.y += this.velocityY * dt;
      if (this.group.position.y <= this.groundY) {
        this.group.position.y = this.groundY;
        this.velocityY = 0;
        this.isAirborne = false;
        if (this.state === 'jumping') this.state = 'idle';
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

    if (this.useModel) {
      if (this.modelLoaded) {
        this.mixer.update(dt);
        this._updateModelAnimation();
      }
      // Model orientation is handled by group.rotation.y (faceToward), so
      // nothing else to do here while the model is still loading.
    } else {
      this._updatePrimitiveAnimation();
    }
  }

  // Drives clip selection for model-based fighters from the current state.
  _updateModelAnimation() {
    const map = this.def.animMap ?? {};
    let targetClip = map.idle ?? 'Idle_FoldArms_Loop';
    let loop = true;
    let timeScale = 1;

    if (this.state === 'moving') {
      targetClip = map.moving ?? targetClip;
    } else if (this.state === 'jumping') {
      targetClip = map.jumping ?? targetClip;
    } else if (this.state === 'attackWindup' || this.state === 'attackActive' || this.state === 'attackRecovery') {
      const entry = map[this.currentAttackType];
      targetClip = Array.isArray(entry) ? entry[this.lightSwingIndex % entry.length] : (entry ?? targetClip);
      loop = false;
      const spec = ATTACK_SPECS[this.currentAttackType];
      const totalDur = spec.startup + spec.active + spec.recovery;
      const clip = this.clips[targetClip];
      if (clip && clip.duration > 0) timeScale = clip.duration / totalDur;
    } else if (this.state === 'blocking') {
      targetClip = map.block ?? targetClip;
    } else if (this.state === 'evading') {
      targetClip = map.evade ?? targetClip;
      loop = false;
    } else if (this.state === 'hitstun') {
      targetClip = map.hitstun ?? targetClip;
      loop = false;
    } else if (this.state === 'ko') {
      targetClip = map.ko ?? map.hitstun ?? targetClip;
      loop = false;
    }

    this._playClip(targetClip, loop, timeScale);
    this.shieldMesh.material.opacity = this.state === 'blocking' ? 0.55 : 0;
  }

  _updatePrimitiveAnimation() {
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
      this.shieldMesh.material.opacity = 0;
    } else if (this.state === 'blocking') {
      this.weaponMesh.rotation.z = -1.65;
      this.weaponMesh.rotation.x = -0.3;
      this.weaponMesh.scale.setScalar(1.0);
      this.shieldMesh.material.opacity = 0.55;
    } else {
      this.weaponMesh.rotation.z = 0;
      this.weaponMesh.rotation.x = 0;
      this.weaponMesh.scale.setScalar(1.0);
      this.shieldMesh.material.opacity = 0;
    }

    this.group.rotation.y = this.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
}
