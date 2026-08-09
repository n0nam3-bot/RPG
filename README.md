# The Warden's Depth — Souls-like Browser Prototype

A single-floor 3D souls-like built with Three.js. Runs entirely client-side —
no build step, no server — so it works straight from GitHub Pages on desktop
or mobile browsers.

## File paths (upload exactly this structure to your repo root)

```
index.html
css/style.css
js/main.js
js/controls.js
js/player.js
js/enemy.js
js/dungeon.js
js/sanity.js
js/ui.js
js/combat.js
js/audio.js
js/enemies/floor1.js
js/enemies/floor2.js
js/enemies/floor3.js
```

## Deploying to GitHub Pages

1. Create a new repo (or use an existing one).
2. Upload all the files above, preserving the folder structure exactly
   (`css/`, `js/`, `js/enemies/`).
3. In the repo: **Settings → Pages → Source → Deploy from branch → main → / (root)**.
4. Your game will be live at `https://<username>.github.io/<repo-name>/`.

No build tools, npm install, or bundler needed — `index.html` pulls Three.js
straight from a CDN via an import map.

## What's implemented in this prototype

- **Over-the-shoulder third-person camera** (Marvel Rivals-style: closer to
  the character, lateral shoulder offset rather than dead-center behind her,
  wider FOV). The character always faces wherever the camera looks (shooter-
  style) — movement is forward/back/strafe relative to that facing, not tied
  to which way she's walking. Lock-on (Q / Tab to cycle targets on desktop,
  LOCK button on mobile) blends camera yaw toward the target while still
  tracking your own look input.
- **Player**: WASD + mouse-look movement (desktop), virtual joystick + drag-look
  (mobile), light attack, dodge roll with brief invulnerability, held block,
  stamina economy.
- **Block**: hold right-click (desktop) or the BLOCK button (mobile) to raise
  a guard. Cuts normal-hit damage by ~65% and drains stamina while held.
  Doesn't stagger you or wear down armor the way a raw hit does, so you can
  hold through a few hits — but grab/slam attacks punch through a guard by
  design, so dodging is still required for those. Dodge cancels out of block
  instantly.
- **Armor integrity system**: 3 visible armor plates that detach as the player
  takes hits. At 0 integrity, armor is fully broken — takes more damage,
  drains stamina/sanity faster. This is a pure difficulty/risk mechanic
  (defense stat), not tied to any explicit content.
- **Sanity / Corruption as a soft debuff, not a fail state**: sanity drops on
  every hit taken (more on a landed heavy/grab attack), regenerates slowly out
  of combat. Low sanity weakens you — reduced attack damage, movement speed,
  and stamina regen on a three-tier curve (see `sanityDamageMultiplier` /
  `sanitySpeedMultiplier` / `sanityRegenMultiplier` in `player.js`) — but it
  never ends the run by itself; only HP loss does. Corruption only climbs and
  drives a permanent red-violet vignette and fog color shift as the run gets
  rougher.
- **Combo system**: every 3rd sword swing lands a heavy hit — bigger damage,
  a wider weapon-swing arc/scale, and extra hit-stop/camera-punch on impact.
  Tracked via `player.attackCount` / `lastAttackWasHeavy`.
- **HP flask**: starts full (3/3), refills from kills afterward. Press E (or
  the FLASK button on mobile) to drink one — heals HP, restores some sanity,
  and repairs one layer of armor, but roots you in place for one second, so
  timing it mid-fight is a real risk/reward call.
- **Perfect dodge**: dodging within ~0.28s of an enemy's telegraphed attack
  landing cancels that attack, staggers the enemy for a long punish window,
  fully refunds the dodge's stamina cost, and gives a small sanity bump — the
  core skill expression of reading a tell and dodging through it.
- **Hit-stop, camera punch, screen shake**: meaningful hits (landed or taken)
  briefly slow or freeze time and pull the camera in slightly — standard
  "game feel" techniques so hits read as impactful. A perfect dodge triggers a
  longer, gentler slow-mo instead of a hard freeze. A successfully blocked hit
  gets its own quieter feedback (a thud + small camera punch, no shake/message
  spam) so it reads as mitigated, not as a full hit.
- **Synthesized audio** (`js/audio.js`): swings, clangs, dodge whooshes, a
  perfect-dodge chime, heavy impacts, a block thud, a boss roar, and death
  stingers, all generated at runtime via the Web Audio API — no audio files
  to host.
- **Progression — embers & upgrade shrine**: enemies drop embers on death (8
  regular / 35 named boss), and each floor hides one glowing ember cache off
  the main path worth a bonus 15. Clearing a floor's enemies and reaching the
  gate opens an upgrade shrine — pick 1 of 3 random boons (more HP, stamina,
  damage, move speed, sanity, a flask charge, or stronger blocking) before
  descending. Boons stack for the rest of the run.
- **Three floors**, each with its own roster (`js/enemies/floor1.js`,
  `floor2.js`, `floor3.js`) and a distinct lighting/fog theme (amber →
  rust-red → cold blue, via `dungeon.js`'s `applyFloorTheme()`) so each floor
  reads as a different place, not a re-skinned copy:
  - Floor 1 — The Warden's Depth: `Dungeon Brute`, `Blade Thrall`, boss
    `The Warden`
  - Floor 2 — The Rust Hollow: `Iron Guard` (x2), `Chain Flagellant`, boss
    `The Tormentor`
  - Floor 3 — The Cold Sanctum (final): `Sentinel Hulk` (x2), `Shadow
    Stalker` (x2), boss `The Hollow King`

  All enemies telegraph attacks with a ground ring before they land — dodge
  through it for i-frames or a perfect-dodge punish, block through it if it's
  not a grab/slam, souls-style. A percentage of attacks are heavier grab/slam
  telegraphs (longer windup, bigger damage/sanity hit, brief stun on
  landing). The three fast enemy types (`Blade Thrall`, `Chain Flagellant`,
  `Shadow Stalker`) can chain a second, quicker attack onto their first
  instead of always recovering — same telegraph-then-punish rules apply, it
  just keeps you honest about when an opening is actually safe. Named bosses
  also get a wide-radius AOE slam attack and a phase-2 enrage at 50% HP
  (faster/harder attacks, roar/shake beat, redder aura).
- **Win condition**: clear a floor's enemies, pick an upgrade, then reach the
  gate to descend to the next floor (roster respawns, player resets to the
  entrance, new floor theme applies). Clearing the final floor's gate wins the
  run. Losing all HP ends the run with a stats recap (floor reached, embers
  collected, sanity, corruption %, armor condition, enemies defeated).
- **Age gate**: a confirmation screen blocks entry until the player confirms
  18+, matching the mature-content framing you asked for, without any actual
  explicit content behind it.

## Extending it

- **Even more floors**: add a `floor4.js` etc. following the same `def`/
  roster shape, add it to the `FLOORS` array in `main.js`, and give it an
  entry in `FLOOR_THEMES` in `dungeon.js` plus a position in
  `TREASURE_POSITIONS` in `main.js`.
- **More upgrades**: add entries to the `UPGRADES` array in `main.js` — each
  just needs a `name`, `desc`, and an `apply(player)` function that mutates
  player stats.
- **More enemy variety**: add new entries to a roster array — `Enemy` reads
  everything from the `def` object, so no new classes are needed for simple
  stat/behavior variants (including `canCombo` for chained attacks).
- **Visuals**: swap the primitive Three.js meshes for GLTF models by loading
  them with `GLTFLoader` from `three/addons/loaders/GLTFLoader.js` (already
  available via the import map) in place of `_buildMesh()`.

## Controls reference

| Action | Desktop | Mobile |
|---|---|---|
| Move | WASD / arrows | Left virtual stick |
| Camera / facing | Mouse (click canvas to lock cursor) | Drag right side of screen |
| Attack | Left click | ATTACK button |
| Block (hold) | Right click (hold) | BLOCK button (hold) |
| Dodge | Space | DODGE button |
| Lock-on / cycle target | Q or Tab | LOCK button |
| Drink HP flask | E | FLASK button |
