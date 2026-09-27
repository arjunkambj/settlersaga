/**
 * Board pieces are painted artwork whose player-colored parts (roofs, walls,
 * road planks) use one key magenta. Each player's copy swaps that magenta for
 * their seat color while keeping the artwork's light and shade, so doors,
 * windows and stone stay their natural colors.
 */

/** The key hue the artwork paints player-colored parts in. */
const KEY_HUE = 300;
/** Pixels within this many degrees of the key hue are fully recolored... */
const KEY_HUE_CORE = 28;
/** ...and fade back to their own color by this distance. */
const KEY_HUE_EDGE = 42;
const KEY_MIN_SATURATION = 0.18;

const playerArt = new Map<string, HTMLCanvasElement>();
/** The artwork recolored for one seat color, cached per image and color. */
export function getPlayerPieceArt(
  image: HTMLImageElement,
  path: string,
  color: string,
): HTMLCanvasElement {
  const cacheKey = `${path}:${color}`;
  const cached = playerArt.get(cacheKey);
  if (cached) {
    return cached;
  }

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return canvas;
  }

  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  recolorKeyPixels(pixels.data, hexToRgb(color));
  context.putImageData(pixels, 0, 0);
  playerArt.set(cacheKey, canvas);
  return canvas;
}

function recolorKeyPixels(data: Uint8ClampedArray, target: readonly [number, number, number]) {
  const [targetHue, targetSaturation, targetLightness] = rgbToHsl(...target);
  const keyLightness = getKeyLightness(data);

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) {
      continue;
    }

    const [hue, saturation, lightness] = rgbToHsl(data[index]!, data[index + 1]!, data[index + 2]!);
    const weight = getKeyWeight(hue, saturation);
    if (weight === 0) {
      continue;
    }

    // Shift lightness by the pixel's offset from the key's mid-tone, so the
    // painted light and shade carry over onto the seat color.
    const [red, green, blue] = hslToRgb(
      targetHue,
      clamp(targetSaturation * Math.min(1.15, saturation / 0.7)),
      clamp(targetLightness + (lightness - keyLightness)),
    );
    data[index] = Math.round(data[index]! + (red - data[index]!) * weight);
    data[index + 1] = Math.round(data[index + 1]! + (green - data[index + 1]!) * weight);
    data[index + 2] = Math.round(data[index + 2]! + (blue - data[index + 2]!) * weight);
  }
}

/** How strongly a pixel belongs to the key color, from 0 to 1. */
function getKeyWeight(hue: number, saturation: number): number {
  const distance = Math.abs(((hue - KEY_HUE + 540) % 360) - 180);
  const hueWeight =
    distance <= KEY_HUE_CORE
      ? 1
      : distance >= KEY_HUE_EDGE
        ? 0
        : 1 - (distance - KEY_HUE_CORE) / (KEY_HUE_EDGE - KEY_HUE_CORE);
  const saturationWeight = clamp((saturation - KEY_MIN_SATURATION) / 0.12);
  return hueWeight * saturationWeight;
}

/** The median lightness of the fully keyed pixels: the artwork's mid-tone. */
function getKeyLightness(data: Uint8ClampedArray): number {
  const samples: number[] = [];
  for (let index = 0; index < data.length; index += 16) {
    if (data[index + 3]! < 250) {
      continue;
    }
    const [hue, saturation, lightness] = rgbToHsl(data[index]!, data[index + 1]!, data[index + 2]!);
    if (getKeyWeight(hue, saturation) === 1) {
      samples.push(lightness);
    }
  }
  if (samples.length === 0) {
    return 0.5;
  }
  samples.sort((first, second) => first - second);
  return samples[Math.floor(samples.length / 2)]!;
}

function hexToRgb(color: string): [number, number, number] {
  return [1, 3, 5].map((start) => Number.parseInt(color.slice(start, start + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function rgbToHsl(red: number, green: number, blue: number): [number, number, number] {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) {
    return [0, 0, lightness];
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const hue =
    max === r
      ? ((g - b) / delta + (g < b ? 6 : 0)) * 60
      : max === g
        ? ((b - r) / delta + 2) * 60
        : ((r - g) / delta + 4) * 60;
  return [hue, saturation, lightness];
}

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue / 60;
  const second = chroma * (1 - Math.abs((segment % 2) - 1));
  const [r, g, b] =
    segment < 1
      ? [chroma, second, 0]
      : segment < 2
        ? [second, chroma, 0]
        : segment < 3
          ? [0, chroma, second]
          : segment < 4
            ? [0, second, chroma]
            : segment < 5
              ? [second, 0, chroma]
              : [chroma, 0, second];
  const offset = lightness - chroma / 2;
  return [(r + offset) * 255, (g + offset) * 255, (b + offset) * 255];
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
