import { BOT_DIFFICULTIES, type BotDifficulty } from "@settersaga/game";

export const BOT_DIFFICULTY_DETAILS: Readonly<
  Record<
    BotDifficulty,
    { readonly artSrc: string; readonly description: string; readonly label: string }
  >
> = {
  easy: {
    artSrc: "/game-assets/avatars/bot-easy.png",
    description: "Relaxed bots, good for learning the game.",
    label: "Easy",
  },
  medium: {
    artSrc: "/game-assets/avatars/bot-medium.png",
    description: "Steady bots that build and trade.",
    label: "Medium",
  },
  hard: {
    artSrc: "/game-assets/avatars/bot-hard.png",
    description: "Sharp bots that plan ahead.",
    label: "Hard",
  },
};

export const BOT_DIFFICULTY_OPTIONS = BOT_DIFFICULTIES.map((value) => ({
  ...BOT_DIFFICULTY_DETAILS[value],
  value,
}));
