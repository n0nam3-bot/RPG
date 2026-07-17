import * as THREE from 'three';
import { InputState, isTouchDevice } from './controls.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { FLOOR1_ROSTER } from './enemies/floor1.js';
import { buildDungeon } from './dungeon.js';
import { SanityFX } from './sanity.js';
import { UI } from './ui.js';
import { resolvePlayerAttacks, findLockOnTarget, checkPerfectDodge } from './combat.js';
import { Audio } from './audio.js';

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
let camYaw = 0, camPitch = 0.35;
const camDistance = 6.5;
let gameOver = false;
let gameWon = false;

// ===== Feel/juice state =====
let hitStopTimer = 0;   // when > 0, time is heavily slowed (impact freeze-frame)
let slowMoTimer = 0;     // when > 0, time is gently slowed (perfect-dodge bullet-time)
let camPunch = 0;         // extra inward camera pull that decays each frame
let lastPerfectDodgeTime = -99;

function triggerHitStop(duration) { hitStopTimer = Math.max(hitStopTimer, duration); }
function triggerSlowMo(duration) { slowMoTimer = Math.max(slowMoTimer, duration); }
function triggerCamPunch(amount) { camPunch = Math.max(camPunch, amount); }

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

  const effectiveDistance = camDistance - camPunch;
  const offsetX = Math.sin(camYaw) * Math.cos(camPitch) * effectiveDistance;
  const offsetZ = Math.cos(camYaw) * Math.cos(camPitch) * effectiveDistance;
  const offsetY = 1.6 + Math.sin(camPitch) * effectiveDistance;

  const targetPos = player.group.position.clone().add(new THREE.Vector3(0, 1.4, 0));
  camera.position.set(
    player.group.position.x + offsetX,
    targetPos.y + offsetY - effectiveDistance * 0.3,
    player.group.position.z + offsetZ
  );
  camera.lookAt(targetPos);

  // Punch decays back to zero quickly
  camPunch = Math.max(0, camPunch - dt * 6);
}

// ================= Game flow helpers =================
function handleEnemyHit(enemy, killed) {
  if (killed) {
    audio.enemyDeath();
    triggerHitStop(0.09);
    ui.showMessage(enemy.isNamed ? `${enemy.name.toUpperCase()} HAS FALLEN` : 'ENEMY SLAIN', 1800);
    if (lockedTarget === enemy) lockedTarget = null;

    const anyAlive = enemies.some(e => e.alive);
    if (!anyAlive) {
      dungeon.gateMat.emissive.set(0x8a1f2b);
      dungeon.gateMat.emissiveIntensity = 0.6;
      ui.showMessage('THE PATH IS OPEN — REACH THE GATE', 3000);
    }
  } else {
    audio.hitClang();
    triggerHitStop(0.045);
    triggerCamPunch(0.4);
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
  const rawDt = Math.min(clock.getDelta(), 0.05);

  // Resolve time scale: hitstop (hard freeze) takes priority over slow-mo
  let dt = rawDt;
  if (hitStopTimer > 0) {
    hitStopTimer -= rawDt;
    dt = rawDt * 0.06;
  } else if (slowMoTimer > 0) {
    slowMoTimer -= rawDt;
    dt = rawDt * 0.3;
  }

  input.pollKeyboardMove();

  // Lock-on toggle
  if (input.lockPressed) {
    lockedTarget = findLockOnTarget(player.group.position, enemies, lockedTarget);
    ui.setLockOn(!!lockedTarget);
  }

  player.update(dt, input, camera);

  // Perfect dodge: check right when a dodge is triggered, against enemies
  // about to land a telegraphed attack. Reward + interrupt on success.
  if (player.dodgeTriggeredThisFrame) {
    audio.dodgeWhoosh();
    const perfected = checkPerfectDodge(player.group.position, enemies);
    if (perfected) {
      perfected.interruptWithPerfectDodge();
      player.refundStamina(22); // full refund of the dodge's stamina cost
      player.gainSanity(4);
      audio.perfectChime();
      triggerSlowMo(0.35);
      ui.showMessage('PERFECT DODGE — PUNISH!', 1400);
      lastPerfectDodgeTime = performance.now();
    }
    player.dodgeTriggeredThisFrame = false;
  }

  updateCamera(dt);

  for (const enemy of enemies) {
    const wasPhase2 = enemy.phase2Triggered;
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

    // React once to a boss entering phase 2
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

  if (!player.alive) {
    audio.playerDeath();
    endGame(false);
  } else if (player.sanity <= 0) {
    // Sanity fully broken: non-lethal failure state, distinct from death
    player.alive = false;
    audio.playerDeath();
    endGame(false);
    document.getElementById('end-title').textContent = 'MIND BROKEN';
    document.getElementById('end-subtitle').textContent = 'She can no longer tell the dark from herself.';
  }

  input.consumeFrame();
  renderer.render(scene, camera);

  if (!gameOver) requestAnimationFrame(loop);
}
