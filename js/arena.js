import * as THREE from 'three';

const STAGE_THEMES = [
  { torch: 0xc9793a, fog: 0x0a0810, ground: 0x1a1620 },
  { torch: 0xb84a2a, fog: 0x140808, ground: 0x201414 },
  { torch: 0x8a6a3a, fog: 0x0e0f08, ground: 0x1c1c14 },
  { torch: 0x9a3a5a, fog: 0x120810, ground: 0x1e1420 },
  { torch: 0x5a4a2a, fog: 0x0c0a06, ground: 0x1a1812 },
  { torch: 0x4a6ab8, fog: 0x05070f, ground: 0x121620 },
  { torch: 0xff3344, fog: 0x140406, ground: 0x1c0c0e }, // final boss stage
];

export function buildArena(scene) {
  scene.fog = new THREE.FogExp2(0x0a0810, 0.05);
  scene.background = new THREE.Color(0x0a0810);

  const ambient = new THREE.AmbientLight(0x2a2434, 1.0);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0x3a3448, 0x0a0810, 0.4);
  scene.add(hemi);

  const torchPositions = [[-8, 4, -8], [8, 4, -8], [-8, 4, 8], [8, 4, 8]];
  const torches = [];
  for (const [x, y, z] of torchPositions) {
    const torch = new THREE.PointLight(0xc9793a, 7, 16, 2);
    torch.position.set(x, y, z);
    scene.add(torch);
    torches.push(torch);
  }

  const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1620, roughness: 0.95 });
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(11, 11.5, 0.5, 32), groundMat);
  ground.position.y = -0.25;
  scene.add(ground);

  // Low glowing ring marking the stage edge
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xb8974f, transparent: true, opacity: 0.5 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(10.6, 11, 48), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  scene.add(ring);

  // Distant backdrop pillars for atmosphere (non-blocking, purely visual)
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x201a28, roughness: 0.9 });
  const pillarPositions = [[-14, 0, -14], [14, 0, -14], [-14, 0, 14], [14, 0, 14], [0, 0, -18], [0, 0, 18]];
  for (const [x, , z] of pillarPositions) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 8, 8), pillarMat);
    pillar.position.set(x, 4, z);
    scene.add(pillar);
  }

  return { torches, groundMat, ring, stageRadius: 10.5 };
}

export function applyStageTheme(scene, arenaRefs, opponentIndex) {
  const theme = STAGE_THEMES[opponentIndex] ?? STAGE_THEMES[STAGE_THEMES.length - 1];
  for (const torch of arenaRefs.torches) torch.color.set(theme.torch);
  arenaRefs.groundMat.color.set(theme.ground);
  if (scene.fog) scene.fog.color.set(theme.fog);
  scene.background.set(theme.fog);
}

// Keeps a fighter's position within the circular stage bounds.
export function clampToStage(position, radius) {
  const distFromCenter = Math.hypot(position.x, position.z);
  if (distFromCenter > radius) {
    const scale = radius / distFromCenter;
    position.x *= scale;
    position.z *= scale;
  }
}
