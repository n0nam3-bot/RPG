import * as THREE from 'three';

export function buildDungeon(scene) {
  // Dark moody fog
  scene.fog = new THREE.FogExp2(0x0a0810, 0.045);
  scene.background = new THREE.Color(0x0a0810);

  // Ambient + a handful of torch-like point lights for a minimal, moody look
  const ambient = new THREE.AmbientLight(0x2a2434, 0.9);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x3a3448, 0x0a0810, 0.4);
  scene.add(hemi);

  const torchPositions = [
    [0, 3, 4], [-8, 3, -4], [8, 3, -4], [0, 3, -16], [-4, 3, -10], [4, 3, -10],
  ];
  for (const [x, y, z] of torchPositions) {
    const torch = new THREE.PointLight(0xc9793a, 6, 12, 2);
    torch.position.set(x, y, z);
    scene.add(torch);
  }

  // Ground
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1620, roughness: 0.95 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Boundary walls (simple, keeps player roughly inside the arena)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x110e16, roughness: 1 });
  const wallDefs = [
    { pos: [0, 4, -22], size: [40, 8, 1] },
    { pos: [0, 4, 12], size: [40, 8, 1] },
    { pos: [-20, 4, -5], size: [1, 8, 40] },
    { pos: [20, 4, -5], size: [1, 8, 40] },
  ];
  const walls = [];
  for (const def of wallDefs) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(...def.size), wallMat);
    wall.position.set(...def.pos);
    scene.add(wall);
    walls.push(wall);
  }

  // Pillars for cover / visual rhythm
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x201a28, roughness: 0.9 });
  const pillarPositions = [[-5, 0, -7], [5, 0, -7], [-9, 0, -14], [9, 0, -14]];
  for (const [x, , z] of pillarPositions) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 6, 8), pillarMat);
    pillar.position.set(x, 3, z);
    pillar.castShadow = true;
    scene.add(pillar);
  }

  // Exit gate (appears active once all enemies are cleared)
  const gateMat = new THREE.MeshStandardMaterial({ color: 0x3a2f18, roughness: 0.6, emissive: 0x000000 });
  const gate = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 0.4), gateMat);
  gate.position.set(0, 2.5, -21);
  scene.add(gate);

  return { walls, gate, gateMat };
}
