---
name: game-asset-gen
description: Generate game art for SetterSaga with the asset-gen MCP server, applying this project's style contract, per-slot size and transparency specs, post-processing, and code registration. Use this whenever the user wants new or replacement art for the game — terrain tiles, resource or development cards, board pieces, player portraits, UI icons, awards, menu art, backgrounds — or says anything like "generate an icon", "make a new tile", "we need art for X", "this asset looks off, redo it", "regenerate the portraits", or "add art for the new card". Also use it when auditing or fixing existing assets for style consistency, missing transparency, or wrong dimensions, and when someone asks why generated art doesn't match the rest of the game.
---

# SetterSaga asset generation

## Why this skill exists

`mcp__asset-gen__generate_game_asset` is a raw image generator, not an asset
pipeline. It saves an **opaque** image at one of **five fixed aspect ratios**
into `apps/web/public/assets/generated/` — which is a staging folder that
nothing in the app reads. A generation is roughly 30% of the work.

The other 70% is the part that gets skipped, and skipping it is how the current
asset set ended up inconsistent. Three failures are already in the repo and are
documented in `docs/art-style-audit.md`:

- All eight player portraits shipped as opaque RGB with a baked white square,
  so they can never sit in a rounded or glass frame (ART-005).
- Terrain props were generated with at least three different key-light
  directions, which is the most legible "amateur" tell in a prop set (ART-011).
- The board pieces were generated in flat beige, which the runtime multiply-tint
  turns to mud instead of the seat colours (ART-008).

Every one of those was avoidable at generation time. That is what the workflow
below is for.

## Workflow

1. **Find the slot's spec** — read `references/asset-specs.md`. It gives the
   final pixel size, the destination directory, whether alpha is required, which
   aspect ratio to request, and any per-category trap.
2. **Write the prompt against the style contract** — read
   `references/art-bible.md` for the lighting, material, and palette rules, and
   `references/prompt-recipes.md` for a proven skeleton to adapt.
3. **Generate** into the staging folder.
4. **Post-process** with `scripts/postprocess.py` — alpha, crop, size.
5. **Move into place** under `apps/web/public/game-assets/…`.
6. **Register in code** so the app can actually see it.
7. **Verify** against the checklist at the bottom.

Steps 4–6 are not optional polish. An asset that stops at step 3 is invisible to
the game and usually wrong on transparency and size.

## Generating

```
mcp__asset-gen__generate_game_asset(
  prompt: "<style contract + subject + framing + background>",
  filename: "knight-card-v1",
  aspectRatio: "3:4"
)
```

**Version your filenames** (`-v1`, `-v2`). The tool overwrites silently on a
name collision, and you will usually want to compare two takes side by side
before committing to one.

**Aspect ratio is 1:1, 16:9, 9:16, 4:3, or 3:4 — that is the whole list.** The
card slots use 512×768, which is 2:3, and 2:3 is not offered. Request `3:4` and
centre-crop down in post. Do not try to prompt your way to a ratio the API does
not expose; you will get a 3:4 image with the subject composed for 3:4 and a
worse crop than the script gives you.

**Assume the output is opaque.** The model bakes a background even when the
prompt says "transparent background". Ask for a *flat, uniform, high-contrast*
backdrop instead — that is what makes the flood-fill in step 4 clean. See the
art bible for the exact phrasing.

## Post-processing

`scripts/postprocess.py` handles alpha, trimming, aspect, and resizing in one
pass. It needs only Pillow, which is what this machine has.

```bash
# Transparent icon: strip backdrop, trim, square up, final size
python3 .claude/skills/game-asset-gen/scripts/postprocess.py \
  apps/web/public/assets/generated/bank-v1.png \
  apps/web/public/game-assets/ui/bank.png \
  --alpha flood --trim --pad 1:1 --size 256x256

# Card: crop the 3:4 generation to the 2:3 the slot expects
python3 .claude/skills/game-asset-gen/scripts/postprocess.py \
  apps/web/public/assets/generated/knight-card-v1.png \
  apps/web/public/game-assets/cards/development/knight.png \
  --crop-aspect 2:3 --size 512x768

# Full-bleed terrain frame: no alpha, no trim
python3 .claude/skills/game-asset-gen/scripts/postprocess.py \
  apps/web/public/assets/generated/pasture-v1.png \
  /tmp/pasture-frame.png \
  --crop-aspect 1:1 --size 512x512
```

Use `--alpha flood` rather than `--alpha white` unless the subject is flat line
art. Flood fill only clears pixels *connected to the border*, so a cream card
frame or white sheep wool survives; a blanket "delete all white" pass punches
holes through the middle of the artwork.

The script prints the final dimensions, whether the result actually carries
transparency, and the file size. Read that line — it is the cheapest possible
check that step 4 did what you intended.

## Registering the asset

A file under `public/` is inert until it is referenced. Wire it into the
constants module that owns that category, then add it to the asset sheet:

| Category | Constants module |
| --- | --- |
| Resource / development / action cards | `apps/web/src/constants/game/card-assets.ts` |
| Board + ocean + ports + terrain atlas | `apps/web/src/constants/game/board-assets.ts` |
| Player portraits | `apps/web/src/constants/game/player-assets.ts` |
| Awards | `apps/web/src/constants/game/award-assets.ts` |
| Misc UI icons | `apps/web/src/constants/game/ui-assets.ts` |

Then add an entry to `ASSET_CATEGORIES` in
`apps/web/src/app/asset-sheet/page.tsx` with an accurate `format` string. That
page is the project's art inventory — an unlisted asset is one nobody will
notice has drifted. Its metadata has gone stale before (ART-013), so state real
dimensions rather than copying a neighbour's.

Per `AGENTS.md`, colours in components come from the global CSS tokens, never
from custom classes. That applies to any frame or chrome you build around a new
asset.

## Verification checklist

Before calling an asset done:

- **Dimensions** match `references/asset-specs.md` exactly.
- **Transparency** is present if the spec asks for it — the script's output line
  says `transparent` or `opaque`. Portraits, icons, pieces, awards, and menu art
  all need alpha.
- **Light direction** matches its siblings. Put the new asset next to two
  existing ones in the same category and confirm the shadows fall the same way.
  This is the check that catches ART-011-class drift, and it takes ten seconds.
- **Reads at render size.** Downscale to the size it actually displays at (icons
  ~40px, portraits ~40px, tiles ~145px radius) and confirm the silhouette still
  reads. Detail that only exists at 512px is wasted weight.
- **File size** is proportionate — icons under ~120KB, cards under ~500KB. If a
  full-bleed asset lands far above its neighbours, re-encode.
- **Registered** in the constants module and listed on the asset sheet.

## When regenerating an existing asset

Keep the old file until the new one is verified in the running app
(`pnpm dev:web`, then `?preview=game` for anything on the board). Overwriting in
place means a failed generation silently degrades the game with nothing to diff
against.

If you are replacing one member of a set — one terrain frame, one portrait — the
new asset must match the *set*, not the art bible in isolation. Open its
siblings first and match their lighting and colour temperature, and only then
reach for the general rules.
