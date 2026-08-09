// sanity.js — translates the player's sanity/corruption stats into screen-space
// feedback: a tightening red-violet vignette, subtle camera shake, and a fog
// color drift toward blood-red as corruption rises. Purely visual/UI, no
// gameplay logic lives here.

export class SanityFX {
  constructor(scene) {
    this.scene = scene;
    this.overlay = document.getElementById('fx-overlay');
    this.baseFogColor = { r: 0x0a, g: 0x08, b: 0x10 };
    this.corruptFogColor = { r: 0x2a, g: 0x08, b: 0x10 };
    this.shakeTime = 0;
    this.shakeStrength = 0;
  }

  triggerShake(strength = 0.15, duration = 0.25) {
    this.shakeStrength = strength;
    this.shakeTime = duration;
  }

  // Called on floor transitions so each floor's fog tint isn't immediately
  // overwritten by the per-frame corruption blend below.
  setBaseFogColor(hex) {
    this.baseFogColor = {
      r: (hex >> 16) & 0xff,
      g: (hex >> 8) & 0xff,
      b: hex & 0xff,
    };
  }

  update(dt, player, camera) {
    const sanityRatio = player.sanity / player.maxSanity; // 1 = calm, 0 = broken
    const corruptionRatio = player.corruption / 100;

    // Vignette: darker/redder as sanity drops and corruption climbs
    const vignetteSize = 40 + (1 - sanityRatio) * 220 + corruptionRatio * 100;
    const vignetteColor = `rgba(${120 + corruptionRatio * 100}, ${10}, ${30 + corruptionRatio * 20}, ${0.15 + (1 - sanityRatio) * 0.5})`;
    this.overlay.style.boxShadow = `inset 0 0 ${vignetteSize}px ${vignetteColor}`;

    // Fog color drift toward blood-red with corruption
    if (this.scene.fog) {
      const r = Math.round(this.baseFogColor.r + (this.corruptFogColor.r - this.baseFogColor.r) * corruptionRatio);
      const g = Math.round(this.baseFogColor.g + (this.corruptFogColor.g - this.baseFogColor.g) * corruptionRatio);
      const b = Math.round(this.baseFogColor.b + (this.corruptFogColor.b - this.baseFogColor.b) * corruptionRatio);
      this.scene.fog.color.setRGB(r / 255, g / 255, b / 255);
      this.scene.fog.density = 0.045 + corruptionRatio * 0.03;
    }

    // Camera shake on hit / high corruption tremor
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const s = this.shakeStrength * (this.shakeTime / 0.25);
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
    } else if (corruptionRatio > 0.6) {
      const tremor = (corruptionRatio - 0.6) * 0.04;
      camera.position.x += (Math.random() - 0.5) * tremor;
      camera.position.y += (Math.random() - 0.5) * tremor;
    }
  }
}
