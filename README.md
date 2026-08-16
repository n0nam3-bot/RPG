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
assets/animations/UAL1_Standard.glb
assets/models/hair/Hair_Long.gltf
assets/models/hair/Hair_Long.bin
assets/models/hair/T_Hair_2_BaseColor.png
assets/models/hair/T_Hair_2_Normal.png
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
- **Animations tab**: every clip from both `UAL2_Standard.glb` and
  `UAL1_Standard.glb` merged — 85 unique clips — grouped by name prefix,
  each labeled with its exact clip name and duration. Click to play looped.
  Click **+** to add it to the **chain builder** and hit **Play Chain** to
  watch multiple clips actually flow together, instead of guessing from
  names.
- **Textures tab**: all 19 unique texture files across every character
  folder, each a small thumbnail labeled with its **exact source filename**.
  Pick a target material from the dropdown and hit **Apply** to preview it
  live — Base Color/Normal/Roughness apply correctly; ORM (occlusion/
  roughness/metalness packed into one file) is approximated as both
  roughness and metalness, since true channel separation needs more than a
  preview tool.

## Animations: 85 clips now, and the "zombie" walk is fixed

You uploaded the *Universal Animation Library* (v1, without the "2") this
round — I checked it the same way as before: same 67-node `Armature`
skeleton, fully compatible, 43 more clips. Combined with v2's 43 (minus one
duplicate `A_TPose` shared by both), that's **85 unique clips**, all
browsable in `preview.html` now. Both `.glb` files load and merge
automatically in the game too (`js/fighter.js`'s `loadAnimationLibrary()`).

Critically, v1 has things v2 didn't: `Walk_Loop` (an actual walk cycle),
`Roll`, `Death01`, `Idle_Loop`, `Jump_Start/Loop/Land`. I remapped both
characters to use these instead of the awkward placeholders from before:

| Move | Old (v2 only) | New |
|---|---|---|
| Walking | `Walk_Carry_Loop` (arms held like carrying something — the "zombie" look) | `Walk_Loop` |
| Idle | `Idle_FoldArms_Loop` / `Idle_No_Loop` | `Idle_Loop` |
| Jump | `NinjaJump_Idle_Loop` | `Jump_Loop` |
| Evade | `Sword_Dash` | `Roll` |
| K.O. | `Hit_Knockback` (reused) | `Death01` |

The 130+ figure you originally remembered is still probably a Pro-tier or
some other combined total I don't have visibility into, but between the two
Standard packs you've now given me, 85 is the real number available.

## Why she had no head — and why it's now fixed differently for each of them

The outfit meshes genuinely ship with no head by design — the pack's own
`Readme.txt` says so: outfits pair with the *Universal Base Characters* kit,
and using the full base body under them risks clipping. But investigating
your screenshots turned up something I'd missed the first time: **the two
outfits aren't built the same way.**

- **`Female_Ranger.gltf`** already includes her own bundled
  `Female_Ranger_Head_Hood` mesh — she never actually needed the base body
  layered under her. I was doing it anyway, for no benefit and unnecessary
  clipping risk. **Fixed**: she now loads standalone, just her own outfit
  file, nothing layered.
- **`Female_Peasant.gltf`** has zero head geometry and no hood option — she
  genuinely needs the base body layered in, there's no alternative. This is
  also very likely the direct cause of what you saw in the screenshots: the
  bald head and the patchy/pale-skin look on her arms and midriff are the
  base body's own skin showing through gaps where her outfit doesn't fully
  cover it — exactly the clipping the pack's README warns about, not a
  texture bug. I checked her actual `T_Peasant_BaseColor.png` file directly
  and it's a normal, correctly-formed texture; the mismatch you're seeing is
  a geometry/coverage issue, not a broken image.
- **Hair, fixed for real this time**: neither the base body nor either
  outfit includes hair geometry at all — I'd missed this earlier. The base
  character kit ships hairstyles as fully separate, head-bone-rigged glTF
  files. I added `Hair_Long` as a third layered part for The Wanderer (who
  needs it — she has no hood). The Ranger's hood already covers her head, so
  I didn't add hair under it; if her hood turns out to have a visible gap
  that needs hair peeking through, tell me and I'll add it for her too.

Loading 2-3 separately-authored glTF files and keeping them animated
together required a real architecture change in `js/fighter.js`: each file
brings its *own* skeleton instance (same bone names, but different objects),
so one `AnimationMixer` bound to one skeleton won't move another. Fighters
now run one mixer per loaded part and play the same clip on all of them in
parallel — they stay in sync because they're driven by identical keyframe
data on structurally-identical skeletons.

**The Wanderer's clipping risk is still real and unresolved** — I have no
way to render her and check how bad it looks with this fix. `preview.html`
now has independent "Layer base body" and "Layer hair" checkboxes so you
can inspect this yourself. If the clipping is bad enough to be distracting,
the honest options are: live with it (it's the only way she gets a head at
all from these packs), or source/request a dedicated head/hair piece
built specifically for the Peasant outfit, which doesn't exist in what
you've uploaded so far.

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
individually, not just the pre-combined `Female_Ranger.gltf` — note Peasant
doesn't have this option since her modular pieces are Body/Arms/Legs/Feet
only, no head variant exists for her), and the base character kit
separately ships 6 more hairstyles beyond `Hair_Long`
(`Hair_Buns/Buzzed/BuzzedFemale/SimpleParted/Beard`, plus
`Eyebrows_Female/Regular`) as their own glTF files. None of that is wired
into `preview.html` or the game yet — right now you can compare *textures*
on whatever single model is loaded, and toggle base-body/hair on or off,
but not attach/detach independent hair styles or body-part meshes. If you
want that, say so and I'll build a proper part-picker into the preview tool
(checkboxes per slot: body/arms/legs/feet/head/hair/eyebrows, each
populated from the real files) before wiring
final choices into the game — that's the right next step, but it's its own
chunk of work, not a quick add-on to what's here.

## Real assets: The Ranger & The Wanderer

Two new selectable characters use actual assets from the packs you
uploaded, loaded via Three.js's `GLTFLoader` instead of primitive shapes:

- **Mesh + textures**: `Female_Ranger` (standalone — she has her own
  bundled head) and `Female_Peasant` (layered with the base body + hair, per
  "Why she had no head" above).
- **Animations**: both `UAL2_Standard.glb` and `UAL1_Standard.glb` merged
  into one shared library, loaded once for every model-based fighter.
- **Move mapping** (`animMap` in `js/roster.js`): light attacks cycle
  through `Sword_Regular_A/B/C`, medium uses `OverhandThrow`, heavy/ultimate
  use `Sword_Heavy_Combo`, skill uses `Melee_Hook`, block holds
  `Sword_Block`, evade plays `Roll`, getting hit plays `Hit_Chest`, K.O.
  plays `Death01`, walking uses `Walk_Loop`, jump uses `Jump_Loop`. Playback
  speed auto-scales so each attack clip finishes right as the move's hitbox
  window ends.
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
