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
```

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

## Controls reference

| Action | Desktop | Mobile |
|---|---|---|
| Move | A/D or arrows | Left virtual stick |
| Jump | W or Up | JUMP button (or flick stick up) |
| Light | J or Left click | L button |
| Medium | K | M button |
| Heavy | L or Right click | H button |
| Skill (30% meter) | I | SKILL button |
| Ultimate (100% meter) | U | ULT button |
| Block (hold) | Shift | BLOCK button (hold) |
| Evade | Space | EVADE button |
| Tag | Q or Tab | TAG button |

## Extending it

- **4-character teams**: extend `Team` to hold an array of 4 and a small
  slot-rotation instead of a single `activeIndex`/`reserve` pair; decide an
  unlock condition (damage dealt, a KO, a timer) for slots 3-4.
- **More characters/teams**: add entries to `CHARACTERS` and `LADDER` in
  `js/roster.js` — no new code needed for simple stat variants.
- **Character select**: gate `startGame()` behind a screen that lets the
  player choose 2 keys from `CHARACTERS` before building `PLAYER_TEAM`.
- **Visuals**: swap the primitive Three.js meshes for GLTF models via
  `GLTFLoader` in `Fighter._buildMesh()`.
