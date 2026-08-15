import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const MODEL_PATHS = {
  female_ranger: 'assets/models/female_ranger/Female_Ranger.gltf',
  female_peasant: 'assets/models/female_peasant/Female_Peasant.gltf',
  superhero_female: 'assets/models/superhero_female/Superhero_Female_FullBody.gltf',
};
const ANIMATION_LIBRARY_PATH = 'assets/animations/UAL2_Standard.glb';
const THUMBS_MANIFEST_PATH = 'assets/preview_thumbs/manifest.json';

// ================= Scene setup =================
const canvas = document.getElementById('preview-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2434);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(1.6, 1.5, 2.6);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.0, 0);
controls.enableDamping = true;

const ambient = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambient);
const key = new THREE.DirectionalLight(0xfff4e0, 1.6);
key.position.set(-3, 6, 4);
scene.add(key);
const fill = new THREE.DirectionalLight(0xcfe0ff, 0.7);
fill.position.set(3, 3, -3);
scene.add(fill);

const grid = new THREE.GridHelper(4, 16, 0x554a66, 0x332c40);
scene.add(grid);

function resize() {
  const w = canvas.clientWidth || canvas.parentElement.clientWidth;
  const h = canvas.clientHeight || canvas.parentElement.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ================= Loading state =================
const loader = new GLTFLoader();
let currentModel = null;
let currentMixer = null;
let currentAction = null;
let animClips = {};
let materialsBySlotName = {};

function clearModel() {
  if (currentModel) {
    scene.remove(currentModel);
    currentModel.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose();
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material?.dispose();
      }
    });
  }
  currentModel = null;
  currentMixer = null;
  currentAction = null;
  materialsBySlotName = {};
}

async function loadAnimationLibrary() {
  return new Promise((resolve, reject) => {
    loader.load(ANIMATION_LIBRARY_PATH, (gltf) => resolve(gltf.animations), undefined, reject);
  });
}

function loadModel(path) {
  return new Promise((resolve, reject) => {
    loader.load(path, resolve, undefined, reject);
  });
}

async function switchModel(key) {
  document.getElementById('now-playing').textContent = 'Loading model\u2026';
  clearModel();
  try {
    const gltf = await loadModel(MODEL_PATHS[key]);
    const model = gltf.scene;
    model.traverse((o) => {
      if (o.isMesh) {
        o.frustumCulled = false;
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (m.name) materialsBySlotName[m.name] = m;
          }
        }
      }
    });
    scene.add(model);
    currentModel = model;
    currentMixer = new THREE.AnimationMixer(model);
    populateMaterialDropdown();
    document.getElementById('now-playing').textContent = 'Idle (no clip playing)';
  } catch (err) {
    console.error('Model load failed:', err);
    document.getElementById('now-playing').textContent = `Failed to load model: ${err.message ?? err}`;
  }
}

function populateMaterialDropdown() {
  const sel = document.getElementById('material-select');
  sel.innerHTML = '';
  const names = Object.keys(materialsBySlotName);
  if (names.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = '(no named materials found)';
    sel.appendChild(opt);
    return;
  }
  for (const name of names) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  }
}

// ================= Animation panel =================
function categorizeAnim(name) {
  return name.split('_')[0];
}

function buildAnimList(clips) {
  const listEl = document.getElementById('anim-list');
  listEl.innerHTML = '';
  document.getElementById('anim-count').textContent = clips.length;

  const groups = {};
  for (const clip of clips) {
    const g = categorizeAnim(clip.name);
    (groups[g] ??= []).push(clip);
  }
  const groupNames = Object.keys(groups).sort();

  for (const g of groupNames) {
    const label = document.createElement('div');
    label.className = 'anim-group-label';
    label.textContent = g;
    listEl.appendChild(label);

    for (const clip of groups[g]) {
      const row = document.createElement('div');
      row.className = 'anim-row';
      row.dataset.clip = clip.name;

      const nameEl = document.createElement('span');
      nameEl.className = 'anim-name';
      nameEl.textContent = clip.name;
      nameEl.title = 'Click to play looped';
      nameEl.addEventListener('click', () => playClip(clip.name, true));

      const durEl = document.createElement('span');
      durEl.className = 'anim-duration';
      durEl.textContent = `${clip.duration.toFixed(2)}s`;

      const addBtn = document.createElement('button');
      addBtn.className = 'anim-add-btn';
      addBtn.textContent = '+';
      addBtn.title = 'Add to chain';
      addBtn.addEventListener('click', () => addToChain(clip.name));

      row.appendChild(nameEl);
      row.appendChild(durEl);
      row.appendChild(addBtn);
      listEl.appendChild(row);
    }
  }
}

function setPlayingHighlight(name) {
  document.querySelectorAll('.anim-row').forEach(r => r.classList.toggle('playing', r.dataset.clip === name));
}

function playClip(name, loop) {
  if (!currentMixer || !animClips[name]) return;
  const clip = animClips[name];
  const action = currentMixer.clipAction(clip);
  action.reset();
  action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
  action.clampWhenFinished = !loop;
  action.fadeIn(0.15);
  action.play();
  if (currentAction && currentAction !== action) currentAction.fadeOut(0.15);
  currentAction = action;
  document.getElementById('now-playing').textContent = `Playing: ${name} (${clip.duration.toFixed(2)}s)`;
  setPlayingHighlight(name);
  return action;
}

// ===== Chain builder =====
let chain = [];

function addToChain(name) {
  chain.push(name);
  renderChain();
}

function removeFromChain(index) {
  chain.splice(index, 1);
  renderChain();
}

function renderChain() {
  const listEl = document.getElementById('chain-list');
  listEl.innerHTML = '';
  chain.forEach((name, i) => {
    const chip = document.createElement('span');
    chip.className = 'chain-chip';
    const label = document.createElement('span');
    label.textContent = `${i + 1}. ${name}`;
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '\u00d7';
    removeBtn.addEventListener('click', () => removeFromChain(i));
    chip.appendChild(label);
    chip.appendChild(removeBtn);
    listEl.appendChild(chip);
  });
  document.getElementById('chain-play').disabled = chain.length === 0;
  document.getElementById('chain-clear').disabled = chain.length === 0;
}

function playChain() {
  if (chain.length === 0 || !currentMixer) return;
  let i = 0;
  const playNext = () => {
    if (i >= chain.length) return;
    const name = chain[i];
    const isLast = i === chain.length - 1;
    const action = playClip(name, isLast); // last clip loops so it doesn't snap back to idle
    i++;
    if (!isLast && action) {
      const onFinished = (e) => {
        if (e.action !== action) return;
        currentMixer.removeEventListener('finished', onFinished);
        playNext();
      };
      currentMixer.addEventListener('finished', onFinished);
    }
  };
  playNext();
}

document.getElementById('chain-play').addEventListener('click', playChain);
document.getElementById('chain-clear').addEventListener('click', () => { chain = []; renderChain(); });

// ================= Texture gallery =================
function categorizeTex(filename) {
  if (filename.startsWith('T_Superhero_Female')) return 'Base Skin Tone';
  if (filename.startsWith('T_Regular_Female')) return 'Outfit Skin Overlay';
  if (filename.startsWith('T_Eye')) return 'Eyes';
  if (filename.startsWith('T_Hair')) return 'Hair';
  if (filename.startsWith('T_Ranger')) return 'Ranger Outfit';
  if (filename.startsWith('T_Peasant')) return 'Peasant Outfit';
  return 'Other';
}

function mapTypeOf(filename) {
  if (filename.includes('BaseColor')) return { slot: 'map', label: 'Base Color', srgb: true };
  if (filename.includes('Normal')) return { slot: 'normalMap', label: 'Normal', srgb: false };
  if (filename.includes('Roughness')) return { slot: 'roughnessMap', label: 'Roughness', srgb: false };
  if (filename.includes('ORM')) return { slot: 'roughnessMap', label: 'ORM (approx.)', srgb: false, alsoMetalness: true };
  return { slot: 'map', label: 'Unknown', srgb: true };
}

const textureLoader = new THREE.TextureLoader();

function applyTexture(sourcePath, filename) {
  const sel = document.getElementById('material-select');
  const matName = sel.value;
  const material = materialsBySlotName[matName];
  if (!material) {
    alert('No material selected/available on the current model.');
    return;
  }
  const { slot, srgb, alsoMetalness } = mapTypeOf(filename);
  textureLoader.load(sourcePath, (tex) => {
    tex.flipY = false; // glTF convention — TextureLoader defaults to true, which would render upside-down
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    material[slot] = tex;
    if (alsoMetalness) material.metalnessMap = tex;
    material.needsUpdate = true;
  });
}

async function buildTextureGallery() {
  const res = await fetch(THUMBS_MANIFEST_PATH);
  const manifest = await res.json();
  document.getElementById('tex-count').textContent = manifest.length;

  const groups = {};
  for (const entry of manifest) {
    const g = categorizeTex(entry.file);
    (groups[g] ??= []).push(entry);
  }
  const order = ['Base Skin Tone', 'Outfit Skin Overlay', 'Eyes', 'Hair', 'Ranger Outfit', 'Peasant Outfit', 'Other'];
  const galleryEl = document.getElementById('tex-gallery');
  galleryEl.innerHTML = '';

  for (const g of order) {
    if (!groups[g]) continue;
    const label = document.createElement('div');
    label.className = 'tex-group-label';
    label.textContent = g;
    galleryEl.appendChild(label);

    for (const entry of groups[g]) {
      const card = document.createElement('div');
      card.className = 'tex-card';

      const img = document.createElement('img');
      img.className = 'tex-thumb';
      img.src = `assets/preview_thumbs/${entry.thumb}`;
      img.loading = 'lazy';

      const info = document.createElement('div');
      info.className = 'tex-info';
      const nameEl = document.createElement('div');
      nameEl.className = 'tex-filename';
      nameEl.textContent = entry.file;
      const typeEl = document.createElement('div');
      typeEl.className = 'tex-maptype';
      typeEl.textContent = mapTypeOf(entry.file).label;
      info.appendChild(nameEl);
      info.appendChild(typeEl);

      const applyBtn = document.createElement('button');
      applyBtn.className = 'tex-apply-btn';
      applyBtn.textContent = 'Apply';
      applyBtn.addEventListener('click', () => applyTexture(entry.source, entry.file));

      card.appendChild(img);
      card.appendChild(info);
      card.appendChild(applyBtn);
      galleryEl.appendChild(card);
    }
  }
}

// ================= Tabs =================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ================= Model select =================
document.getElementById('model-select').addEventListener('change', (e) => switchModel(e.target.value));

// ================= Boot =================
async function init() {
  resize();
  const [clips] = await Promise.all([
    loadAnimationLibrary(),
    switchModel('female_ranger'),
    buildTextureGallery(),
  ]);
  for (const clip of clips) animClips[clip.name] = clip;
  buildAnimList(clips);
}
init();

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clockDelta());
  if (currentMixer) currentMixer.update(dt);
  controls.update();
  renderer.render(scene, camera);
}

let _lastTime = performance.now();
function clockDelta() {
  const now = performance.now();
  const dt = (now - _lastTime) / 1000;
  _lastTime = now;
  return dt;
}

loop();
