import { PLAYER_COUNTS } from "@settersaga/game";

import { SITE_NAME } from "@/lib/site";

const FEWEST_PLAYERS = Math.min(...PLAYER_COUNTS);
const MOST_PLAYERS = Math.max(...PLAYER_COUNTS);

/** What people ask before their first game, answered at the end of the how-to-play page. */
export const COMMON_QUESTIONS: readonly { answer: string; question: string }[] = [
  {
    answer: "Yes. The whole game is free to play in your browser, with nothing to download.",
    question: `Is ${SITE_NAME} free?`,
  },
  {
    answer: `${FEWEST_PLAYERS} to ${MOST_PLAYERS}. The island grows with the table, so a game for ${MOST_PLAYERS} has as much room as a game for ${FEWEST_PLAYERS}.`,
    question: "How many players can join?",
  },
  {
    answer: "Yes. Quick match starts a game against bots, and you choose how hard they play.",
    question: "Can I play on my own?",
  },
  {
    answer:
      "No. Play as a guest right away, or sign in with Google to keep your name and games on every device.",
    question: "Do I need an account?",
  },
  {
    answer:
      "The host sets the point target, the turn timer and the discard limit, and can switch on balanced dice, a friendly robber or hidden bank cards.",
    question: "Can we change the rules?",
  },
  {
    answer:
      "Your seat is saved. Refresh the page or open the same link again and you are back in the game.",
    question: "What if I lose my connection?",
  },
];
