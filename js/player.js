import * as THREE from 'three';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.set(0, 0, 8);
    scene.add(this.group);

    this._buildMesh();

    // ===== Core stats =====
    this.maxHealth = 100;
    this.health = 100;
    this.maxStamina = 100;
    this.stamina = 100;
    this.maxSanity = 100;
    this.sanity = 100;
    this.corruption = 0; // 0-100, only ever increases

    // ===== Armor integrity: 3 (intact) -> 0 (broken, defense penalty) =====
    this.armorIntegrity = 3;
    this.armorBroken = false;

    // ===== Movement =====
    this.speed = 5.2;
    this.velocity = new THREE.Vector3();
    this.facing = 0; // radians, yaw
    this.forcedFacing = null; // set by main.js when locked onto a target

    // ===== Combat state =====
    this.state = 'idle'; // idle, moving, attacking, dodging, staggered, drinking, dead
    this.stateTimer = 0;
    this.invulnerable = false;
    this.attackHitboxActive = false;
    this.attackCooldown = 0;
    this.dodgeCooldown = 0;
    this.dodgeTriggeredThisFrame = false;
    this.attackTriggeredThisFrame = false;

    // ===== Combo: every 3rd swing lands a stronger hit =====
    this.attackCount = 0;
    this.lastAttackWasHeavy = false;

    // ===== HP potion: charges fill from kills, drinking heals but roots you =====
    this.maxPotionCharges = 3;
    this.potionCharges = this.maxPotionCharges; // start full
    this.potionHealAmount = 32;
    this.potionSanityRestore = 20;
    this.potionTriggeredThisFrame = false;

    this.alive = true;
  }

  _buildMesh() {
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xcdc4b0, roughness: 0.6, metalness: 0.1 });
    const cloakMat = new THREE.MeshStandardMaterial({ color: 0x2c2534, roughness: 0.8 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.1, 4, 8), cloakMat);
    body.position.y = 1.0;
    body.castShadow = true;
    this.group.add(body);
    this.bodyMesh = body;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), boneMat);
    head.position.y = 1.75;
    head.castShadow = true;
    this.group.add(head);

    // Armor plates: 3 pieces that detach visually as integrity drops
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xb8974f, roughness: 0.4, metalness: 0.6 });
    this.plates = [];
    const plateDefs = [
      { pos: [0, 1.35, 0.3], size: [0.5, 0.35, 0.12] },  // chest
      { pos: [0.42, 1.05, 0], size: [0.18, 0.5, 0.18] },  // shoulder
      { pos: [-0.42, 1.05, 0], size: [0.18, 0.5, 0.18] }, // other shoulder
    ];
    for (const def of plateDefs) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(...def.size), plateMat);
      plate.position.set(...def.pos);
      plate.castShadow = true;
      this.group.add(plate);
      this.plates.push(plate);
    }

    // Weapon (simple blade)
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xaaa9a5, metalness: 0.8, roughness: 0.3 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.04), bladeMat);
    blade.position.set(0.55, 1.1, 0.1);
    this.group.add(blade);
    this.weaponMesh = blade;

    // Attack hitbox helper (invisible), placed in front of player when swinging
    this.attackOrigin = new THREE.Object3D();
    this.attackOrigin.position.set(0, 1.1, -1.0);
    this.group.add(this.attackOrigin);
  }

  // ===== Damage handling =====
  // isGrab = true => a landed heavy/grab telegraph (bigger, unblockable-style)
  // Returns true if damage actually applied, false if blocked by i-frames/death
  // — callers should only fire hit audio/shake/messages when this is true.
  takeHit(amount, isGrab = false) {
    if (this.invulnerable || !this.alive) return false;

    let dmg = amount;
    let sanityLoss = isGrab ? 18 : 8;

    if (this.armorIntegrity > 0) {
      // Armor absorbs some damage, then degrades a step (dents/scuffs, defense drops)
      dmg *= 0.6;
      this.armorIntegrity -= 1;
      this._updatePlateVisibility();
      if (this.armorIntegrity === 0) {
        this.armorBroken = true;
        sanityLoss += 10; // losing your last defense is rattling
      }
    } else {
      // Armor broken: full damage, extra sanity drain — pure difficulty penalty
      sanityLoss += 6;
      dmg *= 1.25;
    }

    if (isGrab) dmg *= 1.6;

    this.health = Math.max(0, this.health - dmg);
    this.sanity = Math.max(0, this.sanity - sanityLoss);
    this._applyCorruption(sanityLoss * 0.4);

    this.state = 'staggered';
    this.stateTimer = isGrab ? 1.1 : 0.5;
    this.invulnerable = true;
    setTimeout(() => { this.invulnerable = false; }, isGrab ? 900 : 400);

    if (this.health <= 0) this._die();
    return true;
  }

  _applyCorruption(amount) {
    this.corruption = Math.min(100, this.corruption + amount);
  }

  // Sanity no longer ends the run — instead it's a soft debuff curve. Low
  // sanity makes her hit softer, move slower, and regen stamina slower.
  // Fully separate from HP; you can survive at 0 sanity, just weakened.
  get sanityRatio() {
    return this.sanity / this.maxSanity;
  }

  get sanityDamageMultiplier() {
    if (this.sanityRatio > 0.6) return 1.0;
    if (this.sanityRatio > 0.3) return 0.85;
    return 0.65;
  }

  get sanitySpeedMultiplier() {
    if (this.sanityRatio > 0.6) return 1.0;
    if (this.sanityRatio > 0.3) return 0.9;
    return 0.75;
  }

  get sanityRegenMultiplier() {
    if (this.sanityRatio > 0.6) return 1.0;
    if (this.sanityRatio > 0.3) return 0.85;
    return 0.6;
  }

  // Damage for the swing currently in flight — every 3rd swing is a heavy hit.
  getCurrentAttackDamage() {
    const base = 16;
    const heavyMult = this.lastAttackWasHeavy ? 1.85 : 1.0;
    return base * heavyMult * this.sanityDamageMultiplier;
  }

  _updatePlateVisibility() {
    // Reveal fewer plates as armor integrity drops (3 -> 0)
    this.plates.forEach((p, i) => {
      p.visible = i < this.armorIntegrity;
    });
  }

  _die() {
    this.alive = false;
    this.state = 'dead';
  }

  // ===== Update loop =====
  update(dt, input, camera) {
    if (!this.alive) return;

    // Stamina regen (slower once armor is broken or sanity is low)
    const regenRate = (this.armorBroken ? 10 : 16) * this.sanityRegenMultiplier;
    this.stamina = Math.min(this.maxStamina, this.stamina + regenRate * dt);

    // Passive sanity drain while armor is broken, slow regen otherwise when not hit recently
    if (this.armorBroken) {
      this.sanity = Math.max(0, this.sanity - 1.2 * dt);
    } else if (this.state === 'idle' || this.state === 'moving') {
      this.sanity = Math.min(this.maxSanity, this.sanity + 0.6 * dt);
    }

    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.dodgeCooldown > 0) this.dodgeCooldown -= dt;

    if (this.state === 'staggered' || this.state === 'dodging' || this.state === 'attacking' || this.state === 'drinking') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = 'idle';
        this.attackHitboxActive = false;
      }
    }

    const canAct = this.state === 'idle' || this.state === 'moving';

    // Movement (camera-relative)
    if (canAct) {
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      camDir.y = 0; camDir.normalize();
      const camRight = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();

      const move = new THREE.Vector3();
      move.addScaledVector(camDir, input.moveY);
      move.addScaledVector(camRight, input.moveX);

      if (move.lengthSq() > 0.001) {
        move.normalize();
        this.group.position.addScaledVector(move, this.speed * this.sanitySpeedMultiplier * dt);
        const targetAngle = Math.atan2(move.x, move.z);
        this.facing = targetAngle;
        this.state = 'moving';
      } else if (this.state === 'moving') {
        this.state = 'idle';
      }

      // Face lock-on target if one is set, otherwise face movement direction
      if (this.forcedFacing !== null && this.forcedFacing !== undefined) {
        this.facing = this.forcedFacing;
      }
      this.group.rotation.y = this.facing;
    }

    // Attack input
    if (input.attackPressed && canAct && this.attackCooldown <= 0 && this.stamina >= 18) {
      this.state = 'attacking';
      this.stateTimer = 0.42;
      this.attackCooldown = 0.55;
      this.stamina -= 18;
      this.attackHitboxActive = true;
      this.attackTriggeredThisFrame = true;
      this.attackCount++;
      this.lastAttackWasHeavy = (this.attackCount % 3 === 0);
      setTimeout(() => { this.attackHitboxActive = false; }, 220);
    }

    // Dodge input
    if (input.dodgePressed && canAct && this.dodgeCooldown <= 0 && this.stamina >= 22) {
      this.state = 'dodging';
      this.stateTimer = 0.35;
      this.dodgeCooldown = 0.8;
      this.stamina -= 22;
      this.invulnerable = true;
      this.dodgeTriggeredThisFrame = true;
      setTimeout(() => { this.invulnerable = false; }, 380);
      const dodgeDir = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
      this.group.position.addScaledVector(dodgeDir, 3.2);
    }

    // Potion input — heals but roots you in place for the drink duration
    if (input.potionPressed && canAct && this.potionCharges > 0) {
      this.potionCharges -= 1;
      this.state = 'drinking';
      this.stateTimer = 1.0;
      this.health = Math.min(this.maxHealth, this.health + this.potionHealAmount);
      this.sanity = Math.min(this.maxSanity, this.sanity + this.potionSanityRestore);
      if (this.armorIntegrity < 3) {
        this.armorIntegrity += 1;
        if (this.armorIntegrity > 0) this.armorBroken = false;
        this._updatePlateVisibility();
      }
      this.potionTriggeredThisFrame = true;
    }

    // Simple bob animation while moving
    if (this.state === 'moving') {
      this.bodyMesh.position.y = 1.0 + Math.sin(performance.now() * 0.012) * 0.03;
    } else {
      this.bodyMesh.position.y = 1.0;
    }

    // Weapon swing animation — heavy (every 3rd) swing arcs wider and scales up
    if (this.state === 'attacking') {
      const t = 1 - Math.max(0, this.stateTimer / 0.42);
      const arc = this.lastAttackWasHeavy ? 3.1 : 2.4;
      const startAngle = this.lastAttackWasHeavy ? -1.5 : -1.2;
      this.weaponMesh.rotation.z = startAngle + t * arc;
      this.weaponMesh.scale.setScalar(this.lastAttackWasHeavy ? 1.35 : 1.0);
    } else {
      this.weaponMesh.rotation.z = 0;
      this.weaponMesh.scale.setScalar(1.0);
    }
  }

  addPotionCharge() {
    this.potionCharges = Math.min(this.maxPotionCharges, this.potionCharges + 1);
  }

  getAttackWorldPosition() {
    const pos = new THREE.Vector3();
    this.attackOrigin.getWorldPosition(pos);
    return pos;
  }

  get armorLabel() {
    if (this.armorIntegrity === 3) return 'INTACT';
    if (this.armorIntegrity === 2) return 'CRACKED';
    if (this.armorIntegrity === 1) return 'FAILING';
    return 'BROKEN';
  }

  // Rewards for a perfectly-timed dodge (see combat.js checkPerfectDodge)
  refundStamina(amount) {
    this.stamina = Math.min(this.maxStamina, this.stamina + amount);
  }

  gainSanity(amount) {
    this.sanity = Math.min(this.maxSanity, this.sanity + amount);
  }
}
