import { DEFAULT_BASE_GAME_SETTINGS, PLAYER_COUNTS } from "@settersaga/game";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { SITE_NAME } from "@/lib/site";

import hostIslandArt from "../../../public/home-assets/menu/host-island.png";
import joinCrewArt from "../../../public/home-assets/menu/join-crew.png";
import quickMatchArt from "../../../public/home-assets/menu/quick-match.png";

const FEWEST_PLAYERS = Math.min(...PLAYER_COUNTS);
const MOST_PLAYERS = Math.max(...PLAYER_COUNTS);
const { victoryPoints: POINTS_TO_WIN } = DEFAULT_BASE_GAME_SETTINGS;

const WAYS_TO_PLAY: readonly { art: StaticImageData; copy: string; title: string }[] = [
  {
    art: hostIslandArt,
    copy: `Open a room and share its code. Up to ${MOST_PLAYERS} friends can sit down, and bots fill any empty seat.`,
    title: "Host a game",
  },
  {
    art: quickMatchArt,
    copy: "Start a game against easy, medium or hard bots in a few seconds. Good for learning the ropes.",
    title: "Quick match",
  },
  {
    art: joinCrewArt,
    copy: "Got a code from a friend? Type it in and take your seat at their table.",
    title: "Join a game",
  },
];

const GAME_STEPS: readonly { copy: string; title: string }[] = [
  {
    copy: "Everyone puts two settlements and two roads on the island before the first roll.",
    title: "Claim your spots",
  },
  {
    copy: "Each roll pays out resources to every building that sits next to that number.",
    title: "Roll and collect",
  },
  {
    copy: "Swap cards with your crew, the bank or a harbor, then spend them on roads, settlements and cities.",
    title: "Trade and build",
  },
  {
    copy: `Buildings, the longest road and the largest army all score. The first player to ${POINTS_TO_WIN} points wins.`,
    title: `Reach ${POINTS_TO_WIN} points`,
  },
];

const QUESTIONS: readonly { answer: string; question: string }[] = [
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

const SECTION = "game-menu-panel flex flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8";
const SECTION_TITLE = "game-heading self-center text-2xl lg:text-[1.75rem]";
const COPY = "m-0 text-base leading-relaxed font-medium text-pretty text-ui-text-soft";

/**
 * What a first-time visitor reads under the sign-in card on the home page: the ways to play, how
 * a game goes and the usual questions. It is plain text in the page, so search engines read it too.
 */
export function HomeLanding() {
  return (
    <div className="mt-10 flex w-full max-w-5xl flex-col gap-5">
      <section aria-labelledby="landing-ways" className={SECTION}>
        <h2 className={SECTION_TITLE} id="landing-ways">
          Three ways to play
        </h2>
        <ul className="m-0 grid list-none gap-5 p-0 md:grid-cols-3 md:gap-6">
          {WAYS_TO_PLAY.map((way) => (
            <li
              className="flex items-center gap-4 md:flex-col md:gap-3 md:text-center"
              key={way.title}
            >
              <span className="game-art-stage grid size-20 flex-none place-items-center rounded-2xl md:size-32">
                <Image
                  alt=""
                  className="size-16 object-contain md:size-28"
                  placeholder="blur"
                  sizes="(min-width: 768px) 112px, 64px"
                  src={way.art}
                />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="game-title m-0 text-lg lg:text-xl">{way.title}</h3>
                <p className={COPY}>{way.copy}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="landing-steps" className={SECTION}>
        <h2 className={SECTION_TITLE} id="landing-steps">
          How a game goes
        </h2>
        <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {GAME_STEPS.map((step, index) => (
            <li className="game-guide-tip" key={step.title}>
              <span aria-hidden="true" className="game-guide-tip-number">
                {index + 1}
              </span>
              <h3 className="game-guide-tip-title">{step.title}</h3>
              <p className="game-guide-tip-copy">{step.copy}</p>
            </li>
          ))}
        </ol>
        <Link
          className={buttonVariants({
            className: "self-center",
            size: "game-md",
            variant: "game-secondary",
          })}
          href="/how-to-play"
        >
          Read the full rules
        </Link>
      </section>

      <section aria-labelledby="landing-questions" className={SECTION}>
        <h2 className={SECTION_TITLE} id="landing-questions">
          Good to know
        </h2>
        <dl className="m-0 grid gap-x-8 gap-y-5 md:grid-cols-2">
          {QUESTIONS.map(({ answer, question }) => (
            <div className="flex flex-col gap-1" key={question}>
              <dt className="game-title text-lg">{question}</dt>
              <dd className={COPY}>{answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
