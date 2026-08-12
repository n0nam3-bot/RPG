// controls.js — tag-team fighter input. Nine actions: move, jump, light,
// medium, heavy, skill, ultimate, block (held), evade, tag.

export const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

export class InputState {
  constructor() {
    this.moveX = 0; // -1 (left) .. 1 (right), world-space along the fight line
    this.jumpPressed = false;
    this.lightPressed = false;
    this.mediumPressed = false;
    this.heavyPressed = false;
    this.skillPressed = false;
    this.ultimatePressed = false;
    this.evadePressed = false;
    this.tagPressed = false;
    this.blockHeld = false;
    this._keys = {};

    this._setupKeyboard();
    this._setupMouse();
    if (isTouchDevice) this._setupTouch();
  }

  _setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      this._keys[e.code] = true;
      if (e.code === 'Space') this.evadePressed = true;
      if (e.code === 'KeyJ') this.lightPressed = true;
      if (e.code === 'KeyK') this.mediumPressed = true;
      if (e.code === 'KeyL') this.heavyPressed = true;
      if (e.code === 'KeyI') this.skillPressed = true;
      if (e.code === 'KeyU') this.ultimatePressed = true;
      if (e.code === 'KeyQ' || e.code === 'Tab') { this.tagPressed = true; e.preventDefault(); }
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.jumpPressed = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.blockHeld = true;
    });
    window.addEventListener('keyup', (e) => {
      this._keys[e.code] = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.blockHeld = false;
    });
  }

  _setupMouse() {
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.lightPressed = true;
      if (e.button === 2) this.heavyPressed = true;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _setupTouch() {
    document.getElementById('touch-controls').classList.remove('hidden');

    const zone = document.getElementById('joystick-zone');
    const knob = document.getElementById('joystick-knob');
    let dragging = false;
    let originX = 0, originY = 0;
    const radius = 45;

    const startDrag = () => {
      dragging = true;
      const rect = zone.getBoundingClientRect();
      originX = rect.left + rect.width / 2;
      originY = rect.top + rect.height / 2;
    };
    const moveDrag = (x, y) => {
      if (!dragging) return;
      let dx = x - originX;
      let dy = y - originY;
      const dist = Math.min(Math.hypot(dx, dy), radius);
      const angle = Math.atan2(dy, dx);
      const kx = Math.cos(angle) * dist;
      const ky = Math.sin(angle) * dist;
      knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
      this.moveX = kx / radius;
      if (ky / radius < -0.6) this.jumpPressed = true; // flick stick up to jump
    };
    const endDrag = () => {
      dragging = false;
      knob.style.transform = 'translate(-50%, -50%)';
      this.moveX = 0;
    };

    zone.addEventListener('touchstart', (e) => { startDrag(); moveDrag(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); });
    zone.addEventListener('touchmove', (e) => { moveDrag(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); });
    zone.addEventListener('touchend', (e) => { endDrag(); e.preventDefault(); });

    const bind = (id, flagName) => {
      document.getElementById(id).addEventListener('touchstart', (e) => { this[flagName] = true; e.preventDefault(); });
    };
    bind('btn-light', 'lightPressed');
    bind('btn-medium', 'mediumPressed');
    bind('btn-heavy', 'heavyPressed');
    bind('btn-skill', 'skillPressed');
    bind('btn-ultimate', 'ultimatePressed');
    bind('btn-evade', 'evadePressed');
    bind('btn-tag', 'tagPressed');
    bind('btn-jump', 'jumpPressed');

    const blockBtn = document.getElementById('btn-block');
    blockBtn.addEventListener('touchstart', (e) => { this.blockHeld = true; e.preventDefault(); });
    blockBtn.addEventListener('touchend', (e) => { this.blockHeld = false; e.preventDefault(); });
  }

  pollKeyboardMove() {
    if (isTouchDevice) return;
    let x = 0;
    if (this._keys['KeyA'] || this._keys['ArrowLeft']) x -= 1;
    if (this._keys['KeyD'] || this._keys['ArrowRight']) x += 1;
    this.moveX = x;
  }

  consumeFrame() {
    this.jumpPressed = false;
    this.lightPressed = false;
    this.mediumPressed = false;
    this.heavyPressed = false;
    this.skillPressed = false;
    this.ultimatePressed = false;
    this.evadePressed = false;
    this.tagPressed = false;
  }
}
