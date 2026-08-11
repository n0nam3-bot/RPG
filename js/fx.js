import * as THREE from 'three';

// fx.js — small burst-of-shards hit-spark effect. Cheap (flat planes, no
// physics engine) but reads clearly as "impact" at arcade-fighter speed.
export class FX {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
  }

  spawnHitSpark(position, color = 0xffffff, big = false) {
    const group = new THREE.Group();
    group.position.copy(position);
    const count = big ? 10 : 6;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.PlaneGeometry(big ? 0.18 : 0.12, 0.025);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, side: THREE.DoubleSide });
      const shard = new THREE.Mesh(geo, mat);
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      shard.userData.dir = new THREE.Vector3(Math.cos(angle), (Math.random() - 0.2) * 0.7, Math.sin(angle));
      shard.rotation.z = angle;
      group.add(shard);
    }
    group.userData.life = big ? 0.34 : 0.24;
    group.userData.maxLife = group.userData.life;
    this.scene.add(group);
    this.active.push(group);
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const g = this.active[i];
      g.userData.life -= dt;
      const t = 1 - Math.max(0, g.userData.life) / g.userData.maxLife;
      for (const shard of g.children) {
        shard.position.addScaledVector(shard.userData.dir, dt * 7);
        shard.material.opacity = Math.max(0, 1 - t);
        shard.scale.setScalar(1 + t * 1.8);
      }
      if (g.userData.life <= 0) {
        this.scene.remove(g);
        g.children.forEach(c => { c.geometry.dispose(); c.material.dispose(); });
        this.active.splice(i, 1);
      }
    }
  }
}
