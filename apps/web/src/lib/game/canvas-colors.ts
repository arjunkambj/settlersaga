/**
 * Color helpers for canvas drawing. Inputs are the board's hex CSS tokens; the CSS
 * pipeline may shorten a token like #ffffff to #fff, so both forms are accepted.
 */

export function withAlpha(color: string, alpha: number): string {
  return `${toLongHex(color)}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

function toLongHex(color: string): string {
  const value = color.trim();
  return /^#[0-9a-f]{3}$/i.test(value)
    ? `#${value
        .slice(1)
        .split("")
        .map((digit) => digit + digit)
        .join("")}`
    : value;
}

/** Mixes two 6-digit hex colors; `amount` is how far to move from `color` toward `target`. */
export function mixColor(color: string, target: string, amount: number): string {
  const channels = (value: string) =>
    [1, 3, 5].map((start) => Number.parseInt(toLongHex(value).slice(start, start + 2), 16));
  const from = channels(color);
  const to = channels(target);
  return `#${from
    .map((channel, index) =>
      Math.round(channel + (to[index]! - channel) * amount)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
