# Depth Tokon — 2D Tag-Team Fighter

A browser-native approximation of Marvel Tōkon: Fighting Souls' core
structure: a flat 2D fighting plane, light/medium/heavy attacks with combo
scaling, a unique skill move and a meter-gated ultimate per character, and a
2-character tag team with independent health bars and a tag button. Runs
entirely client-side — no build step, no server — so it works from GitHub
Pages on desktop or mobile.

This **replaces** the earlier 3D arena-fighter build in the same repo.

## Honest scope note

Real Tōkon is a shipped Arc System Works game with hand-animated characters,
rollback netcode, a 20-character roster, and a full 4-character team with
progressive unlock via wall-breaks/throws/round losses. None of that is
realistic to reproduce here. What this build matches is the **mechanical
skeleton**: 2D plane movement, L/M/H combo strings with damage scaling,
skill + ultimate moves, and a tag-team of 2 (not 4) with independent health.
Cut for scope, documented so you know what's missing on purpose:

- **4-character teams / progressive unlock** — this build uses 2-character
  teams, both available from the start. Extending to 4 means adding 2 more
  slots to `Team` and deciding an unlock trigger.
- **Wall-break multi-arena transitions** — not implemented; the stage is a
  single flat plane per match.
- **High/low mix-ups (crouch blocking)** — not implemented; block covers all
  attack types equally. Jump exists as a mobility tool but there's no
  distinct "overhead" attack type yet.
- **Character select screen** — the player's team is fixed
  (`PLAYER_TEAM` in `js/roster.js`); picking a team pre-match would be a
  clean addition.

## File paths (upload to your repo root, same structure as before)

```
index.html
css/style.css
js/main.js
js/controls.js
js/fighter.js
js/team.js
js/ai.js
js/roster.js
js/arena.js
js/ui.js
js/combat.js
js/audio.js
js/fx.js
assets/models/female_ranger/Female_Ranger.gltf
assets/models/female_ranger/Female_Ranger.bin
assets/models/female_ranger/T_Ranger_BaseColor.png
assets/models/female_ranger/T_Ranger_Normal.png
assets/models/female_ranger/T_Ranger_ORM.png
assets/models/female_ranger/T_Regular_Female_Dark_BaseColor.png
assets/models/female_ranger/T_Regular_Female_Normal.png
assets/models/female_ranger/T_Regular_Female_Roughness.png
assets/models/female_peasant/Female_Peasant.gltf
assets/models/female_peasant/Female_Peasant.bin
assets/models/female_peasant/T_Peasant_BaseColor.png
assets/models/female_peasant/T_Peasant_Normal.png
assets/models/female_peasant/T_Peasant_ORM.png
assets/models/female_peasant/T_Regular_Female_Dark_BaseColor.png
assets/models/female_peasant/T_Regular_Female_Normal.png
assets/models/female_peasant/T_Regular_Female_Roughness.png
assets/animations/UAL2_Standard.glb
```

**The `assets/` folder is new (~84MB total)** — real mesh, texture, and
animation data from the packs you uploaded (Modular Character Outfits -
Fantasy, and Universal Animation Library 2). Nothing in that folder existed
in earlier versions of this repo. All files are well under GitHub's 100MB
per-file limit, but this does meaningfully grow your repo size and initial
page-load time — see "Real assets" below for what's actually happening and
how to trim it down if load time matters to you.

## Cleaning up your repo

This is a full rebuild of the fighter genre from the 3D arena-fighter
version — nearly every file changed content even where the filename stayed
the same. Just overwrite everything with this package. Nothing from the
arena-fighter or original dungeon-crawl build is reused, so if you still
have `js/enemy.js`, `js/dungeon.js`, `js/sanity.js`, `js/player.js`, or an
`js/enemies/` folder from further back, those can be deleted — they're not
referenced by anything.

## Deploying to GitHub Pages

1. Delete/overwrite with the files above, preserving the folder structure.
2. Settings → Pages should already be configured from before.

## What's implemented

- **Fixed 2D side-view camera**: pans and zooms along a single line to keep
  both active fighters framed — no orbiting, matching a real 2D fighter's
  presentation (this was the biggest structural difference from the
  previous 3D-arena build).
- **Movement is a true 2D plane**: fighters only move along world X;
  facing is automatic (always toward the opponent). Jump (W / up / JUMP
  button) adds a real vertical arc with gravity.
- **Kit**: Light / Medium / Heavy attacks (chainable into combos with
  progressive damage scaling — each hit that lands while the opponent is
  still stunned from the last one does less), a meter-gated Skill move (30%
  meter, character-unique feel via differing damage/range), and an Ultimate
  (100% meter, big damage, chips through block).
- **Input buffering**: an attack pressed during your own recovery queues up
  and fires the instant you're free instead of being dropped.
- **Tag-team of 2**: each side has an active fighter and a benched
  reserve, each with independent health. Press Tag (Q / TAG button) to swap
  while you can act; tagging in grants a brief invulnerability window like
  real tag fighters. If your active fighter is KO'd and your reserve is
  still alive, they tag in automatically instead of ending the match —
  losing only happens when **both** characters on a team are KO'd.
- **AI teammates tag too**: `shouldAITag()` in `js/ai.js` has the AI swap in
  its healthier reserve when its active fighter is low and the reserve isn't.
- **Combo counter, hit sparks, screen flash, damage-trail health bars,
  hit-stop/camera-punch**: all carried over from the previous pass — these
  make hits read as impactful regardless of which fighter genre sits on top.
- **4-team arcade ladder** (`js/roster.js`'s `LADDER`): The Brutes, The
  Wardens, The Colossi, and the final boss team, The Hollow Court.
- **180s match timer** as a stalemate fallback — if it runs out, whichever
  team has more total remaining health across both characters wins that
  matchup.
- **Age gate**: unchanged — confirmation screen blocks entry until 18+.

## Real assets: The Ranger & The Wanderer

Two new selectable characters use actual assets from the packs you
uploaded, loaded via Three.js's `GLTFLoader` instead of primitive shapes:

- **Mesh + textures**: `Female_Ranger` and `Female_Peasant` from *Modular
  Character Outfits - Fantasy*, glTF export (already self-contained —
  mesh, skeleton, and all referenced textures sitting in one folder).
- **Animations**: *Universal Animation Library 2*'s `UAL2_Standard.glb`,
  loaded once and shared across every model-based fighter (not re-fetched
  per character). I checked this against the character mesh's skeleton
  before wiring anything up — both use the exact same bone names and
  hierarchy (`Head`, `neck_01`, `clavicle_l`, `upperarm_l`, etc.), which is
  why the animations play correctly on a mesh from a *different* pack: Three
  .js's `AnimationMixer` binds clip tracks by bone name, and the names match.
- **Move mapping** (`animMap` in `js/roster.js`): light attacks cycle
  through `Sword_Regular_A/B/C` for visual variety across a combo string,
  medium uses `OverhandThrow`, heavy/ultimate use `Sword_Heavy_Combo`, skill
  uses `Melee_Hook`, block holds `Sword_Block`, evade plays `Sword_Dash`,
  getting hit plays `Hit_Knockback`, and jump uses the `NinjaJump_*`
  sequence. Playback speed is auto-scaled so each attack clip finishes
  right as the move's active/recovery window ends, so the animation and the
  actual hitbox timing stay in sync.
- **Fallback safety**: if a model fails to load (bad path, missing file),
  that fighter automatically falls back to the primitive-mesh look instead
  of just being invisible — check the browser console for the error if that
  happens.

**One thing I could not verify**: which direction the character model faces
by default. I don't have a way to render the scene here, so I picked `0`
for `modelYOffset` (no correction) as a starting guess. If The Ranger or The
Wanderer appears to be facing sideways or backwards in-game, open
`js/roster.js` and change that character's `modelYOffset` to `Math.PI`
(180°), `Math.PI / 2`, or `-Math.PI / 2` — whichever one makes her face the
opponent correctly. That's a one-line fix once you can see it in the
browser.

**Trimming file size**: the normal/roughness maps in these packs are quite
high-resolution (10-14MB each as PNGs). If load time matters, re-exporting
them at a smaller resolution (1024px is usually plenty for a character this
size on screen) or converting to `.webp` would cut the `assets/` folder down
substantially without a visible quality loss at gameplay distance.

## Controls reference

| Action | Desktop | Mobile |
|---|---|---|
| Move | Arrow Left/Right | Left virtual stick |
| Jump | Arrow Up | JUMP button (or flick stick up) |
| Light | A or Left click | L button |
| Medium | S | M button |
| Heavy | D or Right click | H button |
| Skill (30% meter) | F | SKILL button |
| Ultimate (100% meter) | G | ULT button |
| Block (hold) | Space | BLOCK button (hold) |
| Evade | Shift | EVADE button |
| Tag | Q or Tab | TAG button |

## Extending it

- **4-character teams**: extend `Team` to hold an array of 4 and a small
  slot-rotation instead of a single `activeIndex`/`reserve` pair; decide an
  unlock condition (damage dealt, a KO, a timer) for slots 3-4.
- **More characters/teams**: add entries to `CHARACTERS` and `LADDER` in
  `js/roster.js` — no new code needed for simple stat variants.
- **Character select**: gate `startGame()` behind a screen that lets the
  player choose 2 keys from `CHARACTERS` before building `PLAYER_TEAM`.
- **More real-model characters**: follow the same pattern as The
  Ranger/Wanderer in `js/roster.js` — add `modelPath`, `modelYOffset`, and
  `animMap` to any character def and `Fighter` will load it via
  `GLTFLoader` automatically, no code changes needed.
