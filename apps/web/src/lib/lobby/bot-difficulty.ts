import type { BotDifficulty } from "@settersaga/game";

export const BOT_DIFFICULTY_OPTIONS = [
  {
    description: "Builds legal moves quickly without planning far ahead.",
    label: "Easy",
    value: "easy",
  },
  {
    description: "Balances production, expansion, and bank trades.",
    label: "Medium",
    value: "medium",
  },
  {
    description: "Prioritizes stronger placements and longer-term upgrades.",
    label: "Hard",
    value: "hard",
  },
] as const satisfies ReadonlyArray<{
  description: string;
  label: string;
  value: BotDifficulty;
}>;
