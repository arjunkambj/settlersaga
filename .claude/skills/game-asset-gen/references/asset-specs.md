# Asset slot specifications

Every slot in the game, with the exact output the app expects. Match these
precisely — the renderers assume them.

## Quick table

| Slot | Final size | Alpha | Request | Destination |
| --- | --- | --- | --- | --- |
| Resource card | 512×768 | yes | `3:4` | `game-assets/cards/resources/` |
| Development card | 512×768 | yes | `3:4` | `game-assets/cards/development/` |
| Action card | 512×768 | yes | `3:4` | `game-assets/cards/actions/` |
| Terrain atlas frame | 512×512 | **no** | `1:1` | composited into `game-assets/terrain/terrain-atlas.png` |
| Board piece | 512×512 | yes | `1:1` | `game-assets/pieces/` |
| Robber piece | 512×512 | yes | `1:1` | `game-assets/pieces/` |
| Player portrait | 256×256 | yes | `1:1` | `game-assets/players/` |
| UI icon | 256×256 | yes | `1:1` | `game-assets/ui/` |
| Award | 512×512 | yes | `1:1` | `game-assets/awards/` |
| Victory flourish | 1536×512 | yes | `16:9` then crop | `game-assets/results/` |
| Home menu icon | 1080×1080 | yes | `1:1` | `home-assets/menu/` |
| Ocean canvas | 1586×992 | no | `16:9` | `game-assets/ui/` (WebP) |
| Hero background | 1672×941 | no | `16:9` | `shared-assets/` |

## Per-slot notes

### Cards — 512×768, transparent

2:3 is not an available aspect ratio. Generate at `3:4` and centre-crop:

```bash
--crop-aspect 2:3 --size 512x768
```

Compose for the crop: keep the hero prop within the middle ~85% vertically or
the top and bottom of the illustration will be cut.

The card frame is part of the art — cream outer border, gold inner rule, purple
field. All labels, counts, and costs are drawn in code over the top, so the
artwork must not contain text.

One open issue (ART-016): development and action cards currently share the same
purple-and-gold treatment, so players cannot tell a held card from a button. If
you generate a new action card, give it a distinct frame colour while keeping
the same frame *geometry*.

### Terrain atlas frames — 512×512, opaque, full bleed

Terrain is unusual: frames are full-bleed squares that the board clips into
hexes at runtime, so they need **no alpha** and must have **no margin**. Colour
runs edge to edge.

The atlas is a single 3-column × 6-row sheet at `1536×3072`, laid out as six
terrains × three variants. `TERRAIN_ATLAS` in
`apps/web/src/constants/game/board-assets.ts` is the authority on frame
coordinates — read it before touching the sheet, and recomposite the whole atlas
rather than editing frames in isolation.

Terrain-specific constraints from the audit:

- Mountains must be slate/violet-grey, not blue — blue reads as water against
  the ocean beneath (ART-003).
- Hills, fields, and desert must separate by hue *and* value, not just by prop
  (ART-004).
- The hero prop should sit in the upper two-thirds. The number token is drawn at
  `y + tileSize * 0.18`, and currently lands on top of the artwork (ART-010).

### Board pieces — 512×512, transparent, near-white

Read the runtime-tint section of `art-bible.md` before generating these. The
multiply blend means a light, desaturated base is a hard requirement, not a
stylistic preference.

Pieces need a strong silhouette at roughly 40px on the board. The current road
is a rounded bar scored into four segments and reads as a dropped brick — a
replacement wants visible planks and posts.

### Player portraits — 256×256, transparent

Two standing requirements:

- **Alpha is mandatory.** All eight current portraits ship as opaque RGB with a
  baked white square (ART-005). Any regeneration must fix that.
- **The silhouette must carry the identity.** All eight currently wear the same
  cream jacket with a different scarf, so at HUD size only the ring colour
  distinguishes them (ART-007). Give each seat a distinct hat, hood, headwrap,
  goggles, or hairstyle plus one saturated seat-coloured garment.

Test: render at 32px as a solid black silhouette. If two seats are
indistinguishable, the design has failed.

Style must be matte clay to match the cards — not the soft near-photoreal render
the current set uses (ART-006).

### UI icons — 256×256, transparent

Icons display around 40px. Keep to one clear primary shape with at most two
supporting elements; anything finer becomes noise.

Current icons sit in an orange-and-teal palette that exists nowhere else in the
game (ART-015). New icons should use the UI blue-and-gold family.

### Home menu icons — 1080×1080, transparent

Floating 3/4 isometric islands with a visible ground plane and a soft contact
shadow. All three must share one camera angle — the current set mixes two
(ART-020).

These render at roughly 130px. Resist fine detail.

### Backgrounds — opaque, 16:9

Full painted scenes, no alpha. `coastal-island-kingdom-supercell.png` is the
quality bar for the whole project.

Keep the centre calm in value: UI panels sit on top, and a busy midground makes
overlaid text unreadable.

## Registration

| Category | Constants module |
| --- | --- |
| Cards | `apps/web/src/constants/game/card-assets.ts` |
| Board, ocean, ports, terrain atlas | `apps/web/src/constants/game/board-assets.ts` |
| Portraits | `apps/web/src/constants/game/player-assets.ts` |
| Awards | `apps/web/src/constants/game/award-assets.ts` |
| Misc UI | `apps/web/src/constants/game/ui-assets.ts` |

Then add the asset to `ASSET_CATEGORIES` in
`apps/web/src/app/asset-sheet/page.tsx` with a truthful `format` string.

## Budgets

| Slot | Target |
| --- | --- |
| UI icon (256²) | under 120 KB |
| Portrait (256²) | under 130 KB |
| Piece (512²) | under 250 KB |
| Card (512×768) | under 500 KB |
| Menu icon (1080²) | under 1.2 MB |
| Terrain atlas (full sheet) | under 2.5 MB |

The atlas is currently 8.1 MB, mostly for variants that differ only by a slight
rotation and scale (ART-012). If you recomposite it, either make the variants
genuinely distinct or drop to one per terrain.
