import * as THREE from 'three';
import { InputState, isTouchDevice } from './controls.js';
import { Fighter } from './fighter.js';
import { FighterAI } from './ai.js';
import { ROSTER, PLAYER_DEF } from './roster.js';
import { buildArena, applyStageTheme, clampToStage } from './arena.js';
import { UI } from './ui.js';
import { resolveAttack } from './combat.js';
import { Audio } from './audio.js';

const WINS_NEEDED = 2; // best of 3
const ROUND_DURATION = 60;
const P1_START = new THREE.Vector3(-3, 0, 0);
const P2_START = new THREE.Vector3(3, 0, 0);

// ================= Age gate =================
const ageGate = document.getElementById('age-gate');
const audio = new Audio();
document.getElementById('age-confirm').addEventListener('click', () => {
  audio.unlock();
  ageGate.classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  startGame();
});
document.getElementById('age-deny').addEventListener('click', () => {
  document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#8f8778;font-family:serif;">You may return when eligible.</div>';
});

// ================= Core three.js setup =================
let scene, camera, renderer, clock;
let ui, input, arena;
let player, opponent, opponentAI;
let currentOpponentIndex = 0;
let currentRound = 1;
let p1Wins = 0, p2Wins = 0;
let roundTime = ROUND_DURATION;
let matchPhase = 'intro'; // intro, fighting, roundEnd
let phaseTimer = 0;
let introFightShown = false;
let gameOver = false;

const camLookTarget = new THREE.Vector3(0, 1.3, 0);
let camPerpRef = new THREE.Vector3(0, 0, 1);
let camPosInitialized = false;

let hitStopTimer = 0;
let camPunch = 0;

function triggerHitStop(d) { hitStopTimer = Math.max(hitStopTimer, d); }
function triggerCamPunch(a) { camPunch = Math.max(camPunch, a); }

function initScene() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 100);
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false;

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  clock = new THREE.Clock();
}

function startGame() {
  initScene();
  arena = buildArena(scene);
  ui = new UI();
  input = new InputState();

  player = new Fighter(scene, PLAYER_DEF, P1_START, true);
  spawnOpponent(0);

  ui.setHint(isTouchDevice
    ? 'Drag stick to move · LIGHT / HEAVY / BLOCK (hold) / EVADE / SPECIAL'
    : 'WASD move · J light · K heavy (or Left/Right click) · Shift hold block · Space evade · E special (at full meter)');

  document.getElementById('restart-btn').addEventListener('click', () => window.location.reload());

  beginRound(true);
  requestAnimationFrame(loop);
}

function spawnOpponent(index) {
  const entry = ROSTER[index];
  opponent = new Fighter(scene, entry.def, P2_START, false);
  opponent.phase2Triggered = false;
  opponentAI = new FighterAI(opponent, entry.archetype);
  applyStageTheme(scene, arena, index);
  ui.setNames(PLAYER_DEF.name, entry.def.name);
  ui.setLadderProgress(index + 1, ROSTER.length);
}

function beginRound(firstEver) {
  player.resetForNewRound(P1_START);
  opponent.resetForNewRound(P2_START);
  roundTime = ROUND_DURATION;
  matchPhase = 'intro';
  phaseTimer = 2.0;
  introFightShown = false;
  ui.setRoundPips(p1Wins, p2Wins, WINS_NEEDED);
  ui.showMessage(`ROUND ${currentRound}`, 1300);
  audio.roundStart();
}

// ================= Camera (dynamic dual-fighter framing) =================
function updateCamera(dt) {
  const mid = new THREE.Vector3().addVectors(player.group.position, opponent.group.position).multiplyScalar(0.5);
  const sep = new THREE.Vector3().subVectors(opponent.group.position, player.group.position);
  sep.y = 0;
  const sepDist = Math.max(sep.length(), 0.001);
  const sepNorm = sep.clone().divideScalar(sepDist);
  let perp = new THREE.Vector3(-sepNorm.z, 0, sepNorm.x);

  // Avoid the camera flipping to the opposite side every time the fighters
  // cross paths — keep whichever side is closer to the previous frame.
  if (perp.dot(camPerpRef) < 0) perp.multiplyScalar(-1);
  camPerpRef.copy(perp);

  const camDist = THREE.MathUtils.clamp(sepDist * 1.5 + 5.5, 7.5 - camPunch, 15 - camPunch);
  const desiredPos = new THREE.Vector3(
    mid.x + perp.x * camDist,
    4.3,
    mid.z + perp.z * camDist
  );

  if (!camPosInitialized) {
    camera.position.copy(desiredPos);
    camPosInitialized = true;
  } else {
    camera.position.lerp(desiredPos, 1 - Math.exp(-7 * dt));
  }

  const desiredLook = new THREE.Vector3(mid.x, 1.3, mid.z);
  camLookTarget.lerp(desiredLook, 1 - Math.exp(-7 * dt));
  camera.lookAt(camLookTarget);

  camPunch = Math.max(0, camPunch - dt * 6);
}

// ================= Combat feedback =================
function onHitResult(result, attackType, defenderIsPlayer) {
  if (!result.landed) return;

  if (result.blocked) {
    audio.blockThud();
    triggerCamPunch(0.3);
    return;
  }

  if (attackType === 'light') audio.hitLight();
  else if (attackType === 'heavy') audio.hitHeavy();
  else audio.hitSpecial();

  const stopAmt = attackType === 'special' ? 0.14 : attackType === 'heavy' ? 0.08 : 0.04;
  const punchAmt = attackType === 'special' ? 1.2 : attackType === 'heavy' ? 0.7 : 0.35;
  triggerHitStop(stopAmt);
  triggerCamPunch(punchAmt);

  if (result.ko) {
    handleKO(defenderIsPlayer);
  }
}

function handleKO(defenderWasPlayer) {
  audio.koStinger();
  triggerHitStop(0.25);
  ui.showMessage('K.O.!', 1600);
  if (defenderWasPlayer) p2Wins++; else p1Wins++;
  matchPhase = 'roundEnd';
  phaseTimer = 2.4;
}

function handleTimeUp() {
  const playerHealthier = player.health >= opponent.health;
  ui.showMessage(playerHealthier ? 'TIME UP — YOU LEAD' : 'TIME UP — OPPONENT LEADS', 1600);
  if (playerHealthier) p1Wins++; else p2Wins++;
  matchPhase = 'roundEnd';
  phaseTimer = 2.4;
}

function resolveRoundEnd() {
  ui.setRoundPips(p1Wins, p2Wins, WINS_NEEDED);

  if (p2Wins >= WINS_NEEDED) {
    endGame(false);
    return;
  }
  if (p1Wins >= WINS_NEEDED) {
    if (currentOpponentIndex >= ROSTER.length - 1) {
      endGame(true);
      return;
    }
    audio.victoryFanfare();
    ui.showMessage(`${opponent.name.toUpperCase()} DEFEATED`, 2000);
    currentOpponentIndex++;
    currentRound = 1;
    p1Wins = 0; p2Wins = 0;
    scene.remove(opponent.group);
    spawnOpponent(currentOpponentIndex);
    matchPhase = 'transitioning';
    phaseTimer = 2.2;
    return;
  }

  currentRound++;
  beginRound(false);
}

function endGame(won) {
  gameOver = true;
  const endScreen = document.getElementById('end-screen');
  const title = document.getElementById('end-title');
  const subtitle = document.getElementById('end-subtitle');
  const stats = document.getElementById('end-stats');

  if (won) {
    audio.victoryFanfare();
    title.textContent = 'ARCADE CLEARED';
    title.style.color = '#d4a04f';
    title.style.textShadow = '0 0 30px rgba(212,160,79,0.6)';
    subtitle.textContent = 'Every fighter in the depths has fallen before you.';
  } else {
    audio.defeatStinger();
    title.textContent = 'GAME OVER';
    title.style.color = '#c23b46';
    subtitle.textContent = `${opponent.name} stands victorious.`;
  }

  stats.innerHTML = `
    Fighters Defeated: ${currentOpponentIndex + (won ? 1 : 0)} / ${ROSTER.length}<br/>
    Final Opponent: ${opponent.name}
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
    dt = rawDt * 0.08;
  }

  input.pollKeyboardMove();

  // ===== Phase handling =====
  if (matchPhase === 'intro') {
    phaseTimer -= dt;
    if (!introFightShown && phaseTimer <= 0.8) {
      introFightShown = true;
      ui.showMessage('FIGHT!', 700);
      audio.roundStart();
    }
    if (phaseTimer <= 0) matchPhase = 'fighting';
  } else if (matchPhase === 'roundEnd') {
    phaseTimer -= dt;
    if (phaseTimer <= 0) resolveRoundEnd();
  } else if (matchPhase === 'transitioning') {
    phaseTimer -= dt;
    if (phaseTimer <= 0) beginRound(false);
  } else if (matchPhase === 'fighting') {
    roundTime -= dt;
    ui.setTimer(roundTime);
    if (roundTime <= 0) handleTimeUp();
  }

  // ===== Facing (always toward each other) =====
  player.faceToward(opponent.group.position);
  opponent.faceToward(player.group.position);

  // ===== Player control (only during active fighting) =====
  if (matchPhase === 'fighting') {
    if (input.lightPressed) player.tryLight();
    if (input.heavyPressed) player.tryHeavy();
    if (input.evadePressed) player.tryEvade(opponent.group.position);
    if (input.specialPressed) player.trySpecial();
    player.setBlocking(input.blockHeld);
    player.applyMovement(dt, input.moveX, input.moveY);

    opponentAI.update(dt, player);
  } else {
    player.setBlocking(false);
  }

  player.update(dt);
  opponent.update(dt);

  clampToStage(player.group.position, arena.stageRadius);
  clampToStage(opponent.group.position, arena.stageRadius);

  // Boss phase-2 enrage at 50% HP
  if (opponent.isBoss && !opponent.phase2Triggered && opponent.health <= opponent.maxHealth * 0.5 && opponent.alive) {
    opponent.phase2Triggered = true;
    opponent.moveSpeed *= 1.2;
    triggerHitStop(0.15);
    ui.showMessage(`${opponent.name.toUpperCase()}'S RAGE AWAKENS`, 2000);
  }

  // ===== Combat resolution =====
  if (matchPhase === 'fighting') {
    resolveAttack(player, opponent, (result, type) => onHitResult(result, type, false));
    resolveAttack(opponent, player, (result, type) => onHitResult(result, type, true));
  }

  updateCamera(dt);
  ui.updateHealth(player, opponent);

  input.consumeFrame();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
