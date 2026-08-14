"use client";

import {
  getLongestRoadLength,
  LARGEST_ARMY_VICTORY_POINTS,
  LONGEST_ROAD_VICTORY_POINTS,
  type PlayerGameView,
} from "@settersaga/game";
import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ACTION_CARD_ASSET_PATHS, DEVELOPMENT_CARD_ASSETS } from "@/constants/game/card-assets";
import { AWARD_ASSET_PATHS } from "@/constants/game/award-assets";
import { getPlayerPortraitPath } from "@/constants/game/player-assets";

import { getPlayerTheme } from "./game-board";

const VICTORY_FLOURISH_PATH = "/game-assets/results/victory-flourish.png";
const VICTORY_SCENE_PATH = "/shared-assets/coastal-island-kingdom-supercell.png";
const VICTORY_POINT_CARD_ASSET =
  DEVELOPMENT_CARD_ASSETS.find((card) => card.id === "victory-point")?.path ??
  "/game-assets/cards/development/victory-point.png";

export function WinOverlay({
  game,
  onLeave,
  viewerProfileImageUrl,
}: {
  game: PlayerGameView;
  onLeave(): Promise<void>;
  viewerProfileImageUrl: string | null;
}) {
  const [leaving, setLeaving] = useState(false);
  const standings = [...game.players]
    .map((player) => ({
      player,
      score: getFinalVictoryPointTotal(player),
    }))
    .sort(
      (left, right) => right.score - left.score || left.player.seatIndex - right.player.seatIndex,
    );
  const winner = game.players.find((player) => player.id === game.winnerPlayerId);
  const featuredPlayer = winner ?? standings[0]?.player;
  const isDraw = game.winnerPlayerId === null;
  const isViewerWin = winner?.isViewer === true;
  const featuredTheme = featuredPlayer ? getPlayerTheme(featuredPlayer) : "purple";
  const featuredScore = featuredPlayer ? getFinalVictoryPointTotal(featuredPlayer) : 0;
  const pointBreakdown = featuredPlayer ? getVictoryPointBreakdown(game, featuredPlayer) : [];
  const longestRoad = featuredPlayer ? getLongestRoadLength(game.board, featuredPlayer.id) : 0;
  const featuredPortrait = featuredPlayer
    ? getResultPortraitPath(featuredPlayer, viewerProfileImageUrl)
    : getPlayerPortraitPath("purple");
  const featuredName = featuredPlayer?.displayName ?? "A player";
  const copy = getVictoryCopy({
    featuredName,
    isDraw,
    isViewerWin,
    turns: game.turnNumber,
    victoryTarget: game.settings.victoryPoints,
  });

  const leave = async () => {
    if (leaving) {
      return;
    }
    setLeaving(true);
    try {
      await onLeave();
    } finally {
      setLeaving(false);
    }
  };

  return (
    <section
      aria-describedby="win-detail"
      aria-labelledby="win-title"
      aria-modal="true"
      className="fixed inset-0 z-40 flex h-dvh w-full flex-col items-center overflow-auto p-3 sm:p-4 text-foreground"
      role="dialog"
    >
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 overflow-hidden pointer-events-none after:absolute after:inset-0 after:bg-[radial-gradient(58rem_28rem_at_50%_18%,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_70%)] after:bg-background/70"
      >
        <Image
          alt=""
          className="object-cover"
          fill
          priority
          sizes="100vw"
          src={VICTORY_SCENE_PATH}
        />
      </div>
      <div
        className={`relative z-10 grid w-full max-w-[52rem] my-auto gap-4 rounded-2xl border border-primary/30 bg-card/90 p-4 sm:p-5 shadow-2xl text-card-foreground backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300 player-${featuredTheme}`}
      >
        <header className="relative grid justify-items-center text-center gap-0">
          <Image
            alt=""
            aria-hidden="true"
            className="w-full max-w-[34rem] max-h-[8.5rem] -mb-6 object-contain drop-shadow-xl animate-in fade-in duration-500"
            draggable={false}
            height={512}
            priority
            sizes="(max-width: 700px) 92vw, 36rem"
            src={VICTORY_FLOURISH_PATH}
            width={1536}
          />
          <div className="grid justify-items-center gap-2.5">
            {featuredPlayer ? (
              <span
                aria-hidden="true"
                className="relative grid size-24 sm:size-28 place-items-center rounded-full border-3 border-[var(--player-color,var(--primary))] bg-card shadow-2xl shadow-black/60 ring-6 ring-[var(--player-color,var(--primary))]/20"
              >
                <Image
                  alt=""
                  className="size-full rounded-full object-cover"
                  draggable={false}
                  height={256}
                  src={featuredPortrait}
                  unoptimized
                  width={256}
                />
              </span>
            ) : null}
            <div className="grid min-w-0 justify-items-center gap-1">
              <p className="m-0 text-[0.65rem] font-black tracking-wider uppercase text-foreground/60">
                {copy.kicker}
              </p>
              <h2
                className="m-0 max-w-full text-2xl sm:text-3xl font-extrabold leading-tight text-balance text-foreground"
                id="win-title"
              >
                {copy.title}
              </h2>
              <p className="m-0 max-w-md text-sm text-muted-foreground text-pretty" id="win-detail">
                {copy.detail}
              </p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <section
            aria-labelledby="score-breakdown-title"
            className="grid content-start gap-2.5 rounded-xl border border-white/10 bg-background/40 p-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="m-0 text-[0.6rem] font-black tracking-wider uppercase text-foreground/60">
                  {isDraw ? "Top score" : "Champion score"}
                </p>
                <h3 className="m-0 text-sm font-bold text-foreground" id="score-breakdown-title">
                  How the points landed
                </h3>
              </div>
              <strong className="inline-flex items-baseline gap-1 min-w-14 justify-center px-2.5 py-1 rounded-full border border-primary/40 bg-primary/15 text-primary text-xl font-black tabular-nums leading-none">
                <span>{featuredScore}</span>
                <small className="text-[0.62rem] font-extrabold">VP</small>
              </strong>
            </div>

            <ul className="grid gap-0.5 m-0 p-0 list-none">
              {pointBreakdown.map((source) => (
                <li
                  className={`grid grid-cols-[2.4rem_minmax(0,1fr)_auto] items-center gap-2 py-1.5 border-t border-white/10 first:border-t-0 ${
                    source.points === 0 ? "opacity-50" : ""
                  }`}
                  data-empty={source.points === 0 ? "true" : undefined}
                  key={source.label}
                >
                  <span className="grid size-9 place-items-center" aria-hidden="true">
                    <Image
                      alt=""
                      className="size-9 object-contain"
                      draggable={false}
                      height={source.assetHeight}
                      sizes="3.25rem"
                      src={source.asset}
                      width={source.assetWidth}
                    />
                  </span>
                  <span className="grid min-w-0 gap-0.5">
                    <strong className="text-xs font-bold text-foreground">{source.label}</strong>
                    <small className="text-[0.68rem] text-muted-foreground">{source.detail}</small>
                  </span>
                  <b
                    className={`text-base font-black tabular-nums ${
                      source.points === 0 ? "text-muted-foreground" : "text-primary"
                    }`}
                  >
                    {source.points}
                  </b>
                </li>
              ))}
            </ul>

            {featuredPlayer ? (
              <div aria-label="Match statistics" className="grid grid-cols-3 gap-1.5 pt-1">
                <span className="grid justify-items-center gap-0.5 rounded-lg border border-white/10 bg-card/40 p-2 text-center">
                  <small className="text-[0.62rem] font-bold text-muted-foreground">Turns</small>
                  <strong className="text-base font-extrabold tabular-nums text-foreground">
                    {game.turnNumber}
                  </strong>
                </span>
                <span className="grid justify-items-center gap-0.5 rounded-lg border border-white/10 bg-card/40 p-2 text-center">
                  <small className="text-[0.62rem] font-bold text-muted-foreground">
                    Longest road
                  </small>
                  <strong className="text-base font-extrabold tabular-nums text-foreground">
                    {longestRoad}
                  </strong>
                </span>
                <span className="grid justify-items-center gap-0.5 rounded-lg border border-white/10 bg-card/40 p-2 text-center">
                  <small className="text-[0.62rem] font-bold text-muted-foreground">
                    Knights played
                  </small>
                  <strong className="text-base font-extrabold tabular-nums text-foreground">
                    {
                      featuredPlayer.playedDevelopmentCards.filter((card) => card === "knight")
                        .length
                    }
                  </strong>
                </span>
              </div>
            ) : null}
          </section>

          <section
            aria-labelledby="final-standings-title"
            className="grid content-start gap-2.5 rounded-xl border border-white/10 bg-background/40 p-3.5"
          >
            <div className="flex flex-col gap-0.5">
              <p className="m-0 text-[0.6rem] font-black tracking-wider uppercase text-foreground/60">
                Final standings
              </p>
              <h3 className="m-0 text-sm font-bold text-foreground" id="final-standings-title">
                The table
              </h3>
            </div>
            <ol className="grid gap-1.5 m-0 p-0 list-none">
              {standings.map(({ player, score }, index) => {
                const theme = getPlayerTheme(player);
                const place = index + 1;
                const isWinner = player.id === game.winnerPlayerId;
                return (
                  <li
                    className={`grid grid-cols-[1.5rem_2.25rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg p-2 border border-transparent border-l-4 border-l-[var(--player-color,var(--primary))] player-${theme} ${
                      isWinner
                        ? "bg-primary/15 border-primary/40"
                        : player.isViewer
                          ? "bg-accent/15"
                          : "bg-card/60"
                    }`}
                    key={player.id}
                  >
                    <span
                      className={`grid size-6 place-items-center rounded-full text-xs font-black tabular-nums ${
                        place === 1
                          ? "bg-primary text-primary-foreground"
                          : place === 2
                            ? "bg-foreground/20 text-foreground"
                            : place === 3
                              ? "bg-amber-600/80 text-white"
                              : "bg-foreground/10 text-muted-foreground"
                      }`}
                      data-place={place}
                    >
                      {place}
                    </span>
                    <Image
                      alt=""
                      aria-hidden="true"
                      className="size-9 rounded-full border-2 border-[var(--player-color,var(--primary))] object-cover"
                      draggable={false}
                      height={96}
                      src={getResultPortraitPath(player, viewerProfileImageUrl)}
                      unoptimized
                      width={96}
                    />
                    <span className="grid min-w-0 gap-0.5">
                      <strong className="truncate text-xs font-bold text-foreground">
                        {player.displayName}
                      </strong>
                      <small className="text-[0.65rem] text-muted-foreground">
                        {player.id === game.winnerPlayerId
                          ? "Island champion"
                          : player.isViewer
                            ? "You"
                            : player.isBot
                              ? "Bot"
                              : "Explorer"}
                      </small>
                    </span>
                    <strong className="text-sm font-black tabular-nums text-foreground">
                      {score}
                      <small className="text-[0.62rem] font-bold text-muted-foreground"> VP</small>
                    </strong>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <div className="flex justify-center pt-2">
          <Button
            autoFocus
            className="min-w-[13rem]"
            disabled={leaving}
            onClick={() => void leave()}
            size="lg"
          >
            {leaving ? (
              <>
                <Spinner data-icon="inline-start" />
                Leaving…
              </>
            ) : (
              "Return Home"
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}

function getVictoryCopy({
  featuredName,
  isDraw,
  isViewerWin,
  turns,
  victoryTarget,
}: {
  featuredName: string;
  isDraw: boolean;
  isViewerWin: boolean;
  turns: number;
  victoryTarget: number;
}) {
  if (isDraw) {
    return {
      detail: `No one reached ${victoryTarget} victory points.`,
      kicker: "Match complete",
      title: "The island rests",
    };
  }

  if (isViewerWin) {
    return {
      detail: `You reached ${victoryTarget} points in ${turns} turns.`,
      kicker: "Victory",
      title: "You rule the island",
    };
  }

  return {
    detail: `${featuredName} reached ${victoryTarget} points in ${turns} turns.`,
    kicker: "Match complete",
    title: `${featuredName} takes the island`,
  };
}

interface VictoryPointSource {
  asset: string;
  assetHeight: number;
  assetWidth: number;
  detail: string;
  label: string;
  points: number;
}

function getRevealedVictoryPointCards(player: PlayerGameView["players"][number]): number {
  return player.isViewer
    ? player.developmentCards.filter((card) => card === "victory-point").length
    : (player.revealedVictoryPointCards ?? 0);
}

function getFinalVictoryPointTotal(player: PlayerGameView["players"][number]): number {
  return player.victoryPoints + getRevealedVictoryPointCards(player);
}

function getVictoryPointBreakdown(
  game: PlayerGameView,
  player: PlayerGameView["players"][number],
): VictoryPointSource[] {
  let settlements = 0;
  let cities = 0;
  for (const building of game.board.buildings) {
    if (building.playerId !== player.id) {
      continue;
    }
    if (building.kind === "city") {
      cities += 1;
    } else {
      settlements += 1;
    }
  }

  const victoryPointCards = getRevealedVictoryPointCards(player);
  const largestArmyPoints =
    game.largestArmyPlayerId === player.id ? LARGEST_ARMY_VICTORY_POINTS : 0;
  const longestRoadPoints =
    game.longestRoadPlayerId === player.id ? LONGEST_ROAD_VICTORY_POINTS : 0;

  return [
    {
      asset: ACTION_CARD_ASSET_PATHS.settlement,
      assetHeight: 768,
      assetWidth: 512,
      detail: `${settlements} × 1 point`,
      label: "Settlements",
      points: settlements,
    },
    {
      asset: ACTION_CARD_ASSET_PATHS.city,
      assetHeight: 768,
      assetWidth: 512,
      detail: `${cities} × 2 points`,
      label: "Cities",
      points: cities * 2,
    },
    {
      asset: AWARD_ASSET_PATHS.longestRoad,
      assetHeight: 512,
      assetWidth: 512,
      detail: longestRoadPoints > 0 ? "Award held" : "Not held",
      label: "Longest Road",
      points: longestRoadPoints,
    },
    {
      asset: AWARD_ASSET_PATHS.largestArmy,
      assetHeight: 512,
      assetWidth: 512,
      detail: largestArmyPoints > 0 ? "Award held" : "Not held",
      label: "Largest Army",
      points: largestArmyPoints,
    },
    {
      asset: VICTORY_POINT_CARD_ASSET,
      assetHeight: 768,
      assetWidth: 512,
      detail: `${victoryPointCards} hidden ${victoryPointCards === 1 ? "card" : "cards"}`,
      label: "Victory Cards",
      points: victoryPointCards,
    },
  ];
}

function getResultPortraitPath(
  player: PlayerGameView["players"][number],
  viewerProfileImageUrl: string | null,
): string {
  return player.isViewer && viewerProfileImageUrl
    ? viewerProfileImageUrl
    : getPlayerPortraitPath(getPlayerTheme(player));
}
