import * as THREE from 'three';
import { InputState, isTouchDevice } from './controls.js';
import { Fighter } from './fighter.js';
import { FighterAI, shouldAITag } from './ai.js';
import { Team } from './team.js';
import { CHARACTERS, LADDER } from './roster.js';
import { buildArena, applyStageTheme, clampToStage } from './arena.js';
import { UI } from './ui.js';
import { resolveAttack } from './combat.js';
import { Audio } from './audio.js';
import { FX } from './fx.js';

const MATCH_DURATION = 180;
const COMBO_WINDOW = 1.1;
const P1_SPAWN = new THREE.Vector3(-3, 0, 0);
const P2_SPAWN = new THREE.Vector3(3, 0, 0);

// ================= Age gate =================
const ageGate = document.getElementById('age-gate');
const audio = new Audio();
document.getElementById('age-confirm').addEventListener('click', () => {
  audio.unlock();
  ageGate.classList.add('hidden');
  showSelectScreen();
});
document.getElementById('age-deny').addEventListener('click', () => {
  document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#8f8778;font-family:serif;">You may return when eligible.</div>';
});

// ================= Character select =================
const SELECTABLE_KEYS = Object.keys(CHARACTERS).filter(k => !CHARACTERS[k].isBoss);
let chosenTeamKeys = [];

function showSelectScreen() {
  const screen = document.getElementById('select-screen');
  const grid = document.getElementById('select-grid');
  grid.innerHTML = '';

  for (const key of SELECTABLE_KEYS) {
    const def = CHARACTERS[key];
    const card = document.createElement('div');
    card.className = 'select-card';
    card.dataset.key = key;
    const swatch = document.createElement('div');
    swatch.className = 'select-swatch';
    swatch.style.background = `#${def.color.toString(16).padStart(6, '0')}`;
    const name = document.createElement('div');
    name.className = 'select-card-name';
    name.textContent = def.name.toUpperCase();
    card.appendChild(swatch);
    card.appendChild(name);
    card.addEventListener('click', () => toggleChoice(key, card));
    grid.appendChild(card);
  }

  chosenTeamKeys = [];
  updateSelectPreview();
  screen.classList.remove('hidden');
}

function toggleChoice(key, cardEl) {
  const idx = chosenTeamKeys.indexOf(key);
  if (idx !== -1) {
    chosenTeamKeys.splice(idx, 1);
    cardEl.classList.remove('chosen');
  } else if (chosenTeamKeys.length < 2) {
    chosenTeamKeys.push(key);
    cardEl.classList.add('chosen');
  }
  updateSelectPreview();
}

function updateSelectPreview() {
  document.getElementById('select-slot-1').textContent = `SLOT 1: ${chosenTeamKeys[0] ? CHARACTERS[chosenTeamKeys[0]].name.toUpperCase() : '\u2014'}`;
  document.getElementById('select-slot-2').textContent = `SLOT 2: ${chosenTeamKeys[1] ? CHARACTERS[chosenTeamKeys[1]].name.toUpperCase() : '\u2014'}`;
  document.getElementById('select-confirm').disabled = chosenTeamKeys.length < 2;
}

document.getElementById('select-confirm').addEventListener('click', () => {
  if (chosenTeamKeys.length < 2) return;
  document.getElementById('select-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  startGame(chosenTeamKeys);
});

// ================= Core state =================
let scene, camera, renderer, clock;
let ui, input, arena, fx;
let playerTeam, aiTeam;
let playerAI2 = null; // AI controller for the AI team's active fighter (rebuilt on tag/spawn)
let currentTeamIndex = 0;
let matchTime = MATCH_DURATION;
let matchPhase = 'intro'; // intro, fighting, matchEnd, transitioning
let phaseTimer = 0;
let introFightShown = false;
let gameOver = false;

let comboCount = 0;
let comboAttackerIsPlayer = null;
let comboTimer = 0;

let camX = 0;
let camDist = 7.5;

let hitStopTimer = 0;
let camPunch = 0;

function triggerHitStop(d) { hitStopTimer = Math.max(hitStopTimer, d); }
function triggerCamPunch(a) { camPunch = Math.max(camPunch, a); }

function triggerScreenFlash(color, opacity, duration = 0.18) {
  const overlay = document.getElementById('fx-overlay');
  overlay.style.background = color;
  overlay.style.transition = 'none';
  overlay.style.opacity = String(opacity);
  void overlay.offsetWidth;
  overlay.style.transition = `opacity ${duration}s ease`;
  overlay.style.opacity = '0';
}

function initScene() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
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

function makeFighter(charKey, position, isPlayer) {
  const def = CHARACTERS[charKey];
  return new Fighter(scene, charKey, def, position, isPlayer);
}

function startGame(teamKeys) {
  initScene();
  arena = buildArena(scene);
  ui = new UI();
  input = new InputState();
  fx = new FX(scene);

  const p1a = makeFighter(teamKeys[0], P1_SPAWN, true);
  const p1b = makeFighter(teamKeys[1], P1_SPAWN.clone(), true);
  playerTeam = new Team([p1a, p1b]);

  spawnAITeam(0);

  ui.setHint(isTouchDevice
    ? 'Stick to move (flick up to jump) · L/M/H · SKILL · ULT (full meter) · BLOCK (hold) · EVADE · TAG'
    : '\u2190/\u2192 move · \u2191 jump · A/S/D light/medium/heavy · F skill · G ultimate (full meter) · Space hold block · Shift evade · Q tag');

  document.getElementById('restart-btn').addEventListener('click', () => window.location.reload());

  beginMatch();
  requestAnimationFrame(loop);
}

function spawnAITeam(index) {
  const entry = LADDER[index];
  const a = makeFighter(entry.members[0], P2_SPAWN, false);
  const b = makeFighter(entry.members[1], P2_SPAWN.clone(), false);
  aiTeam = new Team([a, b]);
  playerAI2 = new FighterAI(aiTeam.active, CHARACTERS[aiTeam.active.charKey].archetype);
  applyStageTheme(scene, arena, index);
  ui.setLadderProgress(index + 1, LADDER.length);
  updateNamesUI();
}

function updateNamesUI() {
  ui.setNames(playerTeam.active.name, playerTeam.reserve.name, aiTeam.active.name, aiTeam.reserve.name);
}

function beginMatch() {
  playerTeam.resetForNewMatch([P1_SPAWN, P1_SPAWN.clone()]);
  aiTeam.resetForNewMatch([P2_SPAWN, P2_SPAWN.clone()]);
  playerAI2 = new FighterAI(aiTeam.active, CHARACTERS[aiTeam.active.charKey].archetype);
  matchTime = MATCH_DURATION;
  matchPhase = 'intro';
  phaseTimer = 2.0;
  introFightShown = false;
  resetCombo();
  ui.resetTrails();
  updateNamesUI();
  ui.showMessage(`${LADDER[currentTeamIndex].teamName.toUpperCase()}`, 1500);
  audio.roundStart();
}

function resetCombo() {
  comboCount = 0;
  comboAttackerIsPlayer = null;
  comboTimer = 0;
  ui.hideCombo();
}

// ================= Camera: fixed 2D side view (pan + zoom only) =========
function updateCamera(dt) {
  const midX = (playerTeam.active.group.position.x + aiTeam.active.group.position.x) / 2;
  const sep = Math.abs(playerTeam.active.group.position.x - aiTeam.active.group.position.x);
  const targetDist = THREE.MathUtils.clamp(sep * 1.15 + 4.5, 6, 9.5) - camPunch;

  camX += (midX - camX) * Math.min(1, dt * 6);
  camDist += (targetDist - camDist) * Math.min(1, dt * 6);

  camera.position.set(camX, 3.1, camDist);
  camera.lookAt(camX, 1.2, 0);
  camPunch = Math.max(0, camPunch - dt * 6);
}

// ================= Combat feedback =================
function onHitResult(result, attackType, hitPoint, attackerIsPlayer) {
  if (!result.landed) return;

  if (result.blocked) {
    audio.blockThud();
    triggerCamPunch(0.3);
    fx.spawnHitSpark(hitPoint, 0x8fa0b8, false);
    return;
  }

  if (attackType === 'light') audio.hitLight();
  else if (attackType === 'medium') audio.hitLight();
  else if (attackType === 'heavy' || attackType === 'skill') audio.hitHeavy();
  else audio.hitSpecial();

  const isBig = attackType === 'heavy' || attackType === 'skill' || attackType === 'ultimate';
  fx.spawnHitSpark(hitPoint, attackType === 'ultimate' ? 0xd4a04f : 0xffffff, isBig);

  const stopAmt = attackType === 'ultimate' ? 0.16 : attackType === 'skill' ? 0.1 : attackType === 'heavy' ? 0.08 : 0.04;
  const punchAmt = attackType === 'ultimate' ? 1.3 : attackType === 'skill' ? 0.9 : attackType === 'heavy' ? 0.7 : 0.35;
  triggerHitStop(stopAmt);
  triggerCamPunch(punchAmt);

  if (attackType === 'heavy') triggerScreenFlash('#ffffff', 0.12, 0.15);
  if (attackType === 'skill') triggerScreenFlash('#8a72b8', 0.2, 0.2);
  if (attackType === 'ultimate') triggerScreenFlash('#d4a04f', 0.3, 0.28);

  if (comboAttackerIsPlayer === attackerIsPlayer && comboTimer > 0) comboCount++;
  else { comboCount = 1; comboAttackerIsPlayer = attackerIsPlayer; }
  comboTimer = COMBO_WINDOW;
  ui.showCombo(comboCount);

  if (result.ko) handlePossibleKO(!attackerIsPlayer);
}

function handlePossibleKO(defenderWasPlayer) {
  audio.koStinger();
  triggerHitStop(0.2);
  const team = defenderWasPlayer ? playerTeam : aiTeam;
  if (team.isDefeated) {
    triggerScreenFlash('#c23b46', 0.4, 0.5);
    resetCombo();
    matchPhase = 'matchEnd';
    phaseTimer = 2.2;
  } else {
    ui.showMessage(`${team.reserve.name.toUpperCase()} TAGS IN!`, 1400);
  }
}

function resolveMatchEnd() {
  if (playerTeam.isDefeated) {
    endGame(false);
    return;
  }
  if (aiTeam.isDefeated) {
    if (currentTeamIndex >= LADDER.length - 1) {
      endGame(true);
      return;
    }
    audio.victoryFanfare();
    ui.showMessage(`${LADDER[currentTeamIndex].teamName.toUpperCase()} DEFEATED`, 2000);
    currentTeamIndex++;
    scene.remove(aiTeam.fighters[0].group);
    scene.remove(aiTeam.fighters[1].group);
    spawnAITeam(currentTeamIndex);
    matchPhase = 'transitioning';
    phaseTimer = 2.2;
    return;
  }
  // Time-up fallback: compare total remaining team health
  const p1Total = playerTeam.fighters.reduce((s, f) => s + f.health, 0);
  const p2Total = aiTeam.fighters.reduce((s, f) => s + f.health, 0);
  if (p1Total >= p2Total) {
    if (currentTeamIndex >= LADDER.length - 1) { endGame(true); return; }
    currentTeamIndex++;
    scene.remove(aiTeam.fighters[0].group);
    scene.remove(aiTeam.fighters[1].group);
    spawnAITeam(currentTeamIndex);
    matchPhase = 'transitioning';
    phaseTimer = 2.2;
  } else {
    endGame(false);
  }
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
    subtitle.textContent = 'Every team in the depths has fallen before you.';
  } else {
    audio.defeatStinger();
    title.textContent = 'GAME OVER';
    title.style.color = '#c23b46';
    subtitle.textContent = `${LADDER[currentTeamIndex].teamName} stands victorious.`;
  }

  stats.innerHTML = `Teams Defeated: ${currentTeamIndex + (won ? 1 : 0)} / ${LADDER.length}`;
  endScreen.classList.remove('hidden');
}

// ================= Main loop =================
function loop() {
  if (gameOver) return;
  const rawDt = Math.min(clock.getDelta(), 0.05);
  let dt = rawDt;
  if (hitStopTimer > 0) { hitStopTimer -= rawDt; dt = rawDt * 0.08; }

  input.pollKeyboardMove();

  if (matchPhase === 'intro') {
    phaseTimer -= dt;
    if (!introFightShown && phaseTimer <= 0.8) {
      introFightShown = true;
      ui.showMessage('FIGHT!', 700);
      audio.roundStart();
    }
    if (phaseTimer <= 0) matchPhase = 'fighting';
  } else if (matchPhase === 'matchEnd') {
    phaseTimer -= dt;
    if (phaseTimer <= 0) resolveMatchEnd();
  } else if (matchPhase === 'transitioning') {
    phaseTimer -= dt;
    if (phaseTimer <= 0) beginMatch();
  } else if (matchPhase === 'fighting') {
    matchTime -= dt;
    ui.setTimer(matchTime);
    if (matchTime <= 0) { matchPhase = 'matchEnd'; phaseTimer = 0.1; }
  }

  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) {
      if (comboCount >= 2) ui.showMessage(`${comboCount} HIT COMBO!`, 1200);
      resetCombo();
    }
  }

  const p1 = playerTeam.active;
  const p2 = aiTeam.active;
  p1.faceToward(p2.group.position.x);
  p2.faceToward(p1.group.position.x);

  if (matchPhase === 'fighting') {
    if (input.jumpPressed) p1.tryJump();
    if (input.lightPressed) p1.inputAttack('light');
    if (input.mediumPressed) p1.inputAttack('medium');
    if (input.heavyPressed) p1.inputAttack('heavy');
    if (input.skillPressed) p1.inputAttack('skill');
    if (input.ultimatePressed) p1.inputAttack('ultimate');
    if (input.evadePressed) p1.tryEvade(p2.group.position.x);
    if (input.tagPressed) {
      if (playerTeam.tryTag()) {
        audio.tagSwap();
        ui.showMessage(`TAG IN: ${playerTeam.active.name.toUpperCase()}`, 1200);
        updateNamesUI();
      }
    }
    p1.setBlocking(input.blockHeld);
    p1.applyMovement(dt, input.moveX);

    playerAI2.update(dt, p1);
    if (shouldAITag(p2, aiTeam.reserve)) {
      if (aiTeam.tryTag()) {
        audio.tagSwap();
        playerAI2 = new FighterAI(aiTeam.active, CHARACTERS[aiTeam.active.charKey].archetype);
        ui.showMessage(`${aiTeam.active.name.toUpperCase()} TAGS IN`, 1200);
        updateNamesUI();
      }
    }
  } else {
    p1.setBlocking(false);
  }

  playerTeam.fighters.forEach(f => f.update(dt));
  aiTeam.fighters.forEach(f => f.update(dt));

  clampToStage(playerTeam.active.group, arena.stageHalfWidth);
  clampToStage(aiTeam.active.group, arena.stageHalfWidth);

  // Mandatory auto-tag on KO (both sides)
  if (matchPhase === 'fighting' || matchPhase === 'matchEnd') {
    if (playerTeam.checkMandatoryTag()) {
      updateNamesUI();
      ui.showMessage(`${playerTeam.active.name.toUpperCase()} TAGS IN!`, 1400);
    }
    if (aiTeam.checkMandatoryTag()) {
      playerAI2 = new FighterAI(aiTeam.active, CHARACTERS[aiTeam.active.charKey].archetype);
      updateNamesUI();
    }
  }

  if (matchPhase === 'fighting') {
    resolveAttack(playerTeam.active, aiTeam.active, (result, type, hitPoint) => onHitResult(result, type, hitPoint, true));
    resolveAttack(aiTeam.active, playerTeam.active, (result, type, hitPoint) => onHitResult(result, type, hitPoint, false));
  }

  updateCamera(dt);
  ui.updateHealth(playerTeam, aiTeam);
  ui.tick(rawDt);
  fx.update(dt);

  input.consumeFrame();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
