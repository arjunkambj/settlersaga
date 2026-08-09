# SetterSaga art bible

## The style target

SetterSaga is a **cosy island settlement board game** — a Catan-like played on a
hex archipelago. The art should feel like a beautifully produced physical board
game photographed in a sunlit toy world: tactile, chunky, warm, and inviting.
Never grim, never gritty, never realistic.

The bar is **Supercell-tier casual mobile**. In descending order of relevance:

| Reference | What to take from it |
| --- | --- |
| **Hay Day** (Supercell) | The core target. Warm rural charm, matte clay materials, chunky rounded props, saturated but earthy palette, everything looks touchable |
| **Clash Royale / Clash of Clans** (Supercell) | Silhouette discipline and card framing. Bold shapes readable at thumbnail size; strong ornamented card frames |
| **Royal Match** (Dream Games) | Icon polish and bevel language. Glossy-but-not-shiny UI chunks, confident gold accents |
| **Board Kings / Dice Dreams** | The nearest genre neighbours — board-game-on-a-floating-island staging, tile and piece treatment |
| **Rush Royale, Coin Master** | Card and reward-screen energy, celebratory gold treatment |

What is common to all of them, and what SetterSaga is reaching for:

- **Toy-like, not realistic.** Objects look moulded, sculpted, or moulded from
  clay. A viewer should feel they could pick the object up.
- **Exaggerated, chunky proportions.** Thick walls, oversized roofs, stubby
  bases, generous corner radii. Nothing thin, spindly, or delicate.
- **Warm sunlit lighting.** A single friendly key light, warm rim, soft shadows.
  No moody or dramatic lighting.
- **Saturated but earthy colour.** Rich greens, terracottas, golds and
  turquoises — not neon, not pastel, not desaturated.
- **Readable first, detailed second.** Every asset must survive being shrunk to
  its actual render size.

### The in-repo references

Open these before writing any prompt. Concrete examples beat adjectives.

**Match these — they already hit the target:**

| Asset | Why |
| --- | --- |
| `shared-assets/coastal-island-kingdom-supercell.png` | The single best asset in the project and the quality bar for everything. Note the thick rocky cliffs, grass overhang, warm rim light, and calm centre |
| `home-assets/menu/host-island-v2.png` | Correct chunky 3/4 isometric island staging |
| `game-assets/cards/resources/*.png` | The most internally consistent set; the card frame language to preserve |
| `game-assets/ui/bank.png`, `wait-hourglass.png` | Good bevel and contact-shading discipline for icons |

**Do not match these — they are the known-bad set** (all documented in
`docs/art-style-audit.md`):

| Asset | Problem |
| --- | --- |
| `game-assets/players/*.png` | Soft near-photoreal render in the wrong style entirely, plus no alpha |
| `game-assets/pieces/*.png` | Untextured default-clay-render look; reads as a placeholder |
| `game-assets/terrain/terrain-atlas.png` | Mixed key-light directions across the six props; blue mountains |

### Anti-references

If a generation drifts toward any of these, the prompt has gone wrong:

- **Photoreal / Unreal Engine / octane render** — the failure mode of the
  current portraits
- **Flat vector or cel-shaded 2D** — the target is dimensional, not flat
- **Grimdark fantasy, medieval realism, muted browns** — wrong emotional register
- **Pixel art or low-poly** — wrong medium
- **Generic AI "digital painting"** with soft airbrushed gradients and no clear
  form language

A useful gut check: *would this look at home on the Hay Day store page?* If not,
adjust before shipping it.

## The contract

These five values are what makes a set look like one production rather than a
pile of individually-decent images. Restate them in every prompt.

| Property | Value |
| --- | --- |
| Key light | From the upper left, roughly 135° |
| Rim light | Warm `#FFE9B0`, subtle, from the upper right |
| Contact shadow | Deep navy `#05264C`, soft, offset downward |
| Bevel / edge radius | Generously rounded — about 6% of the shortest side |
| Material | Matte clay or painted resin. No gloss, no specular hotspots |
| Outlines | None. Forms separate by value and rim light, never by a stroke |

A single mismatched key-light direction inside a set is the most visible tell
that assets were generated one at a time. When in doubt, describe the light
before you describe the subject.

## Form language

Supercell's signature is exaggerated proportion and thick, confident forms:

- Chunky, oversized primary shapes with small supporting detail
- Silhouette first — the object must be identifiable as a solid black shape
- Detail density tuned to *render* size, not canvas size. A 1080px icon that
  displays at 130px should carry roughly 130px worth of detail
- Slight top-heaviness and a stable base read as "toy", which is the goal

## Palette

Two families only. Do not invent a third.

**World** — terrain, board, pieces, environment. Saturated but earthy. Separate
adjacent terrains by *hue and value*, not by prop alone: the current set has
hills, fields, and desert all in the same orange family and they blur together
(ART-004).

**UI** — cards, chrome, icons, frames. Anchored on the Congress Blue ramp:

| Token | Hex | Role |
| --- | --- | --- |
| `--congress-800` | `#014A8E` | Canvas |
| `--congress-700` | `#0057A9` | Card surface |
| `--congress-950` | `#05264C` | Deep shadow |
| Coin gold | `#FFC92C` | Accent, frames, highlights |

Source of truth: `apps/web/src/app/styles.css`.

**Player seat colours** — reserved for ownership. Never use these as decorative
colour in an asset that is not seat-specific.

| Seat | Hex | Seat | Hex |
| --- | --- | --- | --- |
| red | `#F04F49` | purple | `#8357D9` |
| blue | `#2F8EE8` | teal | `#0F9696` |
| orange | `#F18C2C` | yellow | `#BD8100` |
| green | `#2FB86A` | pink | `#D74786` |

Source of truth: `apps/web/src/constants/game/player-colors.ts`.

## Backgrounds and transparency

The generator bakes a background no matter what the prompt asks for, so
"transparent background" is wasted tokens. Instead, generate a backdrop that is
*easy to remove*:

> "...centred on a completely flat, uniform pure magenta `#FF00FF` background
> with no gradient, no vignette, and no shadow cast onto the backdrop."

Magenta is the safest default because it appears nowhere in this game's palette,
so the flood-fill in `postprocess.py` cannot mistake artwork for backdrop. Use
flat white only when the subject contains no light tones.

Two things to explicitly suppress, because the model adds them by default and
both defeat background removal:

- **Gradients or vignettes** in the backdrop — the flood-fill tolerance walks
  right across a gradient and eats into the subject.
- **Cast shadows on the backdrop** — these get removed with the background,
  leaving the subject looking cut out. Ask for the contact shadow to be
  *attached to the object*, not pooled on a floor plane.

## Assets that are tinted at runtime

Board pieces (`game-assets/pieces/*.png`) are recoloured per player by
`getTintedPieceCanvas` in `apps/web/src/components/game/board-canvas.tsx`, which
composites with a **multiply** blend.

Multiply only darkens. A mid-beige base multiplied by `#F04F49` gives muddy
brick, not the saturated seat red the HUD shows — which is exactly why the
current pieces look wrong (ART-008).

So piece assets must be generated **near-white, desaturated, and light**, with
all form carried by soft grey shading. Think a white ceramic maquette. The tint
supplies the hue; the asset supplies only the modelling. Prompt for:

> "...moulded in near-white unglazed porcelain, almost no colour saturation,
> form described purely by soft grey shading."

The same reasoning applies to any future asset that gets a runtime tint. Check
whether the slot is tinted before choosing a base colour.

## What to avoid in prompts

| Avoid | Why |
| --- | --- |
| "transparent background" | Ignored; produces an arbitrary baked backdrop |
| "8k", "hyperrealistic", "octane render" | Pushes toward the photoreal look that made the portraits clash (ART-006) |
| "game asset sheet", "sprite sheet" | Produces a grid of thumbnails instead of one asset |
| "cartoon", "cel shaded" | Flattens into 2D vector; the target is dimensional clay |
| Naming the reference games in the prompt itself | The references above are for *your* calibration. In prompt text they produce IP pastiche and unreliable results — translate them into the descriptive vocabulary in this file instead |
| Text, numerals, or labels in the art | Every label in this game is code-rendered over the asset |

## Style phrase that works

A compact opener that reliably lands the right look — adapt rather than
copy blindly:

> "Chunky stylised mobile-game art, matte clay and painted resin materials,
> generously rounded bevelled forms, soft key light from the upper left, subtle
> warm rim light on the upper right, deep navy contact shadow, no outlines, no
> gloss, confident simple silhouette, high readability at small size."
