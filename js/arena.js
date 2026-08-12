import * as THREE from 'three';

const STAGE_THEMES = [
  { torch: 0xc9793a, fog: 0x0a0810, ground: 0x1a1620 },
  { torch: 0xb84a2a, fog: 0x140808, ground: 0x201414 },
  { torch: 0x4a6ab8, fog: 0x05070f, ground: 0x121620 },
  { torch: 0xff3344, fog: 0x140406, ground: 0x1c0c0e }, // final boss stage
];

export function buildArena(scene) {
  scene.fog = new THREE.FogExp2(0x0a0810, 0.035);
  scene.background = new THREE.Color(0x0a0810);

  const ambient = new THREE.AmbientLight(0x2a2434, 1.0);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0x3a3448, 0x0a0810, 0.4);
  scene.add(hemi);

  const torchPositions = [[-9, 4, 2], [9, 4, 2], [-9, 4, -3], [9, 4, -3]];
  const torches = [];
  for (const [x, y, z] of torchPositions) {
    const torch = new THREE.PointLight(0xc9793a, 7, 18, 2);
    torch.position.set(x, y, z);
    scene.add(torch);
    torches.push(torch);
  }

  // Long flat stage — fighters walk left/right along X, z stays at 0.
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1620, roughness: 0.95 });
  const ground = new THREE.Mesh(new THREE.BoxGeometry(30, 0.5, 6), groundMat);
  ground.position.y = -0.25;
  scene.add(ground);

  // Backdrop pillars for depth/atmosphere behind the fight line
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x201a28, roughness: 0.9 });
  for (let i = -12; i <= 12; i += 4) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.75, 8, 8), pillarMat);
    pillar.position.set(i, 4, -6);
    scene.add(pillar);
  }

  const STAGE_HALF_WIDTH = 9;
  return { torches, groundMat, stageHalfWidth: STAGE_HALF_WIDTH };
}

export function applyStageTheme(scene, arenaRefs, teamIndex) {
  const theme = STAGE_THEMES[teamIndex] ?? STAGE_THEMES[STAGE_THEMES.length - 1];
  for (const torch of arenaRefs.torches) torch.color.set(theme.torch);
  arenaRefs.groundMat.color.set(theme.ground);
  if (scene.fog) scene.fog.color.set(theme.fog);
  scene.background.set(theme.fog);
}

export function clampToStage(fighterGroup, halfWidth) {
  if (fighterGroup.position.x > halfWidth) fighterGroup.position.x = halfWidth;
  if (fighterGroup.position.x < -halfWidth) fighterGroup.position.x = -halfWidth;
}
