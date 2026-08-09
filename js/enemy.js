import * as THREE from 'three';

// Base enemy AI. Concrete stats/behavior come from a "def" object passed in
// (see js/enemies/floor1.js) so new enemy types don't need new classes.
export class Enemy {
  constructor(scene, def, position) {
    this.scene = scene;
    this.def = def;
    this.name = def.name;
    this.isNamed = !!def.isNamed;

    this.maxHealth = def.health;
    this.health = def.health;
    this.damage = def.damage;
    this.grabDamage = def.grabDamage;
    this.moveSpeed = def.speed;
    this.detectRadius = def.detectRadius;
    this.attackRange = def.attackRange;
    this.grabChance = def.grabChance; // 0..1, chance a landed attack is a "grab" (vulnerable attack)
    this.windupTime = def.windupTime;
    this.grabWindupTime = def.grabWindupTime ?? def.windupTime * 1.4;
    this.recoverTime = def.recoverTime;
    this.staggerThreshold = def.staggerThreshold ?? 3; // hits to stagger
    this.color = def.color;

    // Optional AOE "slam" attack (named bosses) — bigger telegraph radius,
    // bigger damage, escaped by moving/dodging out of the ring rather than
    // just timing an i-frame.
    this.hasSlam = !!def.hasSlam;
    this.slamRadius = def.slamRadius ?? 4.5;
    this.slamDamage = def.slamDamage ?? 30;
    this.slamWindupTime = def.slamWindupTime ?? 1.6;
    this.slamChance = def.slamChance ?? 0.3;

    // Optional combo chain (fast enemies) — after a normal attack, a chance
    // to immediately chain into a second, quicker swing instead of
    // recovering. Capped at one chain per engagement so it stays readable.
    this.canCombo = !!def.canCombo;
    this.comboChance = def.comboChance ?? 0.5;
    this.comboWindupTime = def.comboWindupTime ?? (def.windupTime * 0.6);
    this.hasChainedThisEngagement = false;

    this.group = new THREE.Group();
    this.group.position.copy(position);
    scene.add(this.group);
    this._buildMesh();

    this.state = 'idle'; // idle, chase, windup, grabWindup, attack, recover, staggered, dead
    this.stateTimer = 0;
    this.hitCounter = 0;
    this.alive = true;
    this.telegraphMesh.visible = false;
    this.pendingIsGrab = false;
    this.pendingIsSlam = false;

    // Phase 2 (named bosses only)
    this.phase2Triggered = false;
    this.justEnteredPhase2 = false; // main.js reads this once, then it self-clears
  }

  _buildMesh() {
    const bodyColor = this.color ?? 0x5a4a3a;
    const mat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.7 });
    const scale = this.isNamed ? 1.35 : 1.0;

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4 * scale, 1.2 * scale, 4, 8), mat);
    body.position.y = 1.05 * scale;
    body.castShadow = true;
    this.group.add(body);
    this.bodyMesh = body;

    const headMat = new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.8 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3 * scale, 10, 10), headMat);
    head.position.y = 1.85 * scale;
    head.castShadow = true;
    this.group.add(head);

    if (this.isNamed) {
      // Aura ring for named/elite enemies
      const auraGeo = new THREE.RingGeometry(0.6, 0.75, 24);
      const auraMat = new THREE.MeshBasicMaterial({ color: 0x8a1f2b, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
      const aura = new THREE.Mesh(auraGeo, auraMat);
      aura.rotation.x = -Math.PI / 2;
      aura.position.y = 0.02;
      this.group.add(aura);
      this.auraMesh = aura;
    }

    // Telegraph disc — shows on ground before an attack lands (souls-style tell)
    const telGeo = new THREE.RingGeometry(0.05, 1.4, 32);
    const telMat = new THREE.MeshBasicMaterial({ color: 0xc23b46, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    const tel = new THREE.Mesh(telGeo, telMat);
    tel.rotation.x = -Math.PI / 2;
    tel.position.y = 0.03;
    this.group.add(tel);
    this.telegraphMesh = tel;

    // Health bar sprite handled in UI layer via world-to-screen; store ref
    this.scale = scale;
  }

  distanceTo(pos) {
    return this.group.position.distanceTo(pos);
  }

  takeHit(dmg) {
    if (!this.alive || this.state === 'staggered') return;
    this.health = Math.max(0, this.health - dmg);
    this.hitCounter++;

    if (this.health <= 0) {
      this._die();
      return;
    }

    // Named bosses enter phase 2 (enrage) at 50% hp
    if (this.isNamed && !this.phase2Triggered && this.health <= this.maxHealth * 0.5) {
      this.phase2Triggered = true;
      this.justEnteredPhase2 = true;
      this.moveSpeed *= 1.25;
      this.damage *= 1.2;
      this.windupTime *= 0.75;
      this.slamChance *= 1.6;
      if (this.auraMesh) this.auraMesh.material.color.set(0xff3344);
    }

    if (this.hitCounter >= this.staggerThreshold) {
      this.hitCounter = 0;
      this.state = 'staggered';
      this.stateTimer = 0.7;
      this.telegraphMesh.visible = false;
    }
  }

  _die() {
    this.alive = false;
    this.state = 'dead';
    this.telegraphMesh.visible = false;
    // Simple death animation: sink + fade handled in update
  }

  // Called when the player lands a perfect dodge against this enemy's
  // telegraphed attack — cancels the attack and opens a punish window.
  interruptWithPerfectDodge() {
    this.state = 'staggered';
    this.stateTimer = 1.4;
    this.telegraphMesh.visible = false;
    this.hitCounter = 0;
  }

  update(dt, playerPos, onAttackLanded) {
    if (this.state === 'dead') {
      this.group.position.y -= dt * 0.6;
      this.bodyMesh.material.opacity = Math.max(0, (this.bodyMesh.material.opacity ?? 1) - dt);
      this.bodyMesh.material.transparent = true;
      return;
    }

    if (this.auraMesh) this.auraMesh.rotation.z += dt * 0.6;

    const dist = this.distanceTo(playerPos);

    switch (this.state) {
      case 'idle': {
        if (dist < this.detectRadius) {
          this.state = 'chase';
          this.hasChainedThisEngagement = false;
        }
        break;
      }
      case 'chase': {
        if (dist <= this.attackRange) {
          // Decide slam (AOE, bosses only) vs grab vs normal attack
          if (this.hasSlam && Math.random() < this.slamChance) {
            this.pendingIsSlam = true;
            this.state = 'slamWindup';
            this.stateTimer = this.slamWindupTime;
            this.telegraphMesh.visible = true;
            this.telegraphMesh.scale.set(this.slamRadius / 1.4, this.slamRadius / 1.4, 1);
            this.telegraphMesh.material.color.set(0xff8a3a);
          } else {
            this.pendingIsGrab = Math.random() < this.grabChance;
            this.pendingIsSlam = false;
            this.state = this.pendingIsGrab ? 'grabWindup' : 'windup';
            this.stateTimer = this.pendingIsGrab ? this.grabWindupTime : this.windupTime;
            this.telegraphMesh.visible = true;
            this.telegraphMesh.scale.set(1, 1, 1);
            this.telegraphMesh.material.color.set(this.pendingIsGrab ? 0xc14a72 : 0xc23b46);
          }
        } else {
          const dir = new THREE.Vector3().subVectors(playerPos, this.group.position);
          dir.y = 0; dir.normalize();
          this.group.position.addScaledVector(dir, this.moveSpeed * dt);
          this.group.rotation.y = Math.atan2(dir.x, dir.z);
        }
        break;
      }
      case 'slamWindup': {
        this.stateTimer -= dt;
        const pulse = 0.25 + Math.abs(Math.sin(performance.now() * 0.018)) * 0.35;
        this.telegraphMesh.material.opacity = pulse;
        if (this.stateTimer <= 0) {
          this.telegraphMesh.visible = false;
          this.state = 'attack';
          this.stateTimer = 0.3;
          if (this.distanceTo(playerPos) <= this.slamRadius) {
            onAttackLanded(this.slamDamage, false, true);
          }
        }
        break;
      }
      case 'windup':
      case 'grabWindup': {
        this.stateTimer -= dt;
        // Pulse telegraph
        const pulse = 0.3 + Math.abs(Math.sin(performance.now() * 0.01)) * 0.3;
        this.telegraphMesh.material.opacity = pulse;
        if (this.stateTimer <= 0) {
          this.telegraphMesh.visible = false;
          this.state = 'attack';
          this.stateTimer = 0.2;
          // Resolve attack if player still in range
          if (this.distanceTo(playerPos) <= this.attackRange * 1.3) {
            onAttackLanded(this.pendingIsGrab ? this.grabDamage : this.damage, this.pendingIsGrab, false);
          }
        }
        break;
      }
      case 'attack': {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          const canChainNow = this.canCombo && !this.hasChainedThisEngagement
            && !this.pendingIsSlam && !this.pendingIsGrab
            && this.distanceTo(playerPos) <= this.attackRange * 1.4
            && Math.random() < this.comboChance;
          if (canChainNow) {
            this.hasChainedThisEngagement = true;
            this.state = 'windup';
            this.stateTimer = this.comboWindupTime;
            this.telegraphMesh.visible = true;
            this.telegraphMesh.scale.set(1, 1, 1);
            this.telegraphMesh.material.color.set(0xff6a5a); // slightly distinct tint for the chained hit
          } else {
            this.state = 'recover';
            this.stateTimer = this.recoverTime;
          }
        }
        break;
      }
      case 'recover': {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this.state = 'chase';
        break;
      }
      case 'staggered': {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this.state = 'chase';
        break;
      }
    }
  }
}
