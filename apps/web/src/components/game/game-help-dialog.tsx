"use client";

import {
  ANY_PORT_TRADE_RATIO,
  BANK_TRADE_RATIO,
  BUILD_COSTS,
  DEVELOPMENT_CARD_COST,
  FRIENDLY_ROBBER_MAX_VICTORY_POINTS,
  LARGEST_ARMY_MINIMUM_KNIGHTS,
  LARGEST_ARMY_VICTORY_POINTS,
  LONGEST_ROAD_MINIMUM_LENGTH,
  LONGEST_ROAD_VICTORY_POINTS,
  RESOURCE_PORT_TRADE_RATIO,
  type BaseGameSettings,
} from "@settersaga/game";
import arrowLeftIcon from "@iconify-icons/solar/alt-arrow-left-bold";
import arrowRightIcon from "@iconify-icons/solar/alt-arrow-right-bold";
import checkIcon from "@iconify-icons/solar/check-circle-bold";
import { Icon } from "@iconify/react/offline";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { AWARD_ASSET_PATHS } from "@/constants/game/award-assets";
import { PORT_BOAT_ASSET_PATH, ROBBER_ASSET_PATH } from "@/constants/game/board-assets";
import {
  ACTION_CARD_ASSET_PATHS,
  DEVELOPMENT_CARD_ASSET_PATHS,
} from "@/constants/game/card-assets";
import { END_TURN_ICON_ASSET_PATH, VICTORY_FLOURISH_ASSET_PATH } from "@/constants/game/ui-assets";
import { formatInventory } from "@/lib/game/resources";
import { HOUSE_RULE_OPTIONS } from "@/lib/lobby/house-rules";

import { GameDialog } from "./game-dialog";

export const GAME_HELP_DIALOG_ID = "game-help-dialog";

type GuideSettings = Pick<
  BaseGameSettings,
  | "balancedDice"
  | "discardLimit"
  | "friendlyRobber"
  | "hideBankCards"
  | "turnTimerSeconds"
  | "victoryPoints"
>;

interface GuideArt {
  alt: string;
  height: number;
  path: string;
  width: number;
}

interface GuideTip {
  copy: string;
  title: string;
}

interface GuidePage {
  art: readonly GuideArt[];
  lead: string;
  topic: string;
  title: string;
  tips: readonly GuideTip[];
}

/** The lobby's badge for a house rule, when the rule is on this game. */
function getRuleArt(
  settings: GuideSettings,
  value: (typeof HOUSE_RULE_OPTIONS)[number]["value"],
): GuideArt[] {
  return HOUSE_RULE_OPTIONS.filter((rule) => rule.value === value && settings[value]).map(
    (rule) => ({ alt: rule.label, height: 512, path: rule.artSrc, width: 512 }),
  );
}

function getGuidePages(settings: GuideSettings): readonly GuidePage[] {
  return [
    {
      art: [
        {
          alt: "Victory celebration over the island",
          height: 512,
          path: VICTORY_FLOURISH_ASSET_PATH,
          width: 1536,
        },
      ],
      lead: `The first player to reach ${settings.victoryPoints} victory points on their turn wins.`,
      title: "First to the target wins",
      tips: [
        {
          copy: "A settlement is 1 point. Upgrade it to a city for 2.",
          title: "Build and upgrade",
        },
        {
          copy: `Longest Road is worth ${LONGEST_ROAD_VICTORY_POINTS} points and Largest Army is worth ${LARGEST_ARMY_VICTORY_POINTS}.`,
          title: "Win the awards",
        },
        {
          copy: "Some development cards are secret victory points. They count as soon as you draw them.",
          title: "Secret points",
        },
      ],
      topic: "Goal",
    },
    {
      art: [
        {
          alt: "Settlement",
          height: 768,
          path: ACTION_CARD_ASSET_PATHS.settlement,
          width: 512,
        },
        { alt: "Road", height: 768, path: ACTION_CARD_ASSET_PATHS.road, width: 512 },
      ],
      lead: "Before anyone rolls, each player places two settlements, each with a road. Placement goes around the table, then back the other way.",
      title: "Place two settlements first",
      tips: [
        {
          copy: "Each settlement gets one road touching it.",
          title: "Settlement, then road",
        },
        {
          copy: "Leave at least two road lengths between any two settlements, yours or anyone else’s.",
          title: "Give settlements space",
        },
        {
          copy: "Your second settlement immediately collects one resource from every tile around it.",
          title: "The second one pays",
        },
      ],
      topic: "Setup",
    },
    {
      art: [
        {
          alt: "End turn scroll",
          height: 256,
          path: END_TURN_ICON_ASSET_PATH,
          width: 256,
        },
        ...getRuleArt(settings, "balancedDice"),
      ],
      lead: "After setup, every turn goes the same way. Trade and build in any order you like.",
      title: "Roll, spend, then pass",
      tips: [
        {
          copy: settings.balancedDice
            ? "Buildings next to the rolled number collect that tile’s resource. Dice are balanced: rolls come from a shuffled deck of all 36 outcomes, so streaks are rare."
            : "Buildings next to the rolled number collect that tile’s resource.",
          title: "Roll",
        },
        {
          copy: "Trade, build, or buy a development card. Do as many of those as you can afford.",
          title: "Take actions",
        },
        {
          copy:
            settings.turnTimerSeconds > 0
              ? `Press End turn when you’re done. You have ${settings.turnTimerSeconds} seconds a turn, then the game ends it for you.`
              : "Press End turn when you’re done. There is no turn clock, so take your time.",
          title: "Pass the turn",
        },
      ],
      topic: "Turn",
    },
    {
      art: [
        { alt: "Road", height: 768, path: ACTION_CARD_ASSET_PATHS.road, width: 512 },
        {
          alt: "Settlement",
          height: 768,
          path: ACTION_CARD_ASSET_PATHS.settlement,
          width: 512,
        },
        { alt: "City", height: 768, path: ACTION_CARD_ASSET_PATHS.city, width: 512 },
      ],
      lead: "Spend the cards in your hand to stretch your roads and grow your settlements into cities.",
      title: "Grow along your roads",
      tips: [
        {
          copy: `${formatInventory(BUILD_COSTS.road)}. The new road must touch your network.`,
          title: "Road",
        },
        {
          copy: `${formatInventory(BUILD_COSTS.settlement)}. Needs an open corner on your road, two road lengths from every other settlement.`,
          title: "Settlement",
        },
        {
          copy: `${formatInventory(BUILD_COSTS.city)}. Replaces one of your settlements and doubles its production.`,
          title: "City",
        },
      ],
      topic: "Build",
    },
    {
      art: [
        {
          alt: "Trade action",
          height: 768,
          path: ACTION_CARD_ASSET_PATHS.trade,
          width: 512,
        },
        {
          alt: "Harbor merchant",
          height: 1182,
          path: PORT_BOAT_ASSET_PATH,
          width: 655,
        },
        ...getRuleArt(settings, "hideBankCards"),
      ],
      lead: "Missing a resource? Trade for it with the crew, the bank or a harbor.",
      title: "Swap for the card you need",
      tips: [
        {
          copy: "On your turn, offer a deal to the crew. Anyone can accept, and you pick who to trade with.",
          title: "Trade with crew",
        },
        {
          copy: settings.hideBankCards
            ? `The bank takes ${BANK_TRADE_RATIO} of one resource for 1 of another. Its stock is hidden this game, so a trade can come up empty.`
            : `The bank always takes ${BANK_TRADE_RATIO} of one resource and gives you 1 of another.`,
          title: `Bank is ${BANK_TRADE_RATIO} for 1`,
        },
        {
          copy: `A settlement on a harbor trades ${ANY_PORT_TRADE_RATIO} of any one resource for 1, or ${RESOURCE_PORT_TRADE_RATIO} of that harbor’s resource for 1.`,
          title: "Harbor deals",
        },
      ],
      topic: "Trade",
    },
    {
      art: [
        {
          alt: "The robber",
          height: 512,
          path: ROBBER_ASSET_PATH,
          width: 512,
        },
        ...getRuleArt(settings, "friendlyRobber"),
      ],
      lead: "A 7 produces nothing. Everyone checks their hand, then the roller moves the robber.",
      title: "A 7 wakes the robber",
      tips: [
        {
          copy: `Anyone holding more than ${settings.discardLimit} cards discards half, rounded down.`,
          title: `Over ${settings.discardLimit}? Discard`,
        },
        {
          copy: "Move the robber onto a new tile. That tile stops producing until it moves again.",
          title: "Block a tile",
        },
        {
          copy: settings.friendlyRobber
            ? `If an opponent has a building there, take one random card from their hand. The friendly robber leaves players with ${FRIENDLY_ROBBER_MAX_VICTORY_POINTS} or fewer points alone.`
            : "If an opponent has a building there, take one random card from their hand.",
          title: "Steal a card",
        },
      ],
      topic: "Robber",
    },
    {
      art: [
        {
          alt: "Knight",
          height: 768,
          path: DEVELOPMENT_CARD_ASSET_PATHS.knight,
          width: 512,
        },
        {
          alt: "Largest Army",
          height: 512,
          path: AWARD_ASSET_PATHS.largestArmy,
          width: 512,
        },
        {
          alt: "Longest Road",
          height: 512,
          path: AWARD_ASSET_PATHS.longestRoad,
          width: 512,
        },
      ],
      lead: "When the board fills up, development cards and the two awards help you pull ahead.",
      title: "Cards and awards",
      tips: [
        {
          copy: `Costs ${formatInventory(DEVELOPMENT_CARD_COST)}. You can play it starting on your next turn.`,
          title: "Development card",
        },
        {
          copy: `A knight moves the robber and steals. ${LARGEST_ARMY_MINIMUM_KNIGHTS} played knights can take Largest Army for ${LARGEST_ARMY_VICTORY_POINTS} points.`,
          title: "Largest Army",
        },
        {
          copy: `A continuous road of ${LONGEST_ROAD_MINIMUM_LENGTH} or more can take Longest Road for ${LONGEST_ROAD_VICTORY_POINTS} points. Someone longer can steal it.`,
          title: "Longest Road",
        },
      ],
      topic: "Bonus",
    },
  ];
}

export function GameHelpDialog({
  onClose,
  settings,
}: {
  onClose(): void;
  settings: GuideSettings;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);
  const guidePages = getGuidePages(settings);
  const page = guidePages[pageIndex];
  const lastPageIndex = guidePages.length - 1;
  const isFirstPage = pageIndex === 0;
  const isLastPage = pageIndex === lastPageIndex;

  const showPage = (index: number) => setPageIndex(Math.min(lastPageIndex, Math.max(0, index)));

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        setPageIndex((current) =>
          Math.min(lastPageIndex, Math.max(0, current + (event.key === "ArrowRight" ? 1 : -1))),
        );
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lastPageIndex]);

  // The selected tab stays in view, and keeps focus when the arrow keys turned the page from it.
  useEffect(() => {
    const tabs = tabsRef.current;
    const selectedTab = tabs?.querySelector<HTMLElement>('[aria-selected="true"]');
    selectedTab?.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (tabs?.contains(document.activeElement)) {
      selectedTab?.focus();
    }
  }, [pageIndex]);

  return (
    <GameDialog
      dialogClassName="sm:max-w-[min(48rem,calc(100%-2rem))]"
      footer={
        <>
          <Button
            aria-label="Previous topic"
            className="justify-self-start"
            disabled={isFirstPage}
            onClick={() => showPage(pageIndex - 1)}
            size="game-lg"
            variant="game-icon"
          >
            <Icon aria-hidden="true" icon={arrowLeftIcon} />
          </Button>
          <p className="m-0 flex items-center gap-1.5" aria-live="polite">
            {guidePages.map((guidePage, index) => (
              <span
                aria-hidden="true"
                className="game-guide-dot max-sm:hidden"
                data-active={index === pageIndex || undefined}
                key={guidePage.topic}
              />
            ))}
            <span aria-hidden="true" className="game-guide-count">
              {pageIndex + 1}/{guidePages.length}
            </span>
            <span className="sr-only">
              {page.topic}, {pageIndex + 1} of {guidePages.length}
            </span>
          </p>
          {isLastPage ? (
            <Button
              className="justify-self-end"
              onClick={onClose}
              size="game-lg"
              variant="game-gold"
            >
              <Icon aria-hidden="true" icon={checkIcon} />
              Got it
            </Button>
          ) : (
            <Button
              aria-label="Next topic"
              className="justify-self-end"
              onClick={() => showPage(pageIndex + 1)}
              size="game-lg"
              variant="game-icon"
            >
              <Icon aria-hidden="true" icon={arrowRightIcon} />
            </Button>
          )}
        </>
      }
      footerClassName="grid w-full grid-cols-[1fr_auto_1fr] items-center justify-normal gap-3"
      id={GAME_HELP_DIALOG_ID}
      kicker={`The whole game in ${guidePages.length} quick pages`}
      onClose={onClose}
      title="How to play"
      toolbar={
        <div aria-label="Guide topics" className="game-guide-tabs" ref={tabsRef} role="tablist">
          {guidePages.map((guidePage, index) => {
            const selected = index === pageIndex;
            return (
              <button
                aria-controls="game-guide-page"
                aria-selected={selected}
                className="game-guide-tab"
                id={`game-guide-tab-${index}`}
                key={guidePage.topic}
                onClick={() => showPage(index)}
                role="tab"
                tabIndex={selected ? 0 : -1}
                type="button"
              >
                {guidePage.topic}
              </button>
            );
          })}
        </div>
      }
    >
      <article
        aria-labelledby={`game-guide-tab-${pageIndex}`}
        className="grid content-start gap-4 sm:min-h-76 sm:gap-5"
        id="game-guide-page"
        key={page.topic}
        role="tabpanel"
      >
        <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] sm:gap-6">
          <div className="game-guide-art game-art-stage flex h-28 items-center justify-center gap-3 rounded-2xl p-3 sm:h-40 sm:p-2">
            {page.art.map((asset) => (
              <Image
                alt={asset.alt}
                className="h-full min-w-0 flex-1 object-contain motion-safe:animate-game-pop"
                draggable={false}
                height={asset.height}
                key={asset.path}
                priority={pageIndex === 0}
                sizes={page.art.length > 1 ? "8rem" : "16rem"}
                src={asset.path}
                width={asset.width}
              />
            ))}
          </div>
          <div className="grid gap-2 text-center sm:text-left">
            <h3 className="game-title m-0 text-xl text-balance sm:text-2xl">{page.title}</h3>
            <p className="m-0 text-base leading-relaxed font-medium text-muted-foreground text-pretty">
              {page.lead}
            </p>
          </div>
        </div>

        <ol className="grid gap-3 sm:grid-cols-3">
          {page.tips.map((tip, index) => (
            <li className="game-guide-tip" key={tip.title}>
              <span aria-hidden="true" className="game-guide-tip-number">
                {index + 1}
              </span>
              <p className="game-guide-tip-title">{tip.title}</p>
              <p className="game-guide-tip-copy">{tip.copy}</p>
            </li>
          ))}
        </ol>
      </article>
    </GameDialog>
  );
}
