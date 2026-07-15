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

    // ===== Armor integrity: 3 (intact) -> 0 (broken/exposed) =====
    this.armorIntegrity = 3;
    this.exposed = false;

    // ===== Movement =====
    this.speed = 5.2;
    this.velocity = new THREE.Vector3();
    this.facing = 0; // radians, yaw
    this.forcedFacing = null; // set by main.js when locked onto a target

    // ===== Combat state =====
    this.state = 'idle'; // idle, moving, attacking, dodging, staggered, dead
    this.stateTimer = 0;
    this.invulnerable = false;
    this.attackHitboxActive = false;
    this.attackCooldown = 0;
    this.dodgeCooldown = 0;

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
  // isGrab = true => a "vulnerable attack" telegraph landed (heavy, unblockable-style)
  takeHit(amount, isGrab = false) {
    if (this.invulnerable || !this.alive) return;

    let dmg = amount;
    let sanityLoss = isGrab ? 18 : 8;

    if (this.armorIntegrity > 0) {
      // Armor absorbs some damage, then breaks a step
      dmg *= 0.6;
      this.armorIntegrity -= 1;
      this._updatePlateVisibility();
      if (this.armorIntegrity === 0) {
        this.exposed = true;
        sanityLoss += 10; // shock of full armor loss
      }
    } else {
      // Exposed: full damage, extra sanity drain
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
  }

  _applyCorruption(amount) {
    this.corruption = Math.min(100, this.corruption + amount);
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

    // Stamina regen (slower while exposed)
    const regenRate = this.exposed ? 10 : 16;
    this.stamina = Math.min(this.maxStamina, this.stamina + regenRate * dt);

    // Passive sanity drain while exposed, slow regen otherwise when not hit recently
    if (this.exposed) {
      this.sanity = Math.max(0, this.sanity - 1.2 * dt);
    } else if (this.state === 'idle' || this.state === 'moving') {
      this.sanity = Math.min(this.maxSanity, this.sanity + 0.6 * dt);
    }

    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.dodgeCooldown > 0) this.dodgeCooldown -= dt;

    if (this.state === 'staggered' || this.state === 'dodging' || this.state === 'attacking') {
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
        this.group.position.addScaledVector(move, this.speed * dt);
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
      setTimeout(() => { this.attackHitboxActive = false; }, 220);
    }

    // Dodge input
    if (input.dodgePressed && canAct && this.dodgeCooldown <= 0 && this.stamina >= 22) {
      this.state = 'dodging';
      this.stateTimer = 0.35;
      this.dodgeCooldown = 0.8;
      this.stamina -= 22;
      this.invulnerable = true;
      setTimeout(() => { this.invulnerable = false; }, 300);
      const dodgeDir = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
      this.group.position.addScaledVector(dodgeDir, 3.2);
    }

    // Simple bob animation while moving
    if (this.state === 'moving') {
      this.bodyMesh.position.y = 1.0 + Math.sin(performance.now() * 0.012) * 0.03;
    } else {
      this.bodyMesh.position.y = 1.0;
    }

    // Weapon swing animation
    if (this.state === 'attacking') {
      const t = 1 - Math.max(0, this.stateTimer / 0.42);
      this.weaponMesh.rotation.z = -1.2 + t * 2.4;
    } else {
      this.weaponMesh.rotation.z = 0;
    }
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
    return 'BROKEN — EXPOSED';
  }
}
