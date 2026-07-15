// controls.js — unifies keyboard/mouse (desktop) and touch (mobile) input
// into a single state object the rest of the game reads from.

export const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

export class InputState {
  constructor() {
    this.moveX = 0;      // -1..1 strafe
    this.moveY = 0;      // -1..1 forward/back
    this.lookDX = 0;      // camera yaw delta this frame
    this.lookDY = 0;      // camera pitch delta this frame
    this.attackPressed = false; // edge-triggered
    this.dodgePressed = false;  // edge-triggered
    this.lockPressed = false;   // edge-triggered
    this._keys = {};

    this._setupKeyboard();
    this._setupMouse();
    if (isTouchDevice) this._setupTouch();
  }

  _setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      this._keys[e.code] = true;
      if (e.code === 'Space') { this.dodgePressed = true; }
      if (e.code === 'KeyQ' || e.code === 'Tab') { this.lockPressed = true; e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => { this._keys[e.code] = false; });
  }

  _setupMouse() {
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('click', () => {
      if (document.pointerLockElement !== canvas && !isTouchDevice) {
        canvas.requestPointerLock();
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.attackPressed = true;
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) {
        this.lookDX += e.movementX;
        this.lookDY += e.movementY;
      }
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _setupTouch() {
    document.getElementById('touch-controls').classList.remove('hidden');

    // Virtual joystick
    const zone = document.getElementById('joystick-zone');
    const knob = document.getElementById('joystick-knob');
    let dragging = false;
    let originX = 0, originY = 0;
    const radius = 45;

    const startDrag = (x, y) => {
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
      this.moveY = -ky / radius; // invert: up = forward
    };
    const endDrag = () => {
      dragging = false;
      knob.style.transform = 'translate(-50%, -50%)';
      this.moveX = 0; this.moveY = 0;
    };

    zone.addEventListener('touchstart', (e) => { startDrag(); moveDrag(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); });
    zone.addEventListener('touchmove', (e) => { moveDrag(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); });
    zone.addEventListener('touchend', (e) => { endDrag(); e.preventDefault(); });

    // Camera look via drag anywhere on canvas (right side of screen)
    const canvas = document.getElementById('game-canvas');
    let lookTouchId = null;
    let lastX = 0, lastY = 0;
    canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX > window.innerWidth * 0.4 && lookTouchId === null) {
          lookTouchId = t.identifier;
          lastX = t.clientX; lastY = t.clientY;
        }
      }
    });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === lookTouchId) {
          this.lookDX += (t.clientX - lastX) * 2.2;
          this.lookDY += (t.clientY - lastY) * 2.2;
          lastX = t.clientX; lastY = t.clientY;
        }
      }
    });
    canvas.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === lookTouchId) lookTouchId = null;
      }
    });

    // Buttons
    document.getElementById('btn-attack').addEventListener('touchstart', (e) => { this.attackPressed = true; e.preventDefault(); });
    document.getElementById('btn-dodge').addEventListener('touchstart', (e) => { this.dodgePressed = true; e.preventDefault(); });
    document.getElementById('btn-lock').addEventListener('touchstart', (e) => { this.lockPressed = true; e.preventDefault(); });
  }

  // Keyboard movement is polled (not event-based) for smoothness
  pollKeyboardMove() {
    if (isTouchDevice) return; // joystick already sets moveX/moveY directly
    let x = 0, y = 0;
    if (this._keys['KeyW'] || this._keys['ArrowUp']) y += 1;
    if (this._keys['KeyS'] || this._keys['ArrowDown']) y -= 1;
    if (this._keys['KeyA'] || this._keys['ArrowLeft']) x -= 1;
    if (this._keys['KeyD'] || this._keys['ArrowRight']) x += 1;
    const len = Math.hypot(x, y) || 1;
    this.moveX = x / len;
    this.moveY = y / len;
  }

  // Call at end of each frame to clear edge-triggered flags
  consumeFrame() {
    this.attackPressed = false;
    this.dodgePressed = false;
    this.lockPressed = false;
    this.lookDX = 0;
    this.lookDY = 0;
  }
}
