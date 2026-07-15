import * as THREE from 'three';
import { InputState, isTouchDevice } from './controls.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { FLOOR1_ROSTER } from './enemies/floor1.js';
import { buildDungeon } from './dungeon.js';
import { SanityFX } from './sanity.js';
import { UI } from './ui.js';
import { resolvePlayerAttacks, findLockOnTarget } from './combat.js';

// ================= Age gate =================
const ageGate = document.getElementById('age-gate');
document.getElementById('age-confirm').addEventListener('click', () => {
  ageGate.classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  startGame();
});
document.getElementById('age-deny').addEventListener('click', () => {
  document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#8f8778;font-family:serif;">You may return when eligible.</div>';
});

// ================= Core three.js setup =================
let scene, camera, renderer, clock;
let player, ui, sanityFX, input, dungeon;
let enemies = [];
let bossEnemy = null;
let lockedTarget = null;
let camYaw = 0, camPitch = 0.35;
const camDistance = 6.5;
let gameOver = false;
let gameWon = false;

function initScene() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 100);

  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false; // keep it light for mobile GPUs

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  clock = new THREE.Clock();
}

function startGame() {
  initScene();
  dungeon = buildDungeon(scene);
  player = new Player(scene);
  ui = new UI();
  sanityFX = new SanityFX(scene);
  input = new InputState();

  enemies = FLOOR1_ROSTER.map(entry => {
    const pos = new THREE.Vector3(...entry.position);
    const e = new Enemy(scene, entry.def, pos);
    if (entry.isBoss) bossEnemy = e;
    return e;
  });

  ui.setHint(isTouchDevice
    ? 'Drag left stick to move · drag screen to look · ATTACK / DODGE / LOCK'
    : 'WASD move · mouse look (click to lock cursor) · Click attack · Space dodge · Q lock-on');

  ui.showMessage('THE WARDEN\u2019S DEPTH', 2600);

  document.getElementById('restart-btn').addEventListener('click', () => {
    window.location.reload();
  });

  requestAnimationFrame(loop);
}

// ================= Camera rig =================
function updateCamera(dt) {
  const sensitivity = isTouchDevice ? 0.0035 : 0.0028;
  camYaw -= input.lookDX * sensitivity;
  camPitch -= input.lookDY * sensitivity;
  camPitch = Math.max(-0.15, Math.min(1.1, camPitch));

  if (lockedTarget && lockedTarget.alive) {
    const dx = lockedTarget.group.position.x - player.group.position.x;
    const dz = lockedTarget.group.position.z - player.group.position.z;
    const desiredYaw = Math.atan2(dx, dz);
    // Blend toward facing the target so the fight stays framed, while still
    // letting the player's own look input have some influence.
    let diff = desiredYaw - camYaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    camYaw += diff * Math.min(1, dt * 4.5);
    player.forcedFacing = desiredYaw;
  } else {
    player.forcedFacing = null;
  }

  const offsetX = Math.sin(camYaw) * Math.cos(camPitch) * camDistance;
  const offsetZ = Math.cos(camYaw) * Math.cos(camPitch) * camDistance;
  const offsetY = 1.6 + Math.sin(camPitch) * camDistance;

  const targetPos = player.group.position.clone().add(new THREE.Vector3(0, 1.4, 0));
  camera.position.set(
    player.group.position.x + offsetX,
    targetPos.y + offsetY - camDistance * 0.3,
    player.group.position.z + offsetZ
  );
  camera.lookAt(targetPos);
}

// ================= Game flow helpers =================
function handleEnemyKilled(enemy) {
  ui.showMessage(enemy.isNamed ? `${enemy.name.toUpperCase()} HAS FALLEN` : 'ENEMY SLAIN', 1800);
  if (lockedTarget === enemy) lockedTarget = null;

  const anyAlive = enemies.some(e => e.alive);
  if (!anyAlive) {
    dungeon.gateMat.emissive.set(0x8a1f2b);
    dungeon.gateMat.emissiveIntensity = 0.6;
    ui.showMessage('THE PATH IS OPEN — REACH THE GATE', 3000);
  }
}

function checkWinCondition() {
  const anyAlive = enemies.some(e => e.alive);
  if (!anyAlive && !gameWon) {
    const dz = Math.abs(player.group.position.z - (-21));
    const dx = Math.abs(player.group.position.x - 0);
    if (dz < 2 && dx < 2.5) {
      gameWon = true;
      endGame(true);
    }
  }
}

function endGame(won) {
  gameOver = true;
  const endScreen = document.getElementById('end-screen');
  const title = document.getElementById('end-title');
  const subtitle = document.getElementById('end-subtitle');
  const stats = document.getElementById('end-stats');

  if (won) {
    title.textContent = 'ESCAPED';
    title.style.color = '#d4a04f';
    title.style.textShadow = '0 0 30px rgba(212,160,79,0.6)';
    subtitle.textContent = 'She climbs back into the light, dungeon behind her.';
  } else {
    title.textContent = 'YOU DIED';
    title.style.color = '#c23b46';
    subtitle.textContent = 'The depth claims another.';
  }

  stats.innerHTML = `
    Final Sanity: ${Math.round(player.sanity)} / ${player.maxSanity}<br/>
    Corruption Accrued: ${Math.round(player.corruption)}%<br/>
    Armor Condition: ${player.armorLabel}<br/>
    Enemies Defeated: ${enemies.filter(e => !e.alive).length} / ${enemies.length}
  `;

  endScreen.classList.remove('hidden');
}

// ================= Main loop =================
function loop() {
  if (gameOver) return;
  const dt = Math.min(clock.getDelta(), 0.05);

  input.pollKeyboardMove();

  // Lock-on toggle
  if (input.lockPressed) {
    lockedTarget = findLockOnTarget(player.group.position, enemies, lockedTarget);
    ui.setLockOn(!!lockedTarget);
  }

  player.update(dt, input, camera);
  updateCamera(dt);

  for (const enemy of enemies) {
    enemy.update(dt, player.group.position, (dmg, isGrab) => {
      const wasHealthy = !player.exposed;
      player.takeHit(dmg, isGrab);
      sanityFX.triggerShake(isGrab ? 0.35 : 0.18, isGrab ? 0.4 : 0.22);
      if (isGrab) {
        ui.showMessage(wasHealthy ? 'ARMOR SHATTERS' : 'CAUGHT — VULNERABLE', 1600);
      }
    });
  }

  resolvePlayerAttacks(player, enemies, handleEnemyKilled);

  sanityFX.update(dt, player, camera);
  ui.updatePlayerStats(player);
  ui.updateBoss(bossEnemy);

  checkWinCondition();

  if (!player.alive) {
    endGame(false);
  } else if (player.sanity <= 0) {
    // Sanity fully broken: non-lethal failure state, distinct from death
    player.alive = false;
    endGame(false);
    document.getElementById('end-title').textContent = 'MIND BROKEN';
    document.getElementById('end-subtitle').textContent = 'She can no longer tell the dark from herself.';
  }

  input.consumeFrame();
  renderer.render(scene, camera);

  if (!gameOver) requestAnimationFrame(loop);
}
