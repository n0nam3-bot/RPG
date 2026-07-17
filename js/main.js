import * as THREE from 'three';
import { InputState, isTouchDevice } from './controls.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { FLOOR1_ROSTER } from './enemies/floor1.js';
import { FLOOR2_ROSTER } from './enemies/floor2.js';
import { FLOOR3_ROSTER } from './enemies/floor3.js';
import { buildDungeon } from './dungeon.js';
import { SanityFX } from './sanity.js';
import { UI } from './ui.js';
import { resolvePlayerAttacks, findLockOnTarget, checkPerfectDodge } from './combat.js';
import { Audio } from './audio.js';

const FLOORS = [FLOOR1_ROSTER, FLOOR2_ROSTER, FLOOR3_ROSTER];
const GATE_POSITION = { x: 0, z: -21 };
const PLAYER_START = { x: 0, z: 8 };

// ================= Age gate =================
const ageGate = document.getElementById('age-gate');
const audio = new Audio();
document.getElementById('age-confirm').addEventListener('click', () => {
  audio.unlock(); // first real user gesture — safe to init AudioContext
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
let currentFloor = 0; // index into FLOORS
let camYaw = 0, camPitch = 0.12;
const camDistance = 4.1;      // Marvel Rivals-style: closer, over-the-shoulder
const shoulderOffset = 0.85;   // lateral shift so the character isn't dead-center
let gameOver = false;
let gameWon = false;

// ===== Feel/juice state =====
let hitStopTimer = 0;   // when > 0, time is heavily slowed (impact freeze-frame)
let slowMoTimer = 0;     // when > 0, time is gently slowed (perfect-dodge bullet-time)
let camPunch = 0;         // extra inward camera pull that decays each frame

function triggerHitStop(duration) { hitStopTimer = Math.max(hitStopTimer, duration); }
function triggerSlowMo(duration) { slowMoTimer = Math.max(slowMoTimer, duration); }
function triggerCamPunch(amount) { camPunch = Math.max(camPunch, amount); }

function initScene() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);

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

  currentFloor = 0;
  spawnFloor(0, false);

  ui.setHint(isTouchDevice
    ? 'Drag left stick to move · drag screen to look · ATTACK / DODGE / LOCK / FLASK'
    : 'WASD move · mouse look (click to lock cursor) · Click attack · Space dodge · Q lock-on · E flask');

  ui.showMessage('THE WARDEN\u2019S DEPTH', 2600);

  document.getElementById('restart-btn').addEventListener('click', () => {
    window.location.reload();
  });

  requestAnimationFrame(loop);
}

// Spawns a floor's roster, clearing whatever was there before. If
// resetPlayer is true, the player is walked back to the entrance (used on
// floor transitions, not the very first spawn).
function spawnFloor(floorIndex, resetPlayer) {
  for (const enemy of enemies) {
    scene.remove(enemy.group);
  }
  enemies = [];
  bossEnemy = null;
  lockedTarget = null;

  const roster = FLOORS[floorIndex];
  enemies = roster.map(entry => {
    const pos = new THREE.Vector3(...entry.position);
    const e = new Enemy(scene, entry.def, pos);
    if (entry.isBoss) bossEnemy = e;
    return e;
  });

  dungeon.gateMat.emissive.set(0x000000);
  dungeon.gateMat.emissiveIntensity = 0;

  if (resetPlayer) {
    player.group.position.set(PLAYER_START.x, 0, PLAYER_START.z);
  }

  ui.setFloor(floorIndex + 1, FLOORS.length);
}

// ================= Camera rig (over-the-shoulder, Marvel Rivals-style) =====
function updateCamera(dt) {
  const sensitivity = isTouchDevice ? 0.0035 : 0.0028;
  camYaw -= input.lookDX * sensitivity;
  camPitch -= input.lookDY * sensitivity;
  camPitch = Math.max(-0.2, Math.min(0.85, camPitch));

  if (lockedTarget && lockedTarget.alive) {
    const dx = lockedTarget.group.position.x - player.group.position.x;
    const dz = lockedTarget.group.position.z - player.group.position.z;
    const desiredYaw = Math.atan2(dx, dz);
    let diff = desiredYaw - camYaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    camYaw += diff * Math.min(1, dt * 4.5);
    player.forcedFacing = desiredYaw;
  } else {
    player.forcedFacing = null;
  }

  const effectiveDistance = camDistance - camPunch;

  const backX = Math.sin(camYaw) * Math.cos(camPitch) * effectiveDistance;
  const backZ = Math.cos(camYaw) * Math.cos(camPitch) * effectiveDistance;
  const backY = 1.55 + Math.sin(camPitch) * effectiveDistance;

  const rightX = Math.cos(camYaw);
  const rightZ = -Math.sin(camYaw);

  const camPos = new THREE.Vector3(
    player.group.position.x + backX + rightX * shoulderOffset,
    backY,
    player.group.position.z + backZ + rightZ * shoulderOffset
  );
  camera.position.copy(camPos);

  const lookTarget = player.group.position.clone().add(new THREE.Vector3(
    1.4 + rightX * shoulderOffset * 0.5,
    1.35,
    rightZ * shoulderOffset * 0.5
  ));
  camera.lookAt(lookTarget);

  camPunch = Math.max(0, camPunch - dt * 6);
}

// ================= Game flow helpers =================
function handleEnemyHit(enemy, killed, wasHeavy) {
  if (killed) {
    audio.enemyDeath();
    triggerHitStop(0.09);
    ui.showMessage(enemy.isNamed ? `${enemy.name.toUpperCase()} HAS FALLEN` : 'ENEMY SLAIN', 1800);
    if (lockedTarget === enemy) lockedTarget = null;
    player.addPotionCharge();

    const anyAlive = enemies.some(e => e.alive);
    if (!anyAlive) {
      dungeon.gateMat.emissive.set(0x8a1f2b);
      dungeon.gateMat.emissiveIntensity = 0.6;
      ui.showMessage('THE PATH IS OPEN — REACH THE GATE', 3000);
    }
  } else {
    audio.hitClang();
    triggerHitStop(wasHeavy ? 0.08 : 0.045);
    triggerCamPunch(wasHeavy ? 0.7 : 0.4);
    if (wasHeavy) ui.showMessage('HEAVY STRIKE', 900);
  }
}

function checkWinCondition() {
  const anyAlive = enemies.some(e => e.alive);
  if (!anyAlive && !gameWon) {
    const dz = Math.abs(player.group.position.z - GATE_POSITION.z);
    const dx = Math.abs(player.group.position.x - GATE_POSITION.x);
    if (dz < 2 && dx < 2.5) {
      if (currentFloor < FLOORS.length - 1) {
        currentFloor++;
        spawnFloor(currentFloor, true);
        ui.showMessage(`FLOOR ${currentFloor + 1}`, 2400);
      } else {
        gameWon = true;
        endGame(true);
      }
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
    Floor Reached: ${currentFloor + 1} / ${FLOORS.length}<br/>
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
  const rawDt = Math.min(clock.getDelta(), 0.05);

  let dt = rawDt;
  if (hitStopTimer > 0) {
    hitStopTimer -= rawDt;
    dt = rawDt * 0.06;
  } else if (slowMoTimer > 0) {
    slowMoTimer -= rawDt;
    dt = rawDt * 0.3;
  }

  input.pollKeyboardMove();

  if (input.lockPressed) {
    lockedTarget = findLockOnTarget(player.group.position, enemies, lockedTarget);
    ui.setLockOn(!!lockedTarget);
  }

  player.update(dt, input, camera);

  if (player.dodgeTriggeredThisFrame) {
    audio.dodgeWhoosh();
    const perfected = checkPerfectDodge(player.group.position, enemies);
    if (perfected) {
      perfected.interruptWithPerfectDodge();
      player.refundStamina(22);
      player.gainSanity(4);
      audio.perfectChime();
      triggerSlowMo(0.35);
      ui.showMessage('PERFECT DODGE — PUNISH!', 1400);
    }
    player.dodgeTriggeredThisFrame = false;
  }

  if (player.potionTriggeredThisFrame) {
    audio.perfectChime();
    ui.showMessage('DRINKING FLASK...', 1000);
    player.potionTriggeredThisFrame = false;
  }

  updateCamera(dt);

  for (const enemy of enemies) {
    enemy.update(dt, player.group.position, (dmg, isGrab, isSlam) => {
      const wasHealthy = !player.armorBroken;
      player.takeHit(dmg, isGrab);
      audio.heavyImpact();
      triggerHitStop(isSlam ? 0.12 : (isGrab ? 0.09 : 0.05));
      triggerCamPunch(isSlam ? 1.1 : (isGrab ? 0.8 : 0.5));
      sanityFX.triggerShake(isSlam ? 0.45 : (isGrab ? 0.35 : 0.18), isSlam ? 0.5 : (isGrab ? 0.4 : 0.22));
      if (isSlam) {
        ui.showMessage('CAUGHT IN THE SLAM', 1600);
      } else if (isGrab) {
        ui.showMessage(wasHealthy ? 'ARMOR BROKEN' : 'STAGGERING BLOW', 1600);
      }
    });

    if (enemy.justEnteredPhase2) {
      enemy.justEnteredPhase2 = false;
      audio.bossRoar();
      triggerHitStop(0.15);
      triggerSlowMo(0.6);
      sanityFX.triggerShake(0.5, 0.6);
      ui.showMessage(`${enemy.name.toUpperCase()}'S RAGE AWAKENS`, 2400);
    }
  }

  resolvePlayerAttacks(player, enemies, handleEnemyHit);
  if (player.attackTriggeredThisFrame) {
    audio.swordSwing();
    player.attackTriggeredThisFrame = false;
  }

  sanityFX.update(dt, player, camera);
  ui.updatePlayerStats(player);
  ui.updateBoss(bossEnemy);

  checkWinCondition();

  // Sanity is a soft debuff curve now (see Player.sanityDamageMultiplier /
  // sanitySpeedMultiplier / sanityRegenMultiplier) — it never ends the run.
  // Only HP loss ends the run.
  if (!player.alive) {
    audio.playerDeath();
    endGame(false);
  }

  input.consumeFrame();
  renderer.render(scene, camera);

  if (!gameOver) requestAnimationFrame(loop);
}
