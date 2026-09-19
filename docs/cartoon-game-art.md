# Cartoon game artwork

Generated with the built-in image generation tool on 2026-09-12. The user requested a blue main theme, clear cartoon resources, smaller terrain landmarks, revised sheep and boats, soft individual hex frames, coordinated menu and game backgrounds, and new branding. Existing assets were replaced directly as requested; no alternate asset versions are retained in the project.

The terrain atlas is 1536×1024: three columns, two rows, 512×512 frames ordered wheat, forest, brick, stone, pasture, desert. Resource card atlas cells were extracted and resized to 512×768. Transparent logo and boat outputs retain alpha; empty padding was trimmed. The wordmark is 1200×311. Image processing only extracted atlas cells, trimmed transparent margins, resized, and encoded formats.

## Prompts and destinations

### Terrain atlas

Saved to: `apps/web/public/game-assets/terrain/terrain-atlas.png`

#### Generation

```text
Use case: stylized-concept
Asset type: readable cartoon terrain atlas for a polished blue-themed mobile strategy board game.
Create exactly 1536x1024 landscape, strict 3 columns by 2 rows of 512x512 square cells, zero gutters and no borders. Six separate square game textures that will be clipped to flat-top hexagons by code.
Style: friendly chunky CARTOON 3D, premium mobile game toy-like rendering, broad smooth shapes, very simple materials, soft bevels, rich bright colors, clean ambient shadows, strong silhouettes. Absolutely no photorealism, tiny details, dense foliage, thin grass strands, noise or grain. Objects should be instantly recognizable when each cell is only 100 pixels wide. Orthographic nearly top-down camera, all cells identical angle and sunlight direction.
Each cell has ONE LARGE simple central-upper resource landmark occupying roughly 60% width and 55% height, on a clean colored ground with minimal gentle land contouring. Leave bottom center quiet for a number token added later. Keep landmarks within central 80% so hexagon clipping won't cut them.
EXACT row-major order:
1 top left WHEAT: one big bundled sheaf of golden wheat with oversized rounded grains and a simple tie, plus a tiny simple crop patch behind; golden ochre ground.
2 top middle WOOD: three large cartoon evergreen trees with rounded tiered pine silhouettes, one small pair of cut logs; deep emerald green ground.
3 top right BRICK: a big neat stack of six unmistakable red-orange rectangular bricks with beveled edges beside one rounded clay mound; warm terracotta ground.
4 bottom left STONE: three large chunky blue-gray boulders with readable facets, one simple mountain peak behind; muted cool slate blue ground.
5 bottom middle SHEEP: two large adorable fluffy white sheep, black faces and small legs, one standing facing three-quarter camera; fresh bright lime green ground.
6 bottom right DESERT: two smooth sandy dunes and one large rounded cactus, golden beige ground.
Ground fills each entire cell edge-to-edge. Keep forest distinctly darker green than sheep pasture. Resource objects big and clear, uncluttered, a cohesive high quality cartoon game asset family. No buildings, no windmills, no text, no numbers, no borders, no hex outlines, no watermarks.
```

#### Refinement 1

```text
Use case: precise-object-edit
Asset type: production six-cell terrain atlas.
Edit this terrain atlas. Preserve exactly the 1536x1024 canvas, strict 3-column 2-row grid of 512px square cells, row-major terrain order (wheat, forest, brick, stone, sheep, desert), cartoon style, terrain ground colors and lighting.
CRITICAL CHANGE: Every resource landmark is MUCH TOO LARGE. Reduce the full landmark cluster in EACH cell to 55 percent of its CURRENT width and height, with its visual center at x=50%, y=38% within its own cell. This means each resource cluster should occupy ONLY approximately 38 percent of each cell's width, and 32-38 percent of height. The wheat bundle must become a small landmark, NOT a gigantic icon; trees a little grove; sheep two little sheep; brick pile modest; rocks a small formation; cactus small.
Fill all newly exposed ground naturally with the same very simple flat-color softly shaded cartoon terrain, no texture noise. At least 65 percent of each cell should be quiet open ground. Keep the entire bottom half mostly empty ground for a number token, and leave generous empty ground at all six future hexagon edges for roads and houses. Do not add decorations to fill the empty space. No drawn tile outlines or borders. No text, no UI, no numbers. Do not enlarge anything. These are tiny terrain landmarks inside a game board, not full-cell resource card icons.
```

#### Refinement 2

```text
Use case: precise-object-edit
Edit ONLY the sheep in the bottom-middle green cell of this exact terrain atlas. Keep the 1536x1024 canvas, 3x2 grid, ALL other five cells completely unchanged, same colors, resource cluster sizes, layout, lighting and cartoon style.
Replace the two front-facing big-eyed mascot sheep with two simple classic FARM SHEEP in SIDE PROFILE. Each sheep has a long horizontal oval cream-wool body (soft 5-7 broad wool scallops), a small charcoal elongated sheep face, small ears, tiny dot eye, four short dark legs. No smile, no giant head, no oversized eyes, no spherical mascot body. One sheep standing facing left, the other grazing facing right. They are SMALL terrain details with naturally sheep-like proportions. Together the two sheep occupy only about 32 percent of that cell's width, positioned in the upper middle around 38 percent cell height. Keep generous open green ground around them and the entire lower half empty for a number token. Cartoon toy art, simple clean smooth shapes. Do not add fences or flowers or any other object. No text, no borders.
```

### Ocean playfield

Saved to: `apps/web/public/game-assets/ui/ocean-board-canvas.webp`

#### Generation

```text
Use case: stylized-concept
Asset type: beautiful full-screen blue ocean playfield background for a premium cartoon island strategy game.
Create a new landscape 1536x1024 image. Image 1 is the MAIN MENU STYLE REFERENCE (sunny rounded island village). Image 2 is the CURRENT GAME BACKGROUND to improve: it is too flat, empty and neon blue. Do not copy its flat electric blue field.
Make the in-game sea feel like the same lovingly crafted world as the menu. Premium smooth 3D cartoon style, warm sunlight, rounded sculpted rocks and plump green trees, no photorealistic noise.
Scene seen from a high orthographic aerial camera: a peaceful gorgeous BLUE bay, smooth layered azure and denim-blue water, darker soft blue in the middle and milky pale-blue shallow water at coasts, soft visible underwater sandbanks, a few broad softly curved foam ripples. Natural muted beautiful blue, NOT electric ultramarine/neon, NOT turquoise-dominant. Water has gentle depth and subtle variety.
Compose decorative coastline along the bottom-left 15 percent: broad warm sand, rounded gray rocks, a small grassy headland with 2 sculpted trees, one tiny simple wooden dock. Another smaller rocky grass outcrop at upper-right edge. A handful of sparse underwater rocks along extreme left edge. These edges feel like a game world, not photo rocks pasted onto a flat color.
Keep the central area from 20% to 78% image width and 12% to 82% height free of islands or objects for the board, but show beautiful soft water depth gradients. No island in the center, no foreground ship or giant prop, no labels, no UI, no horizon. Overall inviting, polished, calm and cheerful, blue-dominant, soft contrast, warm edges, crisp cartoon forms.
```

### Main menu coast

Saved to: `apps/web/public/shared-assets/coastal-island-kingdom-supercell.png`

#### Generation

```text
Use case: stylized-concept
Asset type: main menu background for a premium blue-themed cartoon island board game.
Create 1536x1024 landscape full-bleed art. A cheerful small seaside settlement on a rounded green island above a beautiful saturated BLUE ocean. High-end mobile strategy game CARTOON 3D toy art: chunky exaggerated silhouettes, broad smooth surfaces, simple clean materials, soft bevels, lovely warm sunlight, rich ambient shadows. Not realistic, not painterly, no fine texture or grain. Same family as cartoon resource icons with plump trees, chunky boulders and fluffy sheep.
Composition for a centered menu overlay: keep the middle 55 percent very quiet, mostly open cobalt-blue sea with soft gradients, no focal objects in center. Frame with a charming village at far left: a few small cream houses with large blue roofs, a golden wheat patch, two rounded pine trees, a cute sheep and smooth rocks on grassy cliffs, a short wooden dock with a tiny blue-and-cream sailboat. At far right a smaller distant island with two blue-roof towers and puffy round trees. Bottom corners can have simple grasses and rounded warm rocks, but center remains water. Slight elevated aerial camera, minimal sky at very top if any. Colors: dominant royal blue and azure sea, bright green vegetation, warm cream buildings, small gold accents. Joyful sunny game world, visually simple and immediately legible. NO text, logos, icons, UI, borders or watermarks.
```

### Harbor ship

Saved to: `apps/web/public/game-assets/ui/port-merchant.png`

#### Generation

```text
Use case: stylized-concept
Asset type: single transparent harbor boat sprite for a friendly cartoon strategy board game.
Design one TINY CHUBBY TOY SAILBOAT. Cute compact rounded nutshell-shaped honey wood hull with thick cobalt blue rim, short stubby proportions, almost as wide as it is long. One little plump cream triangular sail on a very short mast, a small blue pennant. Big simple parts, no deck clutter, no barrels, no cabin, no cargo crates, no ropes, no realistic plank textures. Short broad hull, NOT a long skinny ship. Like a lovingly sculpted wooden bath toy. Premium polished mobile game 3D cartoon render, smooth clay-like materials with broad highlights and soft soft shadows, warm upper-left sunlight. Instantly recognizable silhouette at 40px.
Camera: elevated orthographic 65 degree view, bow pointing toward TOP CENTER of image, stern toward bottom, symmetrical hull axis vertical; slight visible front/side thickness for toy volume. Entire object fully visible, centered with 10 percent margins, genuinely transparent background with alpha, NO water, NO ground, NO shadow patch, no text, no numbers, no borders. Object bounding box approximately 100 wide by 120 tall, a compact fat little boat, NOT realistic or intricate.
```

### Resource cards

Saved to: `apps/web/public/game-assets/cards/resources/{tree,brick,sheep,wheat,stone}-card.png; unknown-resource-card-purple.png`

#### Generation

```text
Use case: stylized-concept
Asset type: six resource card sprites on one production atlas for a cartoon strategy game.
Square image 1536x1536. STRICT three columns by two rows grid. Each cell is a portrait rectangle exactly 512 wide x 768 tall. Six cards fill their individual rectangular cells completely edge-to-edge, no gaps. Identical simple rounded cream-and-gold raised border inset 14px from each cell edge. Plain colored softly shaded interior. Every card displays ONE LARGE extremely recognizable chunky 3D CARTOON resource emblem, centered and occupying 70% of card width. Simple rounded toy-like forms, soft broad highlights, saturated colors, crisp silhouette, consistent upper-left sunlight. NO photorealism, grain, noisy ground, tiny decorations, intricate patterns, thin strokes, scenery, letters or numbers.
Exact grid row-major order:
top left WOOD: 3 big rounded brown cut logs with obvious golden circular ends, rich emerald green card.
top middle BRICK: a stack of 5 big bright terracotta rectangular beveled bricks, coral orange card.
top right SHEEP: one adorable large plump fluffy white sheep with dark face and four tiny legs, lime green card.
bottom left WHEAT: one large tied sheaf with oversized golden wheat grains, honey gold card.
bottom middle STONE: a pile of three big faceted blue-gray rocks, slate blue card.
bottom right UNKNOWN RESOURCE CARD BACK: one chunky golden shipping crate emblem with a large embossed question mark, royal blue card. The question mark is a simple icon and the only symbol permitted.
Cohesive polished mobile strategy game art direction, easily readable at 60px tall. Resources should match simple cartoon board terrain. Keep all six cards aligned exactly to the grid, no outside margin, no perspective skew on card frames.
```

#### Refinement 1

```text
Use case: precise-object-edit
Keep this six-card resource atlas entirely unchanged EXCEPT the sheep illustration in the top-right green card. Replace the big-eyed spherical mascot sheep with ONE classic farm sheep shown in side profile facing left: horizontal oval cream wool body with 5 to 7 broad fluffy lobes, small charcoal elongated head, tiny dot eye, short ears, four short charcoal legs. Natural recognizable sheep proportions, NO oversized head or eyes, no smile. Polished simple 3D cartoon toy art with broad smooth highlights matching the other resource illustrations. Sheep centered in the green card and using about 65 percent of its width, all legs visible. Preserve green background and exact gold/cream frame and atlas grid dimensions. All other cards stay unchanged. No new text or decorations.
```

### Wordmark

Saved to: `apps/web/public/game-assets/brand/settersaga-wordmark.png`

#### Generation

```text
Use case: logo-brand
Asset type: premium cartoon strategy game wordmark, transparent PNG.
Design a professional, beautiful, instantly readable game logo with EXACT text "SETTER SAGA". The game brand is SetterSaga (S E T T E R, not SETTLER).
Wide horizontal wordmark, text on ONE LINE, compact confident chunky custom cartoon block lettering, slightly irregular playful letterforms with soft bevels. "SETTER" warm ivory cream, "SAGA" rich golden yellow. Both words have a thick deep royal-blue outline with a modest darker blue extruded lower edge, gorgeous softly lit 3D toy finish. Clear letter spacing and open counters, excellent readable silhouette at 180px wide. No spiky shapes, no chrome, no gritty stone, no excessive gradients or giant shadow.
A tiny tasteful golden crown-like three-roof silhouette can sit over the first S, but lettering is the hero. Mature polished mobile strategy game branding, blue is the primary brand surround and shadow, cream and gold accents. Simple iconic and joyful, matching a sunny cartoon island board game.
Actual transparent background, NOT a scene, NOT a blue rectangle, no backdrop, no checkerboard, no slogan, no subtitle, no watermark, no additional words. Entire logo visible and centered with 10 percent transparent padding. Landscape 1536x1024 with the logo itself about 4:1 width-to-height.
```

### Emblem

Saved to: `apps/web/public/game-assets/brand/settersaga-mark.png; apps/web/src/app/icon.png; apps/web/src/app/apple-icon.png`

#### Generation

```text
Use case: logo-brand
Asset type: square transparent app emblem for SetterSaga, a blue-themed cartoon strategy game.
Create a bold clean polished cartoon 3D game emblem: one thick beveled royal-blue hexagonal badge with a narrow golden rim. Inside, a SINGLE charming cream settlement house with chunky cobalt blue roof and tiny gold flag, sitting on a small bright grassy green hexagonal island. One small rounded tree beside house only. Shapes large and simple, wide silhouette, readable at 48px, no miniature scene, no tiny windows, no scattered props. The royal-blue hex badge should be dominant and form a confident closed silhouette; cream, gold and green are accent colors.
Premium custom mobile strategy game logo quality, smooth sculpted toy materials, warm upper-left light, soft shadows contained inside badge, crisp outline, restrained depth. Centered square composition, full emblem visible, 10 percent transparent padding. Actual transparent background, no text, no letters, no numbers, no checkerboard, no external background.
```
