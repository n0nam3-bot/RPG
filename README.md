# Depth Arena — 3D Arcade Fighter

A Power Stone / Naruto Storm-style 3D arena fighter: free movement in a
round arena, a camera that dynamically frames both fighters, and a
best-of-3 arcade ladder against 7 AI opponents. Runs entirely client-side —
no build step, no server — so it works straight from GitHub Pages on
desktop or mobile browsers.

This **replaces** the earlier souls-like dungeon-crawl build in the same
repo. See "Cleaning up your repo" below for exactly what to delete.

## File paths (upload to your repo root, same structure as before)

```
index.html
css/style.css
js/main.js
js/controls.js
js/fighter.js
js/ai.js
js/roster.js
js/arena.js
js/ui.js
js/combat.js
js/audio.js
js/fx.js
```

## Cleaning up your repo

The dungeon-crawl build used some files that this fighting-game build does
**not** use anymore. `index.html`, `css/style.css`, `js/main.js`,
`js/controls.js`, `js/ui.js`, `js/combat.js`, and `js/audio.js` all still
exist but have **entirely new content** — just overwrite them. These old
files are no longer referenced by anything and should be **deleted** from
your repo:

```
js/player.js
js/enemy.js
js/dungeon.js
js/sanity.js
js/enemies/floor1.js
js/enemies/floor2.js
js/enemies/floor3.js
```

(The `js/enemies/` folder can go entirely once those three files are gone.)

## Deploying to GitHub Pages

1. In your existing repo, delete the files listed above.
2. Upload/overwrite with the files in this package, preserving the folder
   structure (`css/`, `js/`).
3. Settings → Pages should already be configured from before — no changes
   needed there. Give it a minute and refresh.

## What's implemented

- **Dynamic dual-fighter camera**: recalculates every frame from the
  midpoint and separation between the two fighters — pulls back as they
  move apart, pushes in as they close, and holds a consistent side so it
  doesn't flip when fighters cross paths. No manual camera control needed;
  it just frames the fight, Power Stone/Smash-style.
- **Movement**: fighters always face each other. Forward/back movement
  walks toward/away from the opponent along that facing; strafe
  circles around them — the standard 3D-arena-fighter movement model
  (Naruto Storm, Power Stone, Tekken's sidestep).
- **Kit**: Light attack (fast, low damage, chains into a combo string with
  damage scaling per hit), Heavy attack (slower, bigger damage/impact,
  resets the light string), Block (held — cuts normal damage ~70%, doesn't
  stop specials, no stagger/combo-break on a successful block), Evade (a
  quick i-frame dash), Special (meter-gated, big damage, chips through
  block, meter fills from dealing/taking damage).
- **Frame-data-style attacks**: every attack has a startup (no hitbox),
  active (hitbox live), and recovery (vulnerable) phase — `js/fighter.js`'s
  `ATTACK_SPECS`. This is what makes attacks punishable/whiffable instead of
  instant.
- **Input buffering**: pressing an attack during your own recovery queues it
  to fire the instant recovery ends, instead of the input just being
  dropped — this is a big part of why real fighting games feel responsive.
- **Knockback**: every attack pushes the defender back on a clean hit (more
  from heavy/special), so hits have real physical weight instead of both
  fighters just standing in place.
- **Hit sparks & screen flash**: `js/fx.js` spawns a small shard-burst at
  the impact point on every landed hit (bigger/gold for heavy/special), and
  heavy/special hits also punch a brief white/gold flash across the whole
  screen (`triggerScreenFlash` in `main.js`).
- **Combo counter**: consecutive landed (non-blocked) hits from the same
  attacker within ~1.1s of each other count as a combo, shown live on
  screen and called out ("4 HIT COMBO!") when the string ends.
- **Damage-trail health bars**: the classic Street Fighter/Tekken cue — a
  pale trail bar drains down slowly to meet the real health bar after
  damage, so you can see how much you just lost at a glance, not just the
  current total.
- **Best-of-3 rounds**: win 2 rounds (KO or higher health when the clock
  hits 0) to win the match and advance the ladder. Round pips show wins for
  both sides; a 60s clock counts down each round.
- **7-fighter arcade ladder** (`js/roster.js`), each with a distinct AI
  archetype (approach range, aggression, block/evade reflexes, light/heavy
  mix, how eagerly they use their special): Dungeon Brute, Blade Thrall,
  Iron Guard, Chain Flagellant, Sentinel Hulk, Shadow Stalker, and final
  boss The Hollow King (gets a phase-2 speed boost at 50% HP).
- **Per-fighter stage themes**: each ladder opponent's stage has a distinct
  torch/fog/ground tint (`js/arena.js`).
- **Synthesized audio** (`js/audio.js`): swings, light/heavy/special hit
  sounds, block thud, evade whoosh, round-start chime, K.O. stinger, victory
  fanfare, defeat stinger — all generated at runtime via the Web Audio API,
  no audio files to host.
- **Age gate**: unchanged from before — a confirmation screen blocks entry
  until the player confirms 18+.

## Controls reference

| Action | Desktop | Mobile |
|---|---|---|
| Move | WASD / arrows | Left virtual stick |
| Light attack | J or Left click | LIGHT button |
| Heavy attack | K or Right click | HEAVY button |
| Block (hold) | Shift (hold) | BLOCK button (hold) |
| Evade | Space | EVADE button |
| Special (needs full meter) | E | SPECIAL button |

## Extending it

- **More fighters**: add entries to `ROSTER` in `js/roster.js` — each needs
  a `def` (stats) and `archetype` (AI behavior params). No new code needed.
- **New attack types**: add an entry to `ATTACK_SPECS` in `js/fighter.js`
  and a corresponding `tryX()` method modeled on `tryHeavy()`.
- **Character select**: currently the player is locked to `PLAYER_DEF` in
  `roster.js` — a select screen would mean picking a `def` before
  `startGame()` runs.
- **Visuals**: swap the primitive Three.js meshes for GLTF models via
  `GLTFLoader` (`three/addons/loaders/GLTFLoader.js`, already in the import
  map) in `Fighter._buildMesh()`.
