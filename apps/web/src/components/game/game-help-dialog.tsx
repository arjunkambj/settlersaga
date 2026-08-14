"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { ACTION_CARD_ASSET_PATHS, DEVELOPMENT_CARD_ASSETS } from "@/constants/game/card-assets";
import { AWARD_ASSET_PATHS } from "@/constants/game/award-assets";
import { END_TURN_ICON_ASSET_PATH } from "@/constants/game/ui-assets";
import { cn } from "@/lib/utils";

import { GameDialog } from "./game-dialog";

interface GameHelpDialogProps {
  onClose(): void;
}

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

const GUIDE_PAGES: readonly GuidePage[] = [
  {
    art: [
      {
        alt: "Victory celebration over the island",
        height: 512,
        path: "/game-assets/results/victory-flourish.png",
        width: 1536,
      },
    ],
    lead: "The host sets the target — usually 10. The first player to reach it on their turn wins.",
    title: "First to the target wins",
    tips: [
      {
        copy: "A settlement is 1 point. Upgrade it to a city for 2.",
        title: "Build towns",
      },
      {
        copy: "Longest Road and Largest Army are worth 2 points each.",
        title: "Contest the awards",
      },
      {
        copy: "A few development cards are hidden points. They count as soon as you draw them.",
        title: "Watch for secret points",
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
    lead: "Before anyone rolls, each player plants two camps. Placement goes around the table, then back the other way.",
    title: "Place two camps first",
    tips: [
      {
        copy: "Each camp is one settlement and one road touching it.",
        title: "Settlement, then road",
      },
      {
        copy: "Leave at least two road lengths between any two settlements, yours or anyone else's.",
        title: "Give towns space",
      },
      {
        copy: "Your second settlement immediately collects one resource from every tile around it.",
        title: "The second camp pays",
      },
    ],
    topic: "Setup",
  },
  {
    art: [
      {
        alt: "End turn compass",
        height: 256,
        path: END_TURN_ICON_ASSET_PATH,
        width: 256,
      },
    ],
    lead: "After setup, every turn is the same three beats. You can trade and build in any order.",
    title: "Roll, spend, then pass",
    tips: [
      {
        copy: "Buildings next to the rolled number collect that tile’s resource.",
        title: "1. Roll",
      },
      {
        copy: "Trade, build, or buy a development card. Do as many of those as you can afford.",
        title: "2. Take actions",
      },
      {
        copy: "Tap End Turn when you are done. A 7 produces nothing — it wakes the robber instead.",
        title: "3. Pass the turn",
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
    lead: "Spend the cards in your hand to stretch your road and grow your towns.",
    title: "Grow along your roads",
    tips: [
      {
        copy: "1 wood and 1 brick. The new road must touch your network.",
        title: "Road",
      },
      {
        copy: "Wood, brick, sheep, and wheat. Needs an open crossing two roads away from every town.",
        title: "Settlement",
      },
      {
        copy: "2 wheat and 3 stone. Replaces one of your settlements and doubles its production.",
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
        path: "/game-assets/ui/port-merchant.png",
        width: 655,
      },
    ],
    lead: "If you are short one resource, do not sit on a dead hand. Trade it away.",
    title: "Swap for the card you need",
    tips: [
      {
        copy: "On your turn, offer a deal to the table. Anyone can accept.",
        title: "Trade with players",
      },
      {
        copy: "The bank always takes 4 of one resource and gives you 1 of another.",
        title: "Bank is 4 for 1",
      },
      {
        copy: "A settlement on a harbor unlocks 3:1 any, or 2:1 of that harbor’s resource.",
        title: "Harbors are cheaper",
      },
    ],
    topic: "Trade",
  },
  {
    art: [
      {
        alt: "The robber",
        height: 256,
        path: "/game-assets/pieces/robber-piece.png",
        width: 256,
      },
    ],
    lead: "A 7 produces nothing. Everyone checks their hand, then the roller moves the robber.",
    title: "A 7 wakes the robber",
    tips: [
      {
        copy: "Anyone holding more than 7 cards discards half, rounded down.",
        title: "Discard if you are over 7",
      },
      {
        copy: "Move the robber onto a new tile. That tile stops producing until it moves again.",
        title: "Block a tile",
      },
      {
        copy: "If an opponent has a building there, take one random card from their hand.",
        title: "Steal from a neighbor",
      },
    ],
    topic: "Robber",
  },
  {
    art: [
      {
        alt: "Knight",
        height: 512,
        path: DEVELOPMENT_CARD_ASSETS[0].path,
        width: 512,
      },
      {
        alt: "Largest army",
        height: 512,
        path: AWARD_ASSET_PATHS.largestArmy,
        width: 512,
      },
      {
        alt: "Longest road",
        height: 512,
        path: AWARD_ASSET_PATHS.longestRoad,
        width: 512,
      },
    ],
    lead: "Development cards and awards are the usual path past a stalled board.",
    title: "Buy cards. Contest awards.",
    tips: [
      {
        copy: "Costs 1 sheep, 1 wheat, and 1 stone. Play it on a later turn — not the turn you buy it.",
        title: "Development card",
      },
      {
        copy: "A knight moves the robber and steals. Three played knights can take Largest Army for 2 points.",
        title: "Largest Army",
      },
      {
        copy: "A continuous road of 5 or more can take Longest Road for 2 points. Someone longer can steal it.",
        title: "Longest Road",
      },
    ],
    topic: "Bonus",
  },
] as const;

export function GameHelpDialog({ onClose }: GameHelpDialogProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const page = GUIDE_PAGES[pageIndex];
  const isFirstPage = pageIndex === 0;
  const isLastPage = pageIndex === GUIDE_PAGES.length - 1;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setPageIndex((current) => Math.min(GUIDE_PAGES.length - 1, current + 1));
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPageIndex((current) => Math.max(0, current - 1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <GameDialog
      ariaLabel="How to play"
      dialogClassName="sm:max-w-3xl"
      footer={
        <>
          <div className="flex items-center justify-between gap-2 sm:contents">
            <Button
              className="sm:justify-self-start"
              disabled={isFirstPage}
              onClick={() => setPageIndex((current) => current - 1)}
              variant="ghost"
            >
              Back
            </Button>
            <p className="text-xs font-medium text-muted-foreground tabular-nums sm:text-center">
              {pageIndex + 1} of {GUIDE_PAGES.length}
            </p>
          </div>
          <Button
            className="w-full sm:w-auto sm:justify-self-end"
            onClick={() => {
              if (isLastPage) {
                onClose();
                return;
              }
              setPageIndex((current) => current + 1);
            }}
          >
            {isLastPage ? "Got it" : "Next"}
          </Button>
        </>
      }
      footerClassName="flex w-full flex-col gap-2 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center"
      id="game-help-dialog"
      kicker="Player guide"
      onClose={onClose}
      title="How to play"
      toolbar={
        <nav aria-label="Guide topics" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {GUIDE_PAGES.map((guidePage, index) => {
            const selected = index === pageIndex;
            return (
              <button
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold outline-none",
                  "focus-visible:ring-3 focus-visible:ring-ring/30",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                )}
                key={guidePage.topic}
                onClick={() => setPageIndex(index)}
                type="button"
              >
                {guidePage.topic}
              </button>
            );
          })}
        </nav>
      }
    >
      <article aria-live="polite" className="grid gap-4" key={page.topic}>
        <div className="flex min-h-28 items-center justify-center rounded-2xl bg-muted/40 px-4 py-4">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {page.art.map((asset) => (
              <Image
                alt={asset.alt}
                className="h-20 w-auto max-w-full object-contain sm:h-24"
                draggable={false}
                height={asset.height}
                key={asset.path}
                priority={pageIndex === 0}
                sizes="220px"
                src={asset.path}
                width={asset.width}
              />
            ))}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="space-y-1.5">
            <h3 className="font-heading text-xl font-bold">{page.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{page.lead}</p>
          </div>
          <ol className="space-y-2">
            {page.tips.map((tip, index) => (
              <li className="flex gap-3 rounded-2xl bg-muted/30 px-3 py-2.5" key={tip.title}>
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-semibold">{tip.title}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{tip.copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </article>
    </GameDialog>
  );
}
