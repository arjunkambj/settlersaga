import { BOT_DIFFICULTIES, type BotDifficulty } from "@settersaga/game";

export const BOT_DIFFICULTY_DETAILS: Readonly<
  Record<
    BotDifficulty,
    { readonly artSrc: string; readonly description: string; readonly label: string }
  >
> = {
  easy: {
    artSrc: "/game-assets/bots/bot-easy.png",
    description: "Relaxed bots, great for learning the ropes.",
    label: "Easy",
  },
  medium: {
    artSrc: "/game-assets/bots/bot-medium.png",
    description: "Steady bots that build and trade.",
    label: "Medium",
  },
  hard: {
    artSrc: "/game-assets/bots/bot-hard.png",
    description: "Sharp bots that plan ahead.",
    label: "Hard",
  },
};

export const BOT_DIFFICULTY_OPTIONS = BOT_DIFFICULTIES.map((value) => ({
  ...BOT_DIFFICULTY_DETAILS[value],
  value,
}));
