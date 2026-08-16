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
preview.html
css/style.css
css/preview.css
js/main.js
js/preview.js
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
assets/models/superhero_female/Superhero_Female_FullBody.gltf
assets/models/superhero_female/Superhero_Female_FullBody.bin
assets/models/superhero_female/*.png (11 texture files — skin tones, eyes, hair)
assets/preview_thumbs/*.jpg (19 small generated thumbnails, ~130KB total)
assets/preview_thumbs/manifest.json
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

## Preview tool: audition animations & textures before committing

Open **`preview.html`** directly (separate page, not part of the game) to
browse everything before deciding what maps to what:

- **3D viewport** with orbit controls (drag to rotate, scroll to zoom), a
  dropdown to switch between the three available meshes, and a **"Layer
  base body" checkbox** (on by default) so you can see exactly what the
  game now does — see "Why she had no head" below — and compare it against
  the outfit alone.
- **Animations tab**: every clip that actually exists in `UAL2_Standard.glb`
  — all 43 — grouped by name prefix, each labeled with its exact clip name
  and duration. Click to play looped. Click **+** to add it to the **chain
  builder** and hit **Play Chain** to watch multiple clips actually flow
  together, instead of guessing from names.
- **Textures tab**: all 19 unique texture files across every character
  folder, each a small thumbnail labeled with its **exact source filename**.
  Pick a target material from the dropdown and hit **Apply** to preview it
  live — Base Color/Normal/Roughness apply correctly; ORM (occlusion/
  roughness/metalness packed into one file) is approximated as both
  roughness and metalness, since true channel separation needs more than a
  preview tool.

## Why there are 43 animations, not 130+

I checked — the *Universal Animation Library 2 [Standard]* zip you uploaded
contains exactly 43 unique clips (in `UAL2_Standard.glb`; the `_RM` file has
the same 43, just with root motion baked in instead of in-place). The pack's
own `README.txt` confirms this is the complete "Standard" library and that
the separate `Mannequin_F.glb` deliberately ships **without** any
animations, telling you to pull them from this same 43-clip file. There's no
larger set hidden anywhere in what you gave me.

The 130+ figure is very likely the *combined* total across this pack **and**
the original *Universal Animation Library* (v1, without the "2") — a
separate itch.io page you linked earlier but never actually uploaded. If you
download and upload that one too, I can merge its clips in alongside these
43 — more importantly, v1 may well have an actual walk/run cycle, which
brings up the next issue:

**On the "zombie" walk**: you're not wrong that it looks stiff. Of the 43
clips available, there's no plain "Walk" or "Run" cycle — the only
locomotion loop is `Walk_Carry_Loop`, which is animated with the arms held
as if carrying something, since that's what it was authored for. I mapped
`moving` to it anyway because it was the closest available option, but it's
a real compromise, not a bug — check it yourself in the preview tool's
Animations tab and you'll see the same stiffness on any model. The original
*Universal Animation Library* pack is the most likely place a proper walk
cycle actually lives.

## Why she had no head (found and fixed)

The outfit meshes (`Female_Ranger.gltf`, `Female_Peasant.gltf`) genuinely
don't include a head — this isn't a loading bug, it's how the pack is
designed. Its own `Readme.txt` says outfits are meant to be combined with
the *Universal Base Characters* kit: **"When using the clothing, only the
head of the model is required. Using the full body will result in
clipping."**

The fix: both characters now load **two layered model parts** instead of
one — the outfit, plus the full `Superhero_Female_FullBody` mesh underneath
for the head/hair/eyes (`modelParts` in `js/roster.js`). This required a
real architecture change in `js/fighter.js`: two separately-loaded glTF
files each bring their own skeleton (same bone *names*, but different
object instances), so a single animation mixer bound to one skeleton
wouldn't move the other. Fighters now run one `AnimationMixer` per loaded
part and play the same clip on all of them in parallel, which keeps
everything visually in sync since they're driven by identical keyframe
data on structurally-identical skeletons.

**The trade-off, straight from the pack's own warning**: since the full
body renders underneath instead of *just* the head, there's a real chance
of minor clothing/skin clipping in areas the outfit is supposed to fully
cover — I can't see this myself to know how bad it looks. Check it in
`preview.html`. The Ranger outfit also ships a purpose-built
`Female_Ranger_Head_Hood.gltf` (found while investigating this) which would
fit correctly without that clipping risk, but I didn't wire it in blind — if
the current fix looks wrong for her specifically, tell me and I'll swap her
to the hood piece instead of the full base body.

**A separate real bug I found and fixed along the way**: the base body's
own `.gltf` file references a texture named `T_Eye_Normal_png.png`, which
doesn't exist anywhere in the pack — the actual file is `T_Eye_Normal.png`
(a leftover naming mistake from the pack's own export). I patched the
`.gltf`'s internal reference directly.

## What full customization would still take

Individually swapping hair, eyes, face, body, and outfit as independent,
mix-and-match pieces — not implemented yet, and I want to be upfront that
this is a distinctly bigger feature than the texture/animation preview
already built. It's genuinely possible: the outfit pack ships true modular
pieces (`Female_Ranger_Body/Arms/Legs/Feet/Head_Hood/Acc_Pauldrons.gltf`
individually, not just the pre-combined `Female_Ranger.gltf`), and the base
character kit separately ships swappable hairstyles
(`Hair_Buns/Buzzed/Long/SimpleParted`, plus `Eyebrows_Female/Regular`) as
their own glTF files with their own textures. None of that is wired into
`preview.html` or the game yet — right now you can compare *textures* on
whatever single model is loaded, but not attach/detach independent hair or
body-part meshes. If you want that, say so and I'll build a proper
part-picker into the preview tool (checkboxes per slot: body/arms/legs/
feet/head/hair/eyebrows, each populated from the real files) before wiring
final choices into the game — that's the right next step, but it's its own
chunk of work, not a quick add-on to what's here.

## Real assets: The Ranger & The Wanderer

Two new selectable characters use actual assets from the packs you
uploaded, loaded via Three.js's `GLTFLoader` instead of primitive shapes:

- **Mesh + textures**: `Female_Ranger` and `Female_Peasant` outfits, layered
  with the base body as described above.
- **Animations**: shared `UAL2_Standard.glb` library, loaded once for every
  model-based fighter.
- **Move mapping** (`animMap` in `js/roster.js`): light attacks cycle
  through `Sword_Regular_A/B/C`, medium uses `OverhandThrow`, heavy/ultimate
  use `Sword_Heavy_Combo`, skill uses `Melee_Hook`, block holds
  `Sword_Block`, evade plays `Sword_Dash`, getting hit plays
  `Hit_Knockback`, jump uses `NinjaJump_*`. Playback speed auto-scales so
  each attack clip finishes right as the move's hitbox window ends.
- **Fallback safety**: if any model part fails to load, that fighter falls
  back to the primitive-mesh look instead of being invisible — check the
  browser console if that happens.

**One thing I still can't verify**: which direction the model faces by
default. `modelYOffset` in `js/roster.js` is a one-line fix (`Math.PI`,
`Math.PI / 2`, or `-Math.PI / 2`) if she's facing the wrong way once you
can actually see her in the browser.

**Trimming file size**: the normal/roughness maps here are high-resolution
(10-14MB each as PNGs). If load time matters, re-exporting at 1024px or
converting to `.webp` would cut `assets/` down substantially with no visible
quality loss at gameplay distance.

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
