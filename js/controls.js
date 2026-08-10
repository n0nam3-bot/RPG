// controls.js — fighting-game input. No mouse-look/pointer-lock needed here
// since the camera auto-frames both fighters (see updateCamera in main.js);
// the player only ever provides movement + action inputs.

export const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

export class InputState {
  constructor() {
    this.moveX = 0; // strafe/circle, -1..1
    this.moveY = 0; // toward/away from opponent, -1..1
    this.lightPressed = false;   // edge-triggered
    this.heavyPressed = false;   // edge-triggered
    this.evadePressed = false;   // edge-triggered
    this.specialPressed = false; // edge-triggered
    this.blockHeld = false;      // held state, not edge-triggered
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
      if (e.code === 'KeyK') this.heavyPressed = true;
      if (e.code === 'KeyE') this.specialPressed = true;
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

    // Virtual joystick — movement only, no camera drag needed
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
      this.moveY = -ky / radius;
    };
    const endDrag = () => {
      dragging = false;
      knob.style.transform = 'translate(-50%, -50%)';
      this.moveX = 0; this.moveY = 0;
    };

    zone.addEventListener('touchstart', (e) => { startDrag(); moveDrag(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); });
    zone.addEventListener('touchmove', (e) => { moveDrag(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); });
    zone.addEventListener('touchend', (e) => { endDrag(); e.preventDefault(); });

    document.getElementById('btn-light').addEventListener('touchstart', (e) => { this.lightPressed = true; e.preventDefault(); });
    document.getElementById('btn-heavy').addEventListener('touchstart', (e) => { this.heavyPressed = true; e.preventDefault(); });
    document.getElementById('btn-evade').addEventListener('touchstart', (e) => { this.evadePressed = true; e.preventDefault(); });
    document.getElementById('btn-special').addEventListener('touchstart', (e) => { this.specialPressed = true; e.preventDefault(); });

    const blockBtn = document.getElementById('btn-block');
    blockBtn.addEventListener('touchstart', (e) => { this.blockHeld = true; e.preventDefault(); });
    blockBtn.addEventListener('touchend', (e) => { this.blockHeld = false; e.preventDefault(); });
  }

  pollKeyboardMove() {
    if (isTouchDevice) return;
    let x = 0, y = 0;
    if (this._keys['KeyW'] || this._keys['ArrowUp']) y += 1;
    if (this._keys['KeyS'] || this._keys['ArrowDown']) y -= 1;
    if (this._keys['KeyA'] || this._keys['ArrowLeft']) x -= 1;
    if (this._keys['KeyD'] || this._keys['ArrowRight']) x += 1;
    const len = Math.hypot(x, y) || 1;
    this.moveX = x / len;
    this.moveY = y / len;
  }

  consumeFrame() {
    this.lightPressed = false;
    this.heavyPressed = false;
    this.evadePressed = false;
    this.specialPressed = false;
  }
}
