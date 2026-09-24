import { deterministicInteger } from "./random";

export const PLAYER_COLORS = [
  "red",
  "blue",
  "orange",
  "green",
  "purple",
  "teal",
  "yellow",
  "pink",
] as const;

export type PlayerColor = (typeof PLAYER_COLORS)[number];

const SUPERHERO_BOT_NAMES = [
  "Arthur Bot",
  "Barry Bot",
  "Bruce Bot",
  "Carol Bot",
  "Clark Bot",
  "Diana Bot",
  "Jennifer Bot",
  "Kamala Bot",
  "Kara Bot",
  "Matt Bot",
  "Miles Bot",
  "Natasha Bot",
  "Oliver Bot",
  "Peter Bot",
  "Shuri Bot",
  "Steve Bot",
  "Tony Bot",
  "Victor Bot",
  "Wade Bot",
  "Wanda Bot",
] as const;

export function chooseBotName(
  seed: string,
  unavailableNames: readonly string[] = [],
): (typeof SUPERHERO_BOT_NAMES)[number] {
  const unavailable = new Set(unavailableNames.map((name) => name.trim().toLocaleLowerCase()));
  const availableNames = SUPERHERO_BOT_NAMES.filter(
    (name) => !unavailable.has(name.toLocaleLowerCase()),
  );
  if (availableNames.length === 0) {
    throw new Error("No superhero bot names are available");
  }

  const draw = deterministicInteger(seed, 0, availableNames.length);
  return availableNames[draw.value]!;
}
