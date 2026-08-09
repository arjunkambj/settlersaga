# Prompt recipes

Skeletons for each slot. Adapt them — they are starting points, not templates to
paste unchanged. Every one follows the same four-part order, which is what keeps
a set coherent:

**style contract → subject → framing → background**

Leading with the style contract matters. When the subject comes first the model
anchors on subject conventions (a "knight" pulls toward armour-plate realism)
and treats the style words as an afterthought.

---

## Resource card

Request `3:4`, crop to 2:3.

> Chunky stylised mobile-game card art, matte clay and painted resin materials,
> generously rounded bevelled forms, soft key light from the upper left, subtle
> warm rim light on the upper right, deep navy contact shadow, no outlines, no
> gloss. A neat stack of freshly cut timber logs with visible end grain, resting
> centred on a rich purple card field with a subtle embossed leaf motif, framed
> by a cream outer border and a thin gold inner rule. The stack fills the middle
> sixty percent of the card with clear breathing room above and below. Vertical
> portrait card, no text, no numerals, no labels.

Swap the subject for: stacked clay bricks / a round fluffy sheep / a golden
wheat sheaf / rough grey ore stones.

Keep the frame description identical across the whole set — it is what makes six
separate generations read as one deck.

---

## Development card

Request `3:4`, crop to 2:3.

> Chunky stylised mobile-game card art, matte clay and painted resin, rounded
> bevelled forms, soft key light from the upper left, warm rim light upper
> right, deep navy contact shadow, no outlines. A single gold knight's helm with
> a crimson plume above a small round shield, centred on a rich purple card
> field with a subtle embossed shield motif, framed by a cream outer border and
> a thin gold inner rule. Simple bold silhouette readable at thumbnail size.
> Vertical portrait card, no text, no numerals.

Pick **one** fidelity tier for the whole deck and hold it. The current deck mixes
painted characters with flat embossed graphics (ART-017); a single hero prop per
card, no faces, matches the resource cards best.

Use one emboss motif deck-wide and differentiate cards by the prop, not by
changing the background pattern each time.

---

## Terrain atlas frame

Request `1:1`, full bleed, no alpha.

> Chunky stylised mobile-game terrain tile, matte clay and painted resin, soft
> key light from the upper left, warm rim light upper right, no outlines. A
> single rounded pine tree with layered chunky boughs, sitting on a rich
> mid-green ground of soft matte clay with fine organic texture. The tree sits
> in the upper two-thirds of the square, leaving the lower third clear. The
> ground colour runs completely to all four edges with no border, no frame, no
> vignette and no margin. Viewed from a high three-quarter angle. No text.

Two things this prompt is doing deliberately:

- "upper two-thirds … lower third clear" reserves the zone where the number
  token is drawn (ART-010).
- "runs completely to all four edges" prevents the soft vignette the model adds
  by default, which would show as a dark ring once clipped to a hex.

State the light direction in every terrain prompt. Mixed key light across the
six terrains is the single most visible flaw in the current set (ART-011).

---

## Board piece — near-white for runtime tint

Request `1:1`, transparent.

> Chunky stylised mobile-game board piece, moulded in near-white unglazed
> porcelain with almost no colour saturation, form described purely by soft grey
> shading, generously rounded bevelled edges, matte with no gloss. A small
> cottage with a steep pitched roof, a round door and a squat chimney, viewed
> from a high three-quarter angle, sitting flat on its base. Bold simple
> silhouette readable at forty pixels. Centred on a completely flat uniform pure
> magenta background with no gradient, no vignette and no shadow cast onto the
> backdrop. No text.

The near-white base is load-bearing: `getTintedPieceCanvas` multiplies the seat
colour over this asset, and multiply only darkens. See the runtime-tint section
of `art-bible.md`.

---

## Player portrait

Request `1:1`, transparent.

> Chunky stylised mobile-game character portrait, matte clay and painted resin,
> rounded forms, soft key light from the upper left, warm rim light upper right,
> no outlines, no gloss, no skin pores or individual hair strands. Head and
> shoulders of a cheerful island cartographer wearing a wide-brimmed leather hat
> and a saturated blue coat, friendly expression, exaggerated stylised
> proportions with a large head and small shoulders. Bold distinct silhouette
> readable at thirty-two pixels. Centred on a completely flat uniform pure
> magenta background with no gradient and no vignette. No text.

Vary two things across the eight seats and hold everything else constant:

1. **One distinct silhouette feature** — wide hat, hood, headwrap, goggles on
   the forehead, tall collar, ponytail, cap, bandana.
2. **The saturated seat-coloured garment**, using the hex from
   `player-colors.ts`.

"no skin pores or individual hair strands" is doing real work — without it the
model reverts to the soft near-photoreal look that makes the current portraits
clash with everything else (ART-006).

---

## UI icon

Request `1:1`, transparent.

> Chunky stylised mobile-game UI icon, matte clay and painted resin, generously
> rounded bevelled forms, soft key light from the upper left, warm rim light
> upper right, deep navy contact shadow attached to the object, no outlines, no
> gloss. A single bank building with a domed gold roof and two round columns,
> viewed from a high three-quarter angle. One clear primary shape with minimal
> supporting detail, bold silhouette readable at forty pixels. Centred with even
> margins on a completely flat uniform pure magenta background, no gradient, no
> vignette, no shadow cast onto the backdrop. No text.

"contact shadow attached to the object" rather than pooled on a floor keeps the
shadow after background removal instead of losing it with the backdrop.

---

## Home menu icon

Request `1:1`, transparent.

> Chunky stylised mobile-game menu icon, matte clay and painted resin, rounded
> bevelled forms, soft key light from the upper left, warm rim light upper
> right, no outlines. A small floating island of grass and brown rock carrying a
> cosy cottage with a golden thatched roof and two rounded pine trees, viewed
> from a high three-quarter isometric angle, the rocky underside tapering to a
> point below. Bold silhouette, moderate detail that stays legible at one
> hundred and thirty pixels. Centred on a completely flat uniform pure magenta
> background, no gradient, no vignette. No text.

Hold the camera angle identical across the set — the current three mix a 3/4
isometric island with a flat face-on scroll (ART-020).

---

## Background scene

Request `16:9`, opaque.

> Lush stylised mobile-game key art, painted illustration, warm sunlit
> atmosphere, chunky rounded forms, rich saturated colour. A tropical archipelago
> of grassy islands with thick rocky cliffs and a bright turquoise sea, small
> cottages and a distant castle, soft volumetric clouds and warm sun rays. Wide
> cinematic view from a high angle. The centre of the frame is calm and open in
> value with visual interest pushed toward the edges. No text.

The "calm centre" instruction is not aesthetic — UI panels sit there, and a busy
midground makes overlaid copy unreadable.

---

## Iterating on a weak result

Change one axis at a time; changing several at once makes it impossible to tell
what helped.

| Problem | Adjustment |
| --- | --- |
| Too realistic / detailed | Add "simplified chunky forms, minimal detail, toy-like" |
| Flat and 2D | Add "dimensional, sculpted, strong form shadows, three-quarter angle" |
| Wrong light direction | Move the light clause to the very front of the prompt |
| Backdrop won't flood-fill cleanly | Re-state "completely flat uniform, no gradient, no vignette, no cast shadow" |
| Subject too small in frame | Add "fills the frame, tight composition, minimal margin" |
| Unwanted text or numerals | Add "no text, no numbers, no letters, no signage, no watermark" |
| Gets a grid of thumbnails | Remove any "asset"/"sheet"/"set" wording; say "a single object" |
| Doesn't match its siblings | Describe the siblings' concrete traits rather than restating the abstract style |
