import { DEFAULT_BASE_GAME_SETTINGS, PLAYER_COUNTS } from "@settersaga/game";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { BrandWordmark } from "@/components/app/brand-logo";
import { SceneBackdrop } from "@/components/app/scene-backdrop";
import { buttonVariants } from "@/components/ui/button";
import { getGuidePages, type GuidePage } from "@/lib/game/guide-pages";
import { SITE_NAME, SITE_SHARE_IMAGE } from "@/lib/site";

const TITLE = `How to Play ${SITE_NAME}: Rules, Building, Trading and Winning`;
const DESCRIPTION = `Learn ${SITE_NAME} in a few minutes. See how to place your first settlements, roll for resources, build roads and cities, trade, use the robber and win.`;

export const metadata: Metadata = {
  alternates: { canonical: "/how-to-play" },
  description: DESCRIPTION,
  openGraph: {
    description: DESCRIPTION,
    // A page's own share text replaces the site's, picture included, so it is named again.
    images: [SITE_SHARE_IMAGE],
    siteName: SITE_NAME,
    title: TITLE,
    type: "article",
    url: "/how-to-play",
  },
  title: { absolute: TITLE },
};

// The rules a new game starts with; a host can change them in the lobby.
const GUIDE_PAGES = getGuidePages(DEFAULT_BASE_GAME_SETTINGS);
const FEWEST_PLAYERS = Math.min(...PLAYER_COUNTS);
const MOST_PLAYERS = Math.max(...PLAYER_COUNTS);

/**
 * The in-game guide as one public page anyone can read without signing in, so search engines
 * and invited friends can learn the rules before they play.
 */
export default function HowToPlayPage() {
  return (
    <main
      className="relative flex min-h-dvh flex-col items-center px-4 py-6 sm:px-6 lg:py-10"
      id="main-content"
    >
      <SceneBackdrop />
      <div className="flex w-full max-w-3xl flex-col gap-5">
        <header className="flex items-center justify-between gap-4">
          <Link href="/">
            <BrandWordmark className="w-36 sm:w-52" priority />
          </Link>
          <Link className={buttonVariants({ size: "game-md", variant: "game-gold" })} href="/">
            Play now
          </Link>
        </header>

        <article className="game-menu-panel flex flex-col gap-8 px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="game-heading text-[1.75rem] lg:text-[2rem]">How to play {SITE_NAME}</h1>
            <p className="m-0 max-w-2xl text-base leading-relaxed font-medium text-pretty text-ui-text-soft lg:text-lg">
              {SITE_NAME} is a free online board game for {FEWEST_PLAYERS} to {MOST_PLAYERS}{" "}
              players. Settle an island, collect resources with every roll of the dice, trade with
              your crew and be the first to {DEFAULT_BASE_GAME_SETTINGS.victoryPoints} victory
              points. Play in your browser with friends, or practice against bots. Here are the
              rules in {GUIDE_PAGES.length} short steps.
            </p>
          </div>

          {GUIDE_PAGES.map((page, index) => (
            <GuideSection eager={index === 0} key={page.topic} page={page} />
          ))}

          <div className="flex flex-col items-center gap-4 border-t border-ui-divider pt-8 text-center">
            <h2 className="game-title m-0 text-xl text-balance sm:text-2xl">Ready to settle in?</h2>
            <p className="m-0 max-w-xl text-base leading-relaxed font-medium text-pretty text-ui-text-soft">
              Host a game and share the code with friends, or start a quick match against bots. The
              host can change the point target, the turn timer and the house rules in the lobby.
            </p>
            <Link className={buttonVariants({ size: "game-lg", variant: "game-gold" })} href="/">
              Play {SITE_NAME}
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}

function GuideSection({ eager, page }: { eager: boolean; page: GuidePage }) {
  const headingId = `guide-${page.topic.toLowerCase()}`;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 border-t border-ui-divider pt-8"
    >
      <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:gap-6">
        <div className="game-guide-art game-art-stage flex h-28 items-center justify-center gap-3 rounded-2xl p-3 sm:h-36 sm:p-2">
          {page.art.map((asset) => (
            <Image
              alt={asset.alt}
              className="h-full min-w-0 flex-1 object-contain"
              height={asset.height}
              key={asset.path}
              loading={eager ? "eager" : "lazy"}
              sizes={page.art.length > 1 ? "8rem" : "16rem"}
              src={asset.path}
              width={asset.width}
            />
          ))}
        </div>
        <div className="grid gap-2 text-center sm:text-left">
          <p className="game-eyebrow">{page.topic}</p>
          <h2 className="game-title m-0 text-xl text-balance sm:text-2xl" id={headingId}>
            {page.title}
          </h2>
          <p className="m-0 text-base leading-relaxed font-medium text-pretty text-ui-text-soft">
            {page.lead}
          </p>
        </div>
      </div>

      <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-3">
        {page.tips.map((tip, index) => (
          <li className="game-guide-tip" key={tip.title}>
            <span aria-hidden="true" className="game-guide-tip-number">
              {index + 1}
            </span>
            <h3 className="game-guide-tip-title">{tip.title}</h3>
            <p className="game-guide-tip-copy">{tip.copy}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
