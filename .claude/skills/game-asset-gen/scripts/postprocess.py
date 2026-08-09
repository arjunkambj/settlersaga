#!/usr/bin/env python3
"""Post-process a raw generated asset into a shippable SetterSaga game asset.

The asset-gen MCP server returns opaque images at one of five fixed aspect
ratios. Almost every slot in this project wants something else: a transparent
background, a tight crop, an exact pixel size, or a 2:3 card. This script does
that conversion so every asset lands on the same conventions.

Only Pillow is required (no numpy) because that is all the repo's Python has.

Examples
--------
Icon with a transparent background, trimmed and squared to 256x256:

    python postprocess.py raw.png out.png --alpha flood --trim --pad 1:1 --size 256x256

Card cropped from a 3:4 generation down to the 2:3 the card slots use:

    python postprocess.py raw.png out.png --crop-aspect 2:3 --size 512x768

Terrain frame that keeps its full-bleed background (no alpha, no trim):

    python postprocess.py raw.png out.png --crop-aspect 1:1 --size 512x512
"""

from __future__ import annotations

import argparse
import sys
from collections import deque
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("Pillow is required: pip install Pillow")


def parse_size(value: str) -> tuple[int, int]:
    try:
        width, height = value.lower().split("x")
        return int(width), int(height)
    except ValueError:
        raise argparse.ArgumentTypeError(f"--size expects WxH, e.g. 512x768 (got {value!r})")


def parse_aspect(value: str) -> tuple[int, int]:
    try:
        width, height = value.split(":")
        return int(width), int(height)
    except ValueError:
        raise argparse.ArgumentTypeError(f"aspect expects W:H, e.g. 2:3 (got {value!r})")


def remove_background(image: Image.Image, tolerance: int, mode: str) -> Image.Image:
    """Clear the background to transparent.

    'flood' floods inward from the border and only clears pixels connected to
    the edge. That matters because a card's cream frame or a sheep's white wool
    is the same colour as the backdrop -- a naive "delete all white" pass eats
    holes in the artwork. Connectivity is what protects interior highlights.

    'white' is the blunt version: clear every pixel near-white anywhere in the
    image. Use it only for line-art style icons with no light interior regions.
    """
    image = image.convert("RGBA")
    width, height = image.size
    pixels = image.load()

    if mode == "white":
        for y in range(height):
            for x in range(width):
                red, green, blue, _ = pixels[x, y]
                if red >= 255 - tolerance and green >= 255 - tolerance and blue >= 255 - tolerance:
                    pixels[x, y] = (red, green, blue, 0)
        return image

    # Sample the four corners; the dominant corner colour is the backdrop.
    corners = [pixels[0, 0], pixels[width - 1, 0], pixels[0, height - 1], pixels[width - 1, height - 1]]
    counts: dict[tuple[int, int, int], int] = {}
    for red, green, blue, _ in corners:
        counts[(red, green, blue)] = counts.get((red, green, blue), 0) + 1
    backdrop = max(counts, key=lambda key: counts[key])

    def matches(pixel: tuple[int, int, int, int]) -> bool:
        return (
            abs(pixel[0] - backdrop[0]) <= tolerance
            and abs(pixel[1] - backdrop[1]) <= tolerance
            and abs(pixel[2] - backdrop[2]) <= tolerance
        )

    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    for x in range(width):
        for y in (0, height - 1):
            if not visited[y * width + x] and matches(pixels[x, y]):
                visited[y * width + x] = 1
                queue.append((x, y))
    for y in range(height):
        for x in (0, width - 1):
            if not visited[y * width + x] and matches(pixels[x, y]):
                visited[y * width + x] = 1
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        pixel = pixels[x, y]
        pixels[x, y] = (pixel[0], pixel[1], pixel[2], 0)
        for next_x, next_y in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= next_x < width and 0 <= next_y < height:
                index = next_y * width + next_x
                if not visited[index] and matches(pixels[next_x, next_y]):
                    visited[index] = 1
                    queue.append((next_x, next_y))

    return image


def trim_to_content(image: Image.Image) -> Image.Image:
    """Crop to the opaque bounding box so every icon fills its frame equally.

    Without this, generations that happen to place the subject small leave the
    asset visually tinier than its siblings even though the files match in size.
    """
    bbox = image.convert("RGBA").getchannel("A").getbbox()
    return image.crop(bbox) if bbox else image


def pad_to_aspect(image: Image.Image, aspect: tuple[int, int], margin: float) -> Image.Image:
    """Centre the subject on a transparent canvas of the target aspect."""
    width, height = image.size
    target_width, target_height = aspect
    content_width = width / (1 - 2 * margin) if margin else width
    content_height = height / (1 - 2 * margin) if margin else height

    if content_width / content_height > target_width / target_height:
        canvas_width = int(round(content_width))
        canvas_height = int(round(content_width * target_height / target_width))
    else:
        canvas_height = int(round(content_height))
        canvas_width = int(round(content_height * target_width / target_height))

    canvas = Image.new("RGBA", (canvas_width, canvas_height), (0, 0, 0, 0))
    canvas.paste(image, ((canvas_width - width) // 2, (canvas_height - height) // 2))
    return canvas


def crop_to_aspect(image: Image.Image, aspect: tuple[int, int]) -> Image.Image:
    """Centre-crop to the target aspect.

    Needed because the MCP server only offers 1:1, 16:9, 9:16, 4:3 and 3:4 --
    the 2:3 that card slots use has to be cut out of a 3:4 generation.
    """
    width, height = image.size
    target_width, target_height = aspect
    if width / height > target_width / target_height:
        new_width = int(round(height * target_width / target_height))
        left = (width - new_width) // 2
        return image.crop((left, 0, left + new_width, height))
    new_height = int(round(width * target_height / target_width))
    top = (height - new_height) // 2
    return image.crop((0, top, width, top + new_height))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--alpha",
        choices=("none", "flood", "white"),
        default="none",
        help="Background removal strategy (default: none)",
    )
    parser.add_argument("--tolerance", type=int, default=18, help="Colour distance for background match (default: 18)")
    parser.add_argument("--trim", action="store_true", help="Crop to the opaque bounding box")
    parser.add_argument("--pad", type=parse_aspect, help="Pad onto a transparent canvas of this aspect, e.g. 1:1")
    parser.add_argument("--margin", type=float, default=0.04, help="Fraction of breathing room when padding (default: 0.04)")
    parser.add_argument("--crop-aspect", type=parse_aspect, help="Centre-crop to this aspect, e.g. 2:3")
    parser.add_argument("--size", type=parse_size, help="Final pixel size, e.g. 512x768")
    parser.add_argument("--flatten", metavar="HEX", help="Composite onto an opaque colour, e.g. '#014a8e'")
    args = parser.parse_args()

    if not args.input.exists():
        return print(f"error: {args.input} not found", file=sys.stderr) or 1

    image = Image.open(args.input).convert("RGBA")

    if args.alpha != "none":
        image = remove_background(image, args.tolerance, args.alpha)
    if args.trim:
        image = trim_to_content(image)
    if args.crop_aspect:
        image = crop_to_aspect(image, args.crop_aspect)
    if args.pad:
        image = pad_to_aspect(image, args.pad, args.margin)
    if args.size:
        image = image.resize(args.size, Image.LANCZOS)
    if args.flatten:
        hex_value = args.flatten.lstrip("#")
        rgb = tuple(int(hex_value[index : index + 2], 16) for index in (0, 2, 4))
        background = Image.new("RGBA", image.size, (*rgb, 255))
        image = Image.alpha_composite(background, image)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    image.save(args.output, "PNG", optimize=True)

    alpha_min = image.getchannel("A").getextrema()[0]
    kilobytes = args.output.stat().st_size / 1024
    print(
        f"{args.output}  {image.size[0]}x{image.size[1]}  "
        f"{'transparent' if alpha_min < 250 else 'opaque'}  {kilobytes:.1f}KB"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
