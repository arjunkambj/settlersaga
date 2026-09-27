/** How far a player's name must shrink to fit its plaque; CSS reads it as `data-name-fit`. */
export function nameFit(name: string): "long" | "xlong" | undefined {
  const length = [...name].length;
  if (length >= 19) return "xlong";
  if (length >= 14) return "long";
  return undefined;
}
