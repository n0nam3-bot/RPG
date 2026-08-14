import * as THREE from 'three';

// Bright, high-contrast stage themes — a fighting game needs the whole
// arena readable at a glance, so no fog and strong, even lighting instead
// of the moody/dark look that made sense for a dungeon crawl but actively
// hides what's happening in a fighter.
const STAGE_THEMES = [
  { sky: 0x6a7ba3, ground: 0x3a4a5e, accent: 0xd98a4a, name: 'Dusk Bastion' },
  { sky: 0x8a6a52, ground: 0x5a4432, accent: 0xe0692f, name: 'Ember Wastes' },
  { sky: 0x4a6a8a, ground: 0x35506a, accent: 0x5ab0d8, name: 'Frosthold' },
  { sky: 0x7a3a4a, ground: 0x5a2432, accent: 0xff4a5a, name: 'The Hollow Court' },
];

export function buildArena(scene) {
  // No fog — full stage visibility at all times.
  scene.background = new THREE.Color(STAGE_THEMES[0].sky);

  // Strong, even lighting: a bright ambient fill plus a directional key
  // light from above-front so character silhouettes read clearly against
  // the backdrop no matter where they stand on stage.
  const ambient = new THREE.AmbientLight(0xffffff, 1.1);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xfff4e0, 1.4);
  key.position.set(-4, 10, 8);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xcfe0ff, 0.6);
  fill.position.set(6, 6, -6);
  scene.add(fill);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 0.5);
  scene.add(hemi);

  // Long flat stage — fighters walk left/right along X, z stays at 0.
  const groundMat = new THREE.MeshStandardMaterial({ color: STAGE_THEMES[0].ground, roughness: 0.85 });
  const ground = new THREE.Mesh(new THREE.BoxGeometry(30, 0.5, 6), groundMat);
  ground.position.y = -0.25;
  scene.add(ground);

  // Bright accent stripe marking the stage edge, for readability of spacing
  const stripeMat = new THREE.MeshBasicMaterial({ color: STAGE_THEMES[0].accent });
  const stripeL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.52, 6), stripeMat);
  stripeL.position.set(-9, -0.25, 0);
  scene.add(stripeL);
  const stripeR = stripeL.clone();
  stripeR.position.x = 9;
  scene.add(stripeR);

  // Simple bright backdrop panel (readable silhouette background, no
  // pillars looming in shadow)
  const backdropMat = new THREE.MeshStandardMaterial({ color: STAGE_THEMES[0].sky, roughness: 1 });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), backdropMat);
  backdrop.position.set(0, 8, -9);
  scene.add(backdrop);

  const STAGE_HALF_WIDTH = 9;
  return { groundMat, stripeMat, backdropMat, background: scene.background, stageHalfWidth: STAGE_HALF_WIDTH };
}

export function applyStageTheme(scene, arenaRefs, teamIndex) {
  const theme = STAGE_THEMES[teamIndex] ?? STAGE_THEMES[STAGE_THEMES.length - 1];
  arenaRefs.groundMat.color.set(theme.ground);
  arenaRefs.stripeMat.color.set(theme.accent);
  arenaRefs.backdropMat.color.set(theme.sky);
  scene.background.set(theme.sky);
  return theme.name;
}

export function clampToStage(fighterGroup, halfWidth) {
  if (fighterGroup.position.x > halfWidth) fighterGroup.position.x = halfWidth;
  if (fighterGroup.position.x < -halfWidth) fighterGroup.position.x = -halfWidth;
}
