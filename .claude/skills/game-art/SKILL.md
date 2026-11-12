---
name: game-art
description: Game art for SetterSaga through the OpenAI API key and GPT-Image-2.6 Flare or Sunburst. Use to create a game asset (sprite, piece, tile, card, icon, background, logo), edit or refine an existing one, animate one as a GIF, or make an SVG.
allowed-tools: Bash(pnpm art *) Bash(pnpm -s art *)
---

# Game art

`pnpm art` (`scripts/game-art.ts`) calls OpenAI's Image API with `OPENAI_API_KEY` from `apps/web/.env.local`. `pnpm art --help` lists every flag. When the key is empty, ask the user to paste it into that file; the key stays out of chat, commits and logs.

Every asset moves through four stages: **brief**, **draft**, **refine**, **final**. Drafts are cheap and fast on Flare; the final is always rendered on Sunburst, the better model, because the user wants shipped art on it.

## Steps

1. **Brief.** Read `docs/cartoon-game-art.md` for the house style and its prompt layout (use case, asset type, style, composition and camera, constraints). Write the prompt to `.cache/game-art/<asset>.txt` (git ignores `.cache`). Done when the prompt names the destination path under `apps/web/public/`, the size it shows at in game, the camera angle, and whether it needs transparency.
2. **Draft.** `pnpm art generate --prompt-file .cache/game-art/<asset>.txt -o .cache/game-art/<asset>.png` on Flare at `-q low` or `medium`. Add `--n 3` when the design is open. Done when you have opened every draft with Read and checked it against [Check the result](#check-the-result).
3. **Refine.** Fix the best draft with `pnpm art edit -i <draft> -p "<change>" --complexity low`, one change per call, saying "change only X" and listing what stays. Done when a draft passes every check.
4. **Final.** Re-render with `--final` (Sunburst at high quality): `generate` with the refined prompt, or `edit -i <approved draft>` to keep its layout. Score it with a critic subagent; show the user only work scoring 8.5 to 9.5. Done when the user approves it.
5. **Ship.** Write to the destination; pass `--force` only after the user agrees to replace an existing file. Add the prompt and destination to `docs/cartoon-game-art.md`. Done when the asset shows correctly in the running game.

## Pick the settings

- **Model.** `flare` (the default) is the speed model, about six seconds at low quality: drafts, variations, quick edits, small UI bits. `sunburst` is the detail model, with steadier edits: finals, strict atlas grids, readable lettering, long edit chains where untouched parts must stay put. `--final` picks Sunburst at high.
- **Quality** sets render detail: `low` for drafts, `medium` (default) for most work, `high` or `xhigh` for finals with fine texture or small text, `max` rarely, since cost climbs with it.
- **Complexity** sets planning before rendering, separate from quality. The API uses `high` when omitted: good for open designs, dense layouts and atlases. Use `low` for targeted edits so the rest of the image stays intact. Compare one knob at a time with the other fixed.
- **Size.** Defaults to `1024x1024` for generate; edits keep the input PNG's size when it is a valid size, and otherwise the API picks one, so pass `-s` to pin it. Custom sizes are multiples of 16, within 3:1, and 655,360 to 8,294,400 pixels, so the smallest square is about 816. Generate small sprites at 1024 and downscale. Above 2560x1440 is experimental. Atlases follow the existing layout: 1536x1024, three by two cells of 512.
- **Transparency.** `-b transparent` with png or webp, and say "isolated on a fully transparent background, no checkerboard, no shadow patch" in the prompt. A drawn checkerboard is a failed draft.
- **Format.** The `-o` extension picks it. png for sprites and pieces, webp with `--compression` for large backgrounds, jpeg when speed matters and alpha does not.
- **SVG** (`-f svg`, generate only, one image): flat icons and emblems that should scale or recolor in code. The output is static vector paths; the toy 3D house style stays raster.
- **GIF** (`-f gif`, `--frames` 2 to 16, `--frame-ms` 20 to 2000): short loops such as an idle piece, a loading compass, a victory flourish. Describe the start pose, the motion, the return to the start pose, and a still camera. To animate an existing sprite, pass it to `edit -i`.
- **References and regions.** In `edit`, the first `-i` image is the one changed; later ones are references. Name each by number and role in the prompt ("image 2 is the style reference"). `--mask` is a same-size PNG with alpha and is followed loosely. `--markup` is a transparent PNG overlay with circles or arrows; ask the prompt to remove the marks.

## Check the result

- The asset reads at its in-game size, with one clear silhouette.
- It matches the house style, camera angle and sunlight of the assets beside it.
- Every requested word is spelled right; no stray text, logos or watermarks appear.
- An edit changed only what was asked.
- Transparent assets have real alpha around the subject. Read shows the hidden color of see-through pixels as a dark glow, so judge cutouts over a solid color or in the game.

## Cost and failures

Every call prints its tokens and an estimated price; image output costs \$30 per million tokens, and Sunburst at high uses far more than Flare at low. Calls can take up to two minutes. The script retries rate limits and server errors on its own. On `moderation_blocked`, rephrase the prompt before trying again. Out of credit, a rejected key, or a 403 about organization verification are for the user to fix at platform.openai.com.

GPT-Image-2.6 works only through the Image API (`/v1/images/generations` and `/v1/images/edits`), which is what the script uses. Model guide: https://developers.openai.com/api/docs/guides/image-generation
