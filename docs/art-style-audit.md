# Art Style Audit — SetterSaga

**Date:** 2026-08-09
**Scope:** All 48 raster assets under `apps/web/public/`, the `/asset-sheet` route, and the live board via `?preview=game`.
**Goal:** Reach Supercell-tier (Clash Royale / Hay Day / Royal Match) visual quality.

---

## 1. Verdict

**Overall: 6 / 10.** The game board specifically is a **4.5 / 10** and is the dominant reason the product reads as unpolished.

| Benchmark | Score | Position |
| --- | --- | --- |
| Clash Royale / Hay Day / Brawl Stars | 10 | target |
| Royal Match / Playrix | 9 | — |
| Board Kings / Dice Dreams / Monopoly Go | 8 | **realistic near-term target** |
| **SetterSaga (today)** | **6** | current |
| Catan Universe (official) | 5.5 | just below us |
| Colonist.io | 4 | clearly below us |

The core problem is not render quality of individual assets — several are genuinely good. It is that **four different render styles and three different palettes coexist with no enforced contract**, and the highest-screen-time surface (the board) is the least finished.

`shared-assets/coastal-island-kingdom-supercell.png` is an 8/10 that sets an expectation nothing else in the product meets. That contrast makes the board feel worse than it objectively is.

---

## 2. Per-surface scores

| Surface | Score | One-line verdict |
| --- | --- | --- |
| Hero background | 8 | Genuine Supercell energy. The ceiling to match. |
| Home menu icons | 7.5 | Chunky and warm; camera angle inconsistent across the set. |
| Resource cards | 7 | Most cohesive set in the project. Frame lacks material depth. |
| UI icons (bank / hourglass / awards / ports) | 7 | Good bevels, but an orange+teal palette that exists nowhere else. |
| Development + action cards | 6.5 | Strong branding, two different fidelity tiers inside one deck. |
| Ocean canvas | 6 | Correctly quiet, but dead — no foam, depth, or shoreline. |
| **Terrain atlas** | **5** | Highest screen-time, weakest execution. |
| **Board pieces** | **4** | Read as default untextured clay renders. |
| **Player portraits** | **3** | Wrong style *and* broken files. |

---

## 3. Issues

Severity key: **P0** = blocks "looks professional"; **P1** = style unification; **P2** = polish.

---

### ART-001 — The island has no coast (P0)

**Severity:** P0 — single largest contributor to the "trash" read.

**Observed:** Every hex is a colour patch clipped to a rounded hexagon and outlined with a flat 2D picture-frame stroke: an 8px dark ring, a 4.5px gold ring, and a 1.5px shine ring (`board-canvas.tsx:414-443`). There is no land thickness, no cliff band, no grass overhang, and no coastline anywhere on the island.

**Why it fails:** The gold frame-per-tile is a *stained-glass / quilt* metaphor. It fights the naturalistic terrain art sitting inside it and prevents 19 tiles from ever reading as one landmass. Compare to `coastal-island-kingdom-supercell.png`, which sells the island entirely through thick rocky cliffs, a grass lip that overhangs the rock, and a foam line at the waterline — none of which the board has.

**Files:** `apps/web/src/components/game/board-canvas.tsx:414` (`drawTerrainBorder`), `apps/web/public/game-assets/terrain/terrain-atlas.png`

**Fix:**
1. Bake a coast treatment into the atlas frames: a ~14px darker inner rim, a grass overhang lip, and a rocky cliff band on the outer ring of each frame.
2. Replace the per-tile gold frame with a **perimeter-only** island outline. Interior tile boundaries get a soft 1px darkened seam at most, so adjacent land reads continuous.
3. Compute the union silhouette of the 19 tiles once and stroke/shade only that.

**Acceptance:** At 100% zoom, a screenshot of the board reads as one island with a visible shoreline, not 19 framed tiles.

---

### ART-002 — Nothing anchors the island to the water (P0)

**Severity:** P0

**Observed:** `renderStaticScene` (`board-canvas.tsx:268-294`) runs exactly two passes — `drawTerrain` then `drawPorts`. There is no island drop-shadow pass, no ambient-occlusion pass, and no foam/waterline pass. The landmass floats on flat teal.

**Files:** `apps/web/src/components/game/board-canvas.tsx:268`

**Fix:** Add a pre-terrain pass that fills the union silhouette offset by ~(0, +10) with a blurred dark navy at ~30% alpha, plus a post-terrain foam ring (2–4px soft white, slightly irregular) along the perimeter.

**Acceptance:** The island casts a visible shadow onto the ocean and has a foam line at every water-facing edge.

---

### ART-003 — Mountains tile is blue (P0)

**Severity:** P0 — readability, not just taste.

**Observed:** In `terrain-atlas.png` the mountains frames use a saturated mid-blue background. Nothing in the visual language of the genre says blue = rock, and it actively competes with the teal ocean underneath, so mountain tiles read as lakes.

**Files:** `apps/web/public/game-assets/terrain/terrain-atlas.png` (column 0, row 1 and its variants)

**Fix:** Recolour to slate-grey / violet-grey with a warm bounce light, matching how the hero background renders its rock.

**Acceptance:** A mountain tile adjacent to open water is unambiguously land at a glance.

---

### ART-004 — Three warm terrains blur into one orange mass (P0)

**Severity:** P0 — readability.

**Observed:** Hills (orange), fields (orange-yellow), and desert (tan-orange) occupy the same hue family. On the live board they sit adjacent and three of six terrain types become indistinguishable in peripheral vision.

**Files:** `apps/web/public/game-assets/terrain/terrain-atlas.png`

**Fix:** Separate by hue *and* value, not just prop:
- Hills → terracotta / brick red, darker value
- Fields → warm golden wheat, lightest value
- Desert → pale bone / sand, desaturated

**Acceptance:** All six terrain types are distinguishable from a squinted / 50%-scale screenshot.

---

### ART-005 — Player portraits ship without alpha (P0, shipping bug)

**Severity:** P0 — this is a defect, not a style opinion.

**Observed:** All eight files in `apps/web/public/game-assets/players/` are mode `RGB` with a baked opaque white square background. Verified for all 8:

```
blue-cartographer.png    256x256  RGB  trans=False
green-botanist.png       256x256  RGB  trans=False
orange-builder.png       256x256  RGB  trans=False
pink-pathfinder.png      256x256  RGB  trans=False
purple-astronomer.png    256x256  RGB  trans=False
red-navigator.png        256x256  RGB  trans=False
teal-shipwright.png      256x256  RGB  trans=False
yellow-merchant.png      256x256  RGB  trans=False
```

**Impact:** They can only ever be displayed inside a fully opaque mask. Any glassmorphic, rounded, or non-circular frame — which the app's current styling direction favours — will show a white box.

**Files:** `apps/web/public/game-assets/players/*.png`, referenced from `apps/web/src/constants/game/player-assets.ts:4-11`

**Fix:** Re-export all eight with a real alpha channel.

**Acceptance:** Every portrait composites cleanly over the blue chrome with no white halo or box.

---

### ART-006 — Player portraits are in a different art style from everything else (P0)

**Severity:** P0

**Observed:** The portraits are soft, near-photoreal 3D character renders — visible skin shading, individual hair strands, subsurface-scattering-like softness. Every other asset in the project is matte clay with chunky forms and hard bevels. Side by side they look imported from a different game.

**Fix:** Re-author in matte clay: chunky proportions, ~1.5-head-to-body caricature, flat matte skin, no strand-level hair, one hard key light and one warm rim.

**Acceptance:** A portrait placed next to `game-assets/cards/development/knight.png` reads as the same universe.

---

### ART-007 — All eight portraits are indistinguishable at avatar size (P0)

**Severity:** P0 — gameplay readability.

**Observed:** All eight wear the same cream jacket with the same collar and a differently-coloured scarf. Four of the eight share a near-identical face with only hair variation. At the ~40px size they render in the HUD, the only differentiator is the ring colour — the portrait itself carries zero information.

**Fix:** Give each seat a distinct **silhouette** plus one saturated seat-coloured garment: e.g. hood, wide-brim hat, goggles-on-forehead, headwrap, beard, ponytail, cap, bandana. Silhouette must be identifiable in solid black at 32px.

**Acceptance:** Render all eight as 32px black silhouettes — all eight remain individually identifiable.

---

### ART-008 — Board pieces read as untextured placeholders (P0)

**Severity:** P0

**Observed:** `road-piece.png`, `settlement-piece.png`, `city-piece.png` are smooth, untextured beige forms with soft uniform shading — the look of an unlit default clay render. `road-piece.png` in particular is a rounded rectangle scored into four segments. On the live board the roads read as dropped bricks rather than roads.

**Impact compounded by tinting:** They are player-tinted at runtime (`getTintedPieceCanvas`, `board-canvas.tsx:951`). A flat beige base tints to muddy pastels rather than the saturated seat colours defined in the brand palette.

**Files:** `apps/web/public/game-assets/pieces/*.png`, `apps/web/src/components/game/board-canvas.tsx:911-987`

**Fix:** Re-author each piece with a saturated mid-tone base (so tinting lands on-palette), a dark bottom contact edge, a distinctly brighter top plane, and a warm rim. Replace the road with actual planks and posts.

**Acceptance:** A red road and a red settlement on grass are both unmistakably their object type at 100% zoom, in the correct saturated seat red.

---

### ART-009 — Ports read as debris around the island (P1)

**Severity:** P1

**Observed:** `drawPorts` / `drawDock` / `drawPort` / `drawPortTradeBadge` (`board-canvas.tsx:524-632`, `988`) place a boat plus a plank bridge plus a cropped resource-card badge at each port. On the live board the bridges jab into hex edges at inconsistent angles, clip the tile boundary, and the `3:1` badges are small bright cards scattered around the perimeter. Collectively they surround the island like litter rather than framing it.

**Fix:**
1. Snap each dock to the outward normal of its host hex edge so bridges are perpendicular, never oblique.
2. Draw ports **under** the island silhouette shadow so they visually attach to land.
3. Replace the cropped-resource-card badge with a purpose-built port sign asset in the UI palette — cropping a card face is why they read as foreign objects.

**Acceptance:** Every port sits flush against the coastline with its bridge perpendicular to the shore, and the badges read as signage.

---

### ART-010 — Number tokens sit on top of the hero prop (P1)

**Severity:** P1

**Observed:** `drawNumberToken` (`board-canvas.tsx:445-522`) *does* build a proper coin — shadow, rim gradient, face gradient, specular arc, red treatment for 6/8, pip dots. The execution is fine. Two problems:
1. It is offset to `y + tileSize * 0.18 + 2`, which places it directly over the terrain prop (the `8` covers the wheat sheaf; the `9` covers the bricks).
2. The bevel bands are only 2px and 6px wide against a radius capped at 39, so the coin depth does not survive at render scale.

**Fix:** Reserve a clear zone in the atlas frames (shift the hero prop up, or design frames with a bottom-third dead area), and widen the rim/face bands to ~10% of radius each so the bevel reads.

**Acceptance:** No number token overlaps the silhouette of its tile's hero prop, and the coin's edge highlight is visible at 100% zoom.

---

### ART-011 — Terrain icons have inconsistent key-light direction (P1)

**Severity:** P1 — this is the most legible "amateur" tell in a prop set.

**Observed:** Across the six terrain frames: pine trees carry a hard cyan rim on the right edge; sheep are lit near-flat; rocks are lit hard from top-left with a cool grey shadow; the wheat sheaf is nearly ambient with no directional shadow; the cactus carries a cyan rim on the right. Five props, at least three different lighting setups.

**Fix:** Relight the whole set to a single contract (see ART-014).

**Acceptance:** All six terrain props cast their contact shadow in the same direction.

---

### ART-012 — Terrain atlas is 8.1 MB for imperceptible variation (P1)

**Severity:** P1 — performance.

**Observed:** `terrain-atlas.png` is **1536×3072, 8.1 MB**, holding 18 frames (6 terrains × 3 variants). The variants differ only by slight rotation and a scale factor of 1.03–1.10 (`board-assets.ts:29-34` `TERRAIN_VARIANT_SCALE`). The variation is not perceivable in play.

**Fix:** Either make variants genuinely different (different prop counts, scatter decals, different placement) or drop to one variant per terrain and reclaim ~5 MB. Re-encode with palette quantisation regardless.

**Acceptance:** Atlas under 2.5 MB, or variants visibly distinct.

---

### ART-013 — Asset sheet metadata for the atlas is wrong (P2)

**Severity:** P2 — documentation accuracy.

**Observed:** `apps/web/src/app/asset-sheet/page.tsx:158-165` describes the atlas as:

> "Single-source 3×2 atlas … PNG · 1536×1024 · six 512×512 frames"

The actual file is **1536×3072 with 18 frames**, and `TERRAIN_ATLAS` in `board-assets.ts:8-22` correctly declares `rows: 6, variantCount: 3`. The asset sheet is stale.

**Fix:** Update the description and format string. Ideally derive them from `TERRAIN_ATLAS` so they cannot drift again.

---

### ART-014 — No shared lighting/material contract (P1)

**Severity:** P1 — root cause of most of the above.

**Observed:** Four render styles coexist with nothing enforcing consistency:

| Style | Assets |
| --- | --- |
| Painted key art | `shared-assets/coastal-island-kingdom-supercell.png` |
| Matte clay | resource cards, dev cards, terrain props |
| Smooth untextured 3D | board pieces |
| Near-photoreal | player portraits |

**Fix:** Define and commit an art bible as a constants file, then regenerate/relight non-conforming assets against it:

- Key light: 135° top-left
- Rim light: 45° top-right, `#FFE9B0` at 20%
- Contact shadow: `#05264C` at 35%, offset (0, +6% of asset height)
- Bevel radius: 6% of asset shortest side
- Material: matte, high roughness, no specular hotspots
- No outlines anywhere

**Acceptance:** Any two assets pulled at random read as the same production.

---

### ART-015 — Three competing palettes on one screen (P1)

**Severity:** P1

**Observed:**

| Family | Where |
| --- | --- |
| Deep blue chrome | `#014A8E` / `#0057A9` / `#05264C` app shell |
| Purple + gold | development cards, action cards |
| Saturated primaries | terrain tiles |
| Orange + teal | bank, hourglass, end-turn, awards, ports |

Four families, all visible simultaneously during a turn.

**Fix:** Collapse to two — **World** (terrain, board, pieces) and **UI** (cards, chrome, icons). Fold the orange+teal icon family into UI by re-tinting to the purple+gold system.

---

### ART-016 — Development and action cards use the same purple+gold treatment (P1)

**Severity:** P1 — UX-through-art.

**Observed:** `cards/development/*` and `cards/actions/*` share an identical purple background, gold frame, and gold prop treatment. The player cannot distinguish "card I hold" from "button I press" by colour alone.

**Fix:** Keep purple for the held development deck; move action cards to a distinct frame colour (the UI blue, or a green "build" family), retaining the same frame *geometry* so they still read as one system.

---

### ART-017 — Uneven illustration fidelity inside the development deck (P1)

**Severity:** P1

**Observed:** Within one deck: Knight and Monopoly are fully-painted characters with faces and costume detail; Road Building and Victory Point are flat embossed graphic shapes. Two fidelity tiers in a deck the player fans out side by side.

Additional specifics:
- **Road Building** — the two roads read as topiary or caterpillars, not roads. Legibility failure.
- **Trade card** — introduces a teal awning and backpack; teal appears nowhere else in the card system.
- **Backgrounds** — each card uses a different emboss motif (shields, dots, stars, sun+laurel, circles). A deck should share one motif and differentiate by accent.

**Fix:** Pick one fidelity tier (recommend: hero prop, no faces, matching the resource cards) and rebuild the outliers. One emboss motif deck-wide.

---

### ART-018 — Ocean canvas is inert (P2)

**Severity:** P2

**Observed:** `ocean-board-canvas.webp` is flat teal with faint noise. No depth gradient toward land, no caustics, no foam, no directional highlight.

**Fix:** Add a subtle depth gradient (lighter turquoise in shallows near the island footprint, deeper navy at the edges) and low-contrast caustic ripples. Keep contrast low — the board must stay the focus.

---

### ART-019 — Board occupies 65% of its container width (P2)

**Severity:** P2 — layout, not art, but it amplifies every art issue.

**Observed (measured live):** the board canvas renders at **522×574** inside a `.board-shell` of **805×517**. That is 35% horizontal dead space, and the canvas is simultaneously **57px taller than its container**, so it overflows vertically while wasting horizontal room.

**Files:** `apps/web/src/lib/game/board-layout.ts:6-13` (`BOARD_CANVAS` 1200×1320 — a 0.91 aspect ratio fighting a 1.56 container), `.board-shell` styling.

**Fix:** Fit the board to the container's *shorter* constraint and let the island bleed wider. Consider reducing `BOARD_CANVAS.height` padding so the aspect ratio is closer to the shell's.

**Acceptance:** Board fills ≥85% of the available shell width with no vertical overflow.

---

### ART-020 — Home menu icons use inconsistent camera angles (P2)

**Severity:** P2

**Observed:** `quick-match-v2.png` and `host-island-v2.png` are 3/4 isometric floating islands with a ground plane. `join-crew-v2.png` is a flat, face-on scroll with no ground. Three icons, two cameras, no shared ground/shadow contract.

Secondary: all three are ~1080×1080 rendered at roughly 130px on screen. The pine needles and cobblestone detail turn to mush at display size.

**Fix:** Put the scroll on a floating island base to match, or reshoot all three face-on. Simplify detail density for the actual render size.

---

## 4. Prioritised plan

### P0 — buys roughly 80% of the perceived quality jump

| ID | Item |
| --- | --- |
| ART-001 | Bake coast/cliff edges into the atlas; perimeter-only island outline |
| ART-002 | Island drop shadow + foam ring passes |
| ART-003 | Recolour mountains from blue to slate |
| ART-004 | Separate hills / fields / desert by hue and value |
| ART-005 | Re-export portraits with alpha |
| ART-006 | Restyle portraits to matte clay |
| ART-007 | Distinct silhouettes + saturated seat garments per portrait |
| ART-008 | Re-author the four board pieces |

### P1 — unification

| ID | Item |
| --- | --- |
| ART-014 | Commit the art bible constants; relight non-conforming assets |
| ART-015 | Collapse four palettes into World + UI |
| ART-011 | Relight terrain props to a single key direction |
| ART-016 | Differentiate action cards from development cards |
| ART-017 | Normalise development deck fidelity; fix Road Building legibility |
| ART-009 | Snap port docks to edge normals; replace card-crop badges |
| ART-010 | Move number tokens off the hero prop; widen bevel bands |
| ART-012 | Fix atlas variants or drop them; re-encode |

### P2 — polish

| ID | Item |
| --- | --- |
| ART-018 | Ocean depth gradient + caustics |
| ART-019 | Board fills its container |
| ART-020 | Unify home menu icon cameras |
| ART-013 | Fix stale asset sheet atlas metadata |

---

## 5. Expected outcome

| Stage | Score |
| --- | --- |
| Today | 6.0 |
| After P0 | 7.5 |
| After P0 + P1 | **8.5** — Board Kings / Dice Dreams tier |
| After P0 + P1 + P2 | 8.5–9.0 |

A true 9–10 requires a human art director iterating on top of generation, not better prompts. P0 + P1 is the achievable ceiling for a generated pipeline with an enforced style contract.

---

## 6. Method

- All 48 rasters under `apps/web/public/` inspected directly via generated contact sheets grouped by category.
- Dimensions, colour mode, alpha presence, and file size audited programmatically for every file.
- `/asset-sheet` reviewed live, including the 19-tile masked board preview.
- Live board reviewed at `?preview=game`, including a 2.4× zoom pass for edge and lighting detail.
- Container and canvas dimensions measured in-page rather than estimated.
- Draw order and edge/token/port rendering read from `apps/web/src/components/game/board-canvas.tsx`.
