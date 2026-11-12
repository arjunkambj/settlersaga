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

Saved to: `apps/web/public/shared-assets/coastal-island-kingdom-supercell.png` (replaced on 2026-11-12 by `coastal-island-kingdom.webp`, see the end of this file)

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

### Build bar action icons

Made with `pnpm art` (GPT-Image-2.6) on 2026-11-12. All six were drawn as one sheet so they match: one outline weight, a thin cream rim so they stand off the navy panels, and shapes simple enough to read at 28 px. A first set cut from the action cards scored 7.7 with the critic (the navy outline vanished on navy, and the city and trade icons turned to speckle when small), so it was replaced by this one. Each icon was cut out by its own outline, centered on a square with a 3 percent margin and saved at 512×512.

Saved to: `apps/web/public/game-assets/ui/actions/{road,settlement,city,dev-card,trade,build}.png`

#### Generation (Flare, medium, 1536×1024, transparent, two drafts)

```text
Use case: stylized-concept
Asset type: one sheet of six matching action icons for the build bar of a cartoon island board game. Each icon is shown tiny, 28 to 48 px, on a dark navy panel, so every icon is ONE bold simple silhouette that still reads at 28 px.
Destination: cut into apps/web/public/game-assets/ui/actions/{road,settlement,city,dev-card,trade}.png (512x512 each, transparent).
Canvas: exactly 1536x1024, a strict grid of 3 columns by 2 rows of 512x512 cells. One icon per cell, centered, filling about 78 percent of its cell, with clear empty space between icons. Nothing touches or crosses a cell edge.
Style, identical on all six: flat chunky cartoon sticker icons. Big simple shapes, flat bright colors with one soft highlight and one soft shade per shape. A thick dark navy outline of exactly the same weight on every icon, and outside it a thin even cream-white rim hugging the whole silhouette like a die-cut sticker, so the icon stands out on a dark navy background. No tiny details, no texture, no gradients that band, no sparkles, no glow, no drop shadow, no ground.
Camera: straight on, no perspective, the same soft light from the upper left on all six.
Row 1, left to right:
1 ROAD: one short chunky wooden road plank lying diagonally from bottom left to top right, warm honey brown, with just two plank seams and rounded ends. It is thick and fills its cell.
2 SETTLEMENT: one small house seen from the front: cream walls, a big orange-red gabled roof, one dark arched door. No windows.
3 CITY: one small fortress seen from the front: a square cream keep with three large square battlements on top, a round cream tower on each side with a plain orange cone roof and a small red pennant, and one arched brown wooden gate in the middle. No windows, no roof tile lines, no brick lines.
Row 2, left to right:
4 DEV CARD: one portrait playing card with rounded corners, tilted 10 degrees clockwise, with a bright violet face and, large in its middle, a gold hexagon badge holding a white five-point star.
5 TRADE: two big fat curved arrows chasing each other in a circle, a gold arrow on top pointing right and a sky blue arrow underneath pointing left. The arrows are the whole icon; nothing else in the cell.
6 BUILD: one chunky wooden mallet with a steel-grey head, lying diagonally.
Constraints: fully transparent background with real alpha everywhere outside the icons, no checkerboard, no backdrop, no grid lines, no frames, no text, no numbers, no letters, no watermark.
```

#### Final (Sunburst, high, edit of the chosen draft)

```text
Use case: precise-object-edit
Asset type: final render of a sheet of six matching build-bar icons for a cartoon island board game, each shown at 28 to 48 px on dark navy.
Re-render image 1 at final quality. Keep exactly the same six icons in the same six cells of the 3 by 2 grid, at the same positions, sizes, angles and colors: wooden road plank, small house, small fortress, purple card with a gold star badge, gold and blue swap arrows, wooden mallet. Keep the thick dark navy outline at one identical weight on all six and the thin even cream-white rim outside it. Make every edge crisp and every shape clean and flat, with one soft highlight and one soft shade per shape. Change nothing else: no new details, no windows, no texture, no shadows, no glow.
Constraints: 1536x1024, fully transparent background with real alpha outside the icons, no checkerboard, no backdrop, no grid lines, no text, no numbers.
```

### Main menu coast, redrawn sharp

Made with `pnpm art` on 2026-11-12. The first backdrop was 1536×1024 and painterly, so on a retina laptop it was stretched about 1.9 times and its houses and sheep smeared. This one is flat outlined art at 3840×2160, saved as WebP at quality 92. It replaces `coastal-island-kingdom-supercell.png` behind the home, menu and lobby screens and the results screen.

Saved to: `apps/web/public/shared-assets/coastal-island-kingdom.webp`

#### Draft (Flare, medium, 1536×864, edit of the old backdrop to keep its layout)

```text
Use case: stylized-concept
Asset type: full-screen main menu backdrop for a blue-themed cartoon island board game, shown behind frosted menu panels on screens up to 2880 px wide.
Destination: apps/web/public/shared-assets/coastal-island-kingdom-supercell.png (3840x2160, opaque).
Redraw the scene in image 1 as clean, crisp art. Keep its layout: a calm royal blue bay filling the middle of the picture, a small seaside village on green cliffs at the left, a wooden dock with one small sailboat at the right, rounded rocks and plump trees framing the bottom corners, soft clouds and distant islands along the top.
Style: flat cartoon with bold clean shapes and a thin dark navy outline on every object, the same family as the game's resource cards and board. Solid flat colors with one soft shade per shape. Absolutely no blur, no smear, no painterly mush, no grain, no tiny melted details.
Simplify so it stays sharp: only FOUR houses, each large and chunky with cream walls, a big orange-red roof, one clear dark door and one clear window; only THREE sheep, each a simple fluffy white oval body with a small dark face and four short legs; one short wooden fence of four clear posts; trees as big rounded tiered shapes; rocks as a few big faceted boulders. Every object is drawn large enough that its outline is clean.
Composition and camera: raised three-quarter aerial view. The middle 55 percent of the picture stays quiet open water with a few broad foam ripples and nothing else, because menu panels sit there. Joyful sunny daylight from the upper left.
Constraints: opaque full-bleed picture, no text, no logos, no UI, no borders, no watermark.
```

#### Final (Sunburst, high, 3840×2160, edit of the draft)

```text
Use case: precise-object-edit
Asset type: final full-screen main menu backdrop for a blue-themed cartoon island board game, shown behind frosted menu panels on screens up to 2880 px wide.
Destination: apps/web/public/shared-assets/coastal-island-kingdom-supercell.png (3840x2160, opaque).
Re-render image 1 at final quality and full size. Keep the picture exactly as it is: the same calm royal blue bay in the middle, the same three red-roofed houses, three sheep and fence on the green cliff at the left, the same house, dock and sailboat at the right, the same rocks, trees, beach, clouds and distant islands, in the same places, at the same sizes, in the same colors.
Style: flat cartoon with bold clean shapes and a thin dark navy outline on every object, solid flat colors with one soft shade per shape. Every edge is razor crisp at full size: clean windows, doors, fence posts, sheep faces, sail and dock planks. No blur, no smear, no grain, no painterly texture, no new objects.
Composition and camera: unchanged raised three-quarter aerial view. The middle of the picture stays quiet open water with a few broad foam ripples and nothing else.
Constraints: opaque full-bleed picture, no text, no logos, no UI, no borders, no watermark.
```

#### Fix (Sunburst, high, 3840×2160, edit of the final)

The critic scored the final 8.4: a small island sat right behind the menu title, and one door had white blobs. This edit removes that island and redraws the doors.

```text
Use case: precise-object-edit
Asset type: final full-screen main menu backdrop for a blue-themed cartoon island board game. A menu title sits over the upper left-middle of the picture, so that area must be calm.
Destination: apps/web/public/shared-assets/coastal-island-kingdom.webp (3840x2160, opaque).
Change only two things in image 1.
1. Remove the small rocky island with pine trees that floats on the water in the upper left-middle of the picture, just right of the village, together with the tiny rock beside it. Where it was, continue the calm open royal blue sea, the straight horizon line, the pale distant hills and the sky, so the area looks like the rest of the open water. Leave the small cloud behind it as a simple soft cloud.
2. On the three red-roofed houses on the left cliff, make every door one plain arched brown wooden door with a thin dark navy outline and one small dark round handle. No white marks or blobs on any door.
Keep everything else exactly as it is: the village houses, sheep, fence, cliffs, rocks, beach, trees, the two small islands on the right, the house, dock and sailboat on the right, the clouds, the foam ripples, all colors and all outlines, in the same places and at the same sizes.
Style: flat cartoon with bold clean shapes and a thin dark navy outline on every object, solid flat colors with one soft shade per shape, razor crisp edges. No blur, no grain, no new objects.
Constraints: opaque full-bleed picture, no text, no logos, no UI, no borders, no watermark.
```

### Settlement card, redrawn

Made with `pnpm art` on 2026-11-12. The first settlement card was a flat app-icon house with a black arch that read as a dog kennel beside the detailed city card. This one is a small stone cottage drawn to match the city card, which was passed in as the style reference. Rendered at 1024×1536 and scaled to 512×768.

Saved to: `apps/web/public/game-assets/card-art/actions/settlement.png`

#### Draft (Flare, medium, 1024×1536, edit of the old card with the city card as image 2, two drafts)

```text
Use case: stylized-concept
Asset type: the Settlement action card of a cartoon island board game, shown from 16 px badges up to a 256 px help picture, most often about 56 px in the build bar and results screen.
Destination: apps/web/public/game-assets/card-art/actions/settlement.png (512x768, opaque).
Redraw the house in image 1 so it belongs with image 2. Image 1 is the current settlement card; image 2 is the City card from the same set and is the style reference.
Keep from image 1: the portrait card layout, the same cream card frame with rounded corners and thin dark navy inner line, exactly as in image 2, and the soft sunny meadow and blue sky background inside the frame.
Change only the house: one chunky cozy cottage, centered, about the same size on the card as the castle in image 2, seen from the same raised three-quarter front view. Cream plaster walls, a big orange-red roof made of rows of rounded tiles like the tower roofs in image 2, a short cream chimney, one arched brown wooden plank door with a small round handle, and one small square window with a wooden frame. A thick dark navy outline around the cottage, the same weight as the castle outline in image 2, and the same soft shading. It must read as a small house at 56 px: one clear silhouette, no fence, no garden, no path, no smoke, no flag.
Style: the same polished flat cartoon as image 2, warm sunlight from the upper left.
Constraints: opaque full card, no text, no numbers, no letters, no watermark.
```

#### Final (Sunburst, high, edit of the chosen draft)

```text
Use case: precise-object-edit
Asset type: final render of the Settlement action card of a cartoon island board game, shown from 16 px badges up to a 256 px help picture.
Destination: apps/web/public/game-assets/card-art/actions/settlement.png (512x768, opaque).
Re-render image 1 at final quality. Keep the card exactly as it is: the same cream card frame with rounded corners and thin dark navy inner line, the same soft sunny meadow and blue sky, and the same single round stone cottage in the middle with its orange-red rounded-tile roof, short cream chimney, arched brown plank door with a round handle and one arched window with a wooden frame, at the same size, position and colors. Image 2 is the City card from the same set: match its outline weight, shading and finish.
Make every edge crisp and every shape clean. Change nothing else: no new objects, no fence, no path, no smoke, no flag.
Constraints: opaque full card, no text, no numbers, no letters, no watermark.
```

### Emblem, matched to the wordmark

Made with `pnpm art` on 2026-11-12. The old emblem (muted green hexagon, pyramid-roof house, white outline) was a different logo from the hexagon inside the wordmark. This one is the wordmark's own hexagon, cut out, scaled up and re-rendered crisp, so both are one logo. It replaces the emblem above. The Apple icon is the same emblem on a solid `#1a4a94` square, because iOS fills see-through corners with black. The favicon holds 16, 32 and 48 px sizes.

Saved to: `apps/web/public/game-assets/brand/settersaga-mark.png`, `apps/web/src/app/icon.png` (both 512×512, transparent), `apps/web/src/app/apple-icon.png` (180×180, opaque), `apps/web/public/favicon.ico`

#### Final (Sunburst, high, 1024×1024, transparent, edit of the scaled-up wordmark hexagon)

```text
Use case: logo-brand
Asset type: square app emblem for SetterSaga, a blue-themed cartoon island board game. It is the same emblem that sits at the left of the game's wordmark, shown from 28 px (phone header, favicon) up to 512 px.
Destination: apps/web/public/game-assets/brand/settersaga-mark.png (1024x1024, transparent), also used for the app icon.
Re-render image 1 at final quality. Image 1 is a small, soft upscale; draw exactly the same emblem crisp and clean: one bright lime-green hexagon standing on a point, with a thick dark navy outline and a soft glossy highlight along its upper left edge; in its middle one simple cream-white house seen from the front with a gabled roof, a short chimney on the right, one dark navy arched door and a thick dark navy outline; four small darker-green grass tufts on the hexagon around the house. Same shapes, same positions, same colors.
Style: flat chunky cartoon sticker, big simple shapes, flat bright colors with one soft highlight and one soft shade per shape, razor crisp edges. No new details, no text, no letters.
Composition: the emblem centered, filling about 84 percent of the canvas, straight on.
Constraints: fully transparent background with real alpha outside the hexagon, no checkerboard, no backdrop, no shadow patch, no glow, no watermark.
```

### Empty seat and bot portraits

No new art. The empty-seat chair (`apps/web/public/game-assets/ui/empty-seat.png`) lost its cream sticker rim and the cream patches between its legs by image processing, so it has only a navy outline like the sprites beside it. The bot portraits are busts cut for a round frame, so the quick-match dialog and the lobby now show them in a round well instead of uncropped.

### Main menu coast, tall version for phones

Made with `pnpm art` on 2026-11-12. On a phone held upright the wide backdrop crops to its middle, which is open water, so the village never showed. This tall picture keeps the sky at the top, open water behind the menu and the shore along the bottom. Screens taller than 2:3 get it; everything wider keeps the wide backdrop. The wide backdrop was passed in as the style reference.

Saved to: `apps/web/public/shared-assets/coastal-island-kingdom-tall.webp` (1440×3120, WebP at quality 92)

#### Draft (Flare, medium, 720×1568, edit of the wide backdrop, two drafts)

```text
Use case: stylized-concept
Asset type: tall full-screen main menu backdrop for phones, for a blue-themed cartoon island board game. Frosted menu panels and a title sit over the middle of the screen, so the middle must be calm.
Destination: apps/web/public/shared-assets/coastal-island-kingdom-tall.webp (1440x3120, opaque), shown full-screen on portrait phones.
Recompose the scene in image 1 for a tall portrait canvas. Image 1 is the wide version of this backdrop and is the style reference: use the same flat cartoon look, the same colors, the same houses, sheep, fence, rocks, trees, dock and sailboat.
Layout from top to bottom:
- Top 16 percent: bright blue sky with a few soft white clouds and pale distant hills on a straight horizon. Nothing else.
- From 16 to 74 percent: calm open royal blue sea with a few broad pale foam ripples and nothing else. No islands, no boats, no rocks in this band.
- Bottom 26 percent: the shore seen from a raised three-quarter aerial view. A curved sandy beach with white foam along the water's edge. On green grass at the bottom left, two chunky cream houses with big orange-red tiled roofs, each with one clear door and one clear window, two fluffy white sheep with dark faces and a short wooden fence. At the bottom right, a short wooden dock reaching into the water with one small sailboat with a cream sail tied to it. A few big grey boulders on the sand and plump green trees in the two bottom corners.
Style: flat cartoon with bold clean shapes and a thin dark navy outline on every object, solid flat colors with one soft shade per shape, razor crisp edges, joyful sunny daylight from the upper left. Every object is large and chunky enough that its outline stays clean. No blur, no smear, no grain, no painterly texture.
Constraints: opaque full-bleed picture, no text, no logos, no UI, no borders, no watermark.
```

#### Final (Sunburst, high, 1440×3120, edit of the chosen draft)

```text
Use case: precise-object-edit
Asset type: final tall full-screen main menu backdrop for phones, for a blue-themed cartoon island board game. Menu panels sit over the middle of the screen.
Destination: apps/web/public/shared-assets/coastal-island-kingdom-tall.webp (1440x3120, opaque).
Re-render image 1 at final quality and full size. Keep the picture exactly as it is: the same sky, clouds and distant hills at the top, the same calm open royal blue sea with broad foam ripples through the middle, and at the bottom the same beach, two red-roofed houses, two sheep, fence, boulders, trees, wooden dock and sailboat, in the same places, at the same sizes, in the same colors.
Style: flat cartoon with bold clean shapes and a thin dark navy outline on every object, solid flat colors with one soft shade per shape. Every edge is razor crisp at full size: clean windows, doors, roof tiles, fence posts, sheep faces, sail and dock planks. Each door is one plain arched brown wooden door with one small dark handle. No blur, no smear, no grain, no painterly texture, no new objects.
Constraints: opaque full-bleed picture, no text, no logos, no UI, no borders, no watermark.
```
