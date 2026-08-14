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
      className="win-overlay"
      role="dialog"
    >
      <div aria-hidden="true" className="win-scene">
        <Image
          alt=""
          className="win-scene-art"
          fill
          priority
          sizes="100vw"
          src={VICTORY_SCENE_PATH}
        />
      </div>
      <div className={`win-card player-${featuredTheme}`}>
        <header className="win-card-header">
          <Image
            alt=""
            aria-hidden="true"
            className="win-flourish"
            draggable={false}
            height={512}
            priority
            sizes="(max-width: 700px) 92vw, 36rem"
            src={VICTORY_FLOURISH_PATH}
            width={1536}
          />
          <div className="win-hero">
            {featuredPlayer ? (
              <span className="win-avatar" aria-hidden="true">
                <Image
                  alt=""
                  draggable={false}
                  height={256}
                  src={featuredPortrait}
                  unoptimized
                  width={256}
                />
              </span>
            ) : null}
            <div className="win-hero-copy">
              <p className="eyebrow">{copy.kicker}</p>
              <h2 className="win-title" id="win-title">
                {copy.title}
              </h2>
              <p className="win-detail" id="win-detail">
                {copy.detail}
              </p>
            </div>
          </div>
        </header>
        <div className="win-card-body">
          <section aria-labelledby="score-breakdown-title" className="win-score-panel">
            <div className="win-score-heading">
              <div>
                <p className="eyebrow">{isDraw ? "Top score" : "Champion score"}</p>
                <h3 id="score-breakdown-title">How the points landed</h3>
              </div>
              <strong className="win-total-score">
                <span>{featuredScore}</span>
                <small>VP</small>
              </strong>
            </div>
            <ul className="win-point-breakdown">
              {pointBreakdown.map((source) => (
                <li
                  className="win-point-source"
                  data-empty={source.points === 0 ? "true" : undefined}
                  key={source.label}
                >
                  <span className="win-point-source-art" aria-hidden="true">
                    <Image
                      alt=""
                      draggable={false}
                      height={source.assetHeight}
                      sizes="3.25rem"
                      src={source.asset}
                      width={source.assetWidth}
                    />
                  </span>
                  <span>
                    <strong>{source.label}</strong>
                    <small>{source.detail}</small>
                  </span>
                  <b>{source.points}</b>
                </li>
              ))}
            </ul>
            {featuredPlayer ? (
              <div aria-label="Match statistics" className="win-match-stats">
                <span>
                  <small>Turns</small>
                  <strong>{game.turnNumber}</strong>
                </span>
                <span>
                  <small>Longest road</small>
                  <strong>{longestRoad}</strong>
                </span>
                <span>
                  <small>Knights played</small>
                  <strong>
                    {
                      featuredPlayer.playedDevelopmentCards.filter((card) => card === "knight")
                        .length
                    }
                  </strong>
                </span>
              </div>
            ) : null}
          </section>

          <section aria-labelledby="final-standings-title" className="win-standings">
            <div className="win-standings-heading">
              <p className="eyebrow">Final standings</p>
              <h3 id="final-standings-title">The table</h3>
            </div>
            <ol>
              {standings.map(({ player, score }, index) => {
                const theme = getPlayerTheme(player);
                const place = index + 1;
                return (
                  <li
                    className={`player-${theme}${player.id === game.winnerPlayerId ? " is-winner" : ""}${player.isViewer ? " is-viewer" : ""}`}
                    key={player.id}
                  >
                    <span className="win-rank" data-place={place}>
                      {place}
                    </span>
                    <Image
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      height={96}
                      src={getResultPortraitPath(player, viewerProfileImageUrl)}
                      unoptimized
                      width={96}
                    />
                    <span className="win-standing-name">
                      <strong>{player.displayName}</strong>
                      <small>
                        {player.id === game.winnerPlayerId
                          ? "Island champion"
                          : player.isViewer
                            ? "You"
                            : player.isBot
                              ? "Bot"
                              : "Explorer"}
                      </small>
                    </span>
                    <strong className="win-standing-score">
                      {score}
                      <small> VP</small>
                    </strong>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
        <div className="win-card-footer">
          <Button
            autoFocus
            className="win-home-button"
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
