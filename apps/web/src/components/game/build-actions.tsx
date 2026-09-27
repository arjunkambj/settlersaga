import {
  BUILD_COSTS,
  DEVELOPMENT_CARD_COST,
  type PlayerGameView,
  type PrivatePlayerState,
  type ResourceInventory,
} from "@settersaga/game";
import checkIcon from "@iconify-icons/solar/check-circle-bold";
import { Icon } from "@iconify/react/offline";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import {
  ACTION_CARD_ASSET_PATHS,
  DEVELOPMENT_CARD_BACK_ASSET_PATH,
} from "@/constants/game/card-assets";
import type { BoardBuildMode } from "@/lib/game/board-canvas-model";
import type { SendCommand } from "@/lib/game/command-errors";
import {
  BUILD_PIECE_RULES,
  getBuildTileStatus,
  getDevelopmentCardTileStatus,
  type ActionTileStatus,
  type BuildPieceRule,
} from "@/lib/game/dock-actions";
import { formatInventory } from "@/lib/game/resources";

import { ActionTile, TileArt, type ActionTileState } from "./action-tile";
import { CostCards, ResourceIcons } from "./dock-resource";
import { TradeCenter } from "./trade-center";
import { useMediaQuery } from "./use-media-query";

const BUILD_PIECES_ID = "game-build-pieces";
/** From md up the tiles are one row in the dock (styles/game-layout.css). */
const DOCK_ROW_QUERY = "(min-width: 48rem)";
const CALLOUT_DURATION_MS = 2_400;
/** What a building tile says while its build mode is on. */
const PLACING_LABEL = "Pick a spot";
/** How a tile's label says the game is paused. */
const PAUSED_WORDS = "Game paused";

/**
 * The three building cards, small, as the phone Build tile's art. A piece the player can build
 * now is lit and the others fade back, so what is within reach reads without opening the tray.
 */
function PieceMarks({ marks }: { marks: readonly { ready: boolean; rule: BuildPieceRule }[] }) {
  return (
    <span className="game-build-marks">
      {marks.map(({ ready, rule }) => (
        <span className="game-build-mark" data-ready={ready || undefined} key={rule.piece}>
          <Image
            alt=""
            className="game-build-mark-art"
            draggable={false}
            height={768}
            loading="eager"
            sizes="1.5rem"
            src={ACTION_CARD_ASSET_PATHS[rule.piece]}
            width={512}
          />
        </span>
      ))}
    </span>
  );
}

/** "There's no open path…" after a colon: "Road: there's no open path…". */
function lowerFirst(text: string): string {
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

/**
 * A building or dev card tile's look and words. A panel-wide lock (roll first, not your turn) or
 * a pause puts nothing on the tile: the whole row dims, and the turn card says what to do.
 * Otherwise the tile's own status decides: ready, short of cards (it says which) or locked with
 * its one short line. `lockReason` is what a press explains; `words` is the state in words for
 * the label and the tooltip, after the tile's name and a colon.
 */
function getTileView(
  panelLock: string | undefined,
  paused: boolean,
  status: ActionTileStatus,
  readyWords: string,
): { lockReason: string | null; state: ActionTileState; words: string } {
  const own = status.kind === "ready" ? readyWords : status.reason;
  const say = (...sentences: string[]) => lowerFirst(sentences.join(". "));
  if (panelLock) {
    return {
      lockReason: panelLock,
      state: { kind: "quiet" },
      words: status.kind === "ready" ? say(panelLock) : say(panelLock, own),
    };
  }
  if (paused) {
    return { lockReason: null, state: { kind: "quiet" }, words: say(PAUSED_WORDS, own) };
  }
  switch (status.kind) {
    case "ready":
      return { lockReason: null, state: { kind: "ready" }, words: say(own) };
    case "short":
      return {
        lockReason: status.reason,
        state: { kind: "short", missing: status.missing },
        words: say(own),
      };
    case "blocked":
      return {
        lockReason: status.reason,
        state: { kind: "locked", note: status.note },
        words: say(own),
      };
  }
}

/** The opening round, in the order it is played: a settlement, its road, then both again. */
const SETUP_STEPS = [
  { id: "settlement-1", label: "Settlement", piece: "settlement" },
  { id: "road-1", label: "Road", piece: "road" },
  { id: "settlement-2", label: "Settlement", piece: "settlement" },
  { id: "road-2", label: "Road", piece: "road" },
] as const;

/**
 * The viewer's opening round as four numbered steps in one row: the ones placed carry a check,
 * the one to place now a sky rim (only on the viewer's turn), the rest wait quietly.
 */
function SetupSteps({ game }: { game: PlayerGameView }) {
  const viewerId = game.viewerPlayerId;
  const placed =
    game.board.buildings.filter((building) => building.playerId === viewerId).length +
    game.board.roads.filter((road) => road.playerId === viewerId).length;
  const isViewerTurn = game.activePlayerId === viewerId && game.legalActions.isRequiredActor;
  return (
    <div className="game-build-setup">
      <p className="game-build-setup-lead">
        <strong>Opening round</strong>
        <span>Everyone places two settlements, each with a road.</span>
      </p>
      <ol aria-label="Your opening pieces" className="game-setup-steps">
        {SETUP_STEPS.map((step, index) => {
          const state = index < placed ? "done" : index === placed && isViewerTurn ? "now" : "next";
          return (
            <li
              aria-current={state === "now" ? "step" : undefined}
              className="game-setup-step"
              data-step={state}
              key={step.id}
            >
              <span aria-hidden="true" className="game-setup-step-number">
                {state === "done" ? <Icon icon={checkIcon} /> : index + 1}
              </span>
              <Image
                alt=""
                className="game-setup-step-art"
                draggable={false}
                height={768}
                sizes="1.75rem"
                src={ACTION_CARD_ASSET_PATHS[step.piece]}
                width={512}
              />
              <span className="game-setup-step-label">{step.label}</span>
              <span className="sr-only">
                {state === "done" ? ", placed" : state === "now" ? ", place it now" : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function isSetupPhase(game: PlayerGameView): boolean {
  return game.phase.kind === "setup_settlement" || game.phase.kind === "setup_road";
}

/**
 * Trade, development card and building tiles, all built the same way. From md up each tile reads
 * as three short lines: the card's art and its name, its price as resource icons with their counts
 * ("×2"), then its state: "✓ Ready" when it can be used now (the tile is lit), "Need" with only
 * the missing cards when the player can't pay yet, or a lock and one short line when the board or
 * the supply stops it ("No spot", "None left", "Deck empty"). When something stops the whole
 * panel (not your turn, roll first, discard first, paused) the tiles carry nothing of their own:
 * the row dims evenly, and the turn card says what to do. Phones keep the older tile: the price as
 * mini cards, lit where the player holds them and ghosted where missing, with a check or a lock on
 * the art. Every tile's label and tooltip say its state in words. Locked tiles stay pressable:
 * pressing one says why in a callout above the panel.
 * From md up the five tiles share one row in the order Road, Settlement, City, Dev card, Trade
 * (styles/game-dock.css); phones show Trade, Dev card and a Build tile that opens the three
 * building tiles as a tray, which closes on any tap outside it or when the action moves on. The
 * tiles are rendered in the order they are seen at each size, so the tab order follows the row.
 * During the opening placements the panel shows the viewer's four opening steps in one row
 * instead.
 */
export function BuildActions({
  buildMode,
  game,
  isPaused,
  lockReason,
  me,
  onBuildMode,
  onCommand,
  onPausedAction,
  pending,
}: {
  buildMode: BoardBuildMode;
  game: PlayerGameView;
  isPaused: boolean;
  /** Locks every tile at once (not the viewer's turn, roll first…). */
  lockReason: string | undefined;
  me: PrivatePlayerState;
  onBuildMode(mode: BoardBuildMode): void;
  onCommand: SendCommand;
  onPausedAction(): void;
  pending: boolean;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const dockRow = useMediaQuery(DOCK_ROW_QUERY);
  const [trayActionNumber, setTrayActionNumber] = useState<number | null>(null);
  const [callout, setCallout] = useState<{ id: number; reason: string } | null>(null);
  const piecesOpen = trayActionNumber === game.actionNumber;
  const closeTray = () => setTrayActionNumber(null);
  const explain = (reason: string) =>
    setCallout((current) => ({ id: (current?.id ?? 0) + 1, reason }));

  useEffect(() => {
    if (!callout) {
      return;
    }
    const timeoutId = window.setTimeout(() => setCallout(null), CALLOUT_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [callout]);

  useEffect(() => {
    if (!piecesOpen) {
      return;
    }
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) {
        setTrayActionNumber(null);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [piecesOpen]);

  const setup = isSetupPhase(game);
  // Something stops every tile at once: the whole row dims.
  const rowLocked = !setup && (lockReason !== undefined || isPaused);
  // The price: resource icons in the dock row, mini cards (ghosted where missing) on phones.
  const price = (cost: Readonly<ResourceInventory>) =>
    dockRow ? <ResourceIcons cards={cost} /> : <CostCards cost={cost} have={me.resources} />;
  const developmentCard = getTileView(
    lockReason,
    isPaused,
    getDevelopmentCardTileStatus(game, me),
    "Ready to buy",
  );
  const pieceViews = BUILD_PIECE_RULES.map((rule) => ({
    rule,
    view: getTileView(lockReason, isPaused, getBuildTileStatus(rule, game, me), "Ready to build"),
  }));
  const readyRules = pieceViews
    .filter(({ view }) => view.state.kind === "ready")
    .map(({ rule }) => rule);
  const trayNote = piecesOpen && callout ? callout.reason : lockReason;

  const tradeTile = (
    <TradeCenter
      game={game}
      isPaused={isPaused}
      key="trade"
      lockReason={lockReason}
      me={me}
      onCommand={onCommand}
      onLockedPress={explain}
      onPausedAction={onPausedAction}
      pending={pending}
    />
  );
  const developmentCardTile = (
    <ActionTile
      ariaLabel={`Dev card: ${developmentCard.words}. Costs ${formatInventory(
        DEVELOPMENT_CARD_COST,
      )}. ${game.developmentCardSupply} left in the deck`}
      art={<TileArt src={DEVELOPMENT_CARD_BACK_ASSET_PATH} />}
      cost={price(DEVELOPMENT_CARD_COST)}
      key="development-card"
      kind="development-card"
      lockReason={developmentCard.lockReason}
      onClick={() => {
        if (developmentCard.lockReason) {
          explain(developmentCard.lockReason);
        } else if (!pending) {
          void onCommand({ kind: "buy_development_card" }, "Development card bought.");
        }
      }}
      state={developmentCard.state}
      title="Dev card"
      tooltip={`Dev card: ${developmentCard.words}. ${game.developmentCardSupply} left in the deck`}
    />
  );
  // Phones only: the Build tile that opens the building tray.
  const buildMenuTile = (
    <div className="game-build-menu-toggle" key="build-menu">
      <ActionTile
        activeLabel={PLACING_LABEL}
        ariaControls={BUILD_PIECES_ID}
        ariaExpanded={piecesOpen}
        ariaLabel={`Build a road, settlement or city${
          readyRules.length > 0
            ? `. Ready to build: ${readyRules.map((rule) => rule.label.toLowerCase()).join(", ")}`
            : lockReason
              ? `. ${lockReason}`
              : ""
        }`}
        art={
          <PieceMarks
            marks={pieceViews.map(({ rule, view }) => ({
              ready: view.state.kind === "ready",
              rule,
            }))}
          />
        }
        kind="build-menu"
        onClick={() => setTrayActionNumber(piecesOpen ? null : game.actionNumber)}
        pressed={buildMode !== null}
        state={{ kind: readyRules.length > 0 ? "ready" : "quiet" }}
        title="Build"
      />
    </div>
  );
  // Road, Settlement and City: a tray over the phone action bar, tiles in the row from md up.
  const buildingTiles = (
    <div
      className="game-build-pieces"
      data-open={piecesOpen || undefined}
      id={BUILD_PIECES_ID}
      key="pieces"
    >
      {trayNote ? (
        <p aria-hidden="true" className="game-build-tray-note">
          {trayNote}
        </p>
      ) : null}
      {pieceViews.map(({ rule, view }) => {
        const active = buildMode === rule.piece;
        const cost = BUILD_COSTS[rule.piece];
        const left = me.piecesRemaining[rule.remaining];
        const words = active ? "pick a spot on the board, or press again to cancel" : view.words;
        return (
          <ActionTile
            activeLabel={PLACING_LABEL}
            ariaLabel={`${rule.label}: ${words}. Costs ${formatInventory(cost)}. ${left} left`}
            art={<TileArt src={ACTION_CARD_ASSET_PATHS[rule.piece]} />}
            cost={price(cost)}
            key={rule.piece}
            kind={rule.piece}
            lockReason={view.lockReason}
            onClick={() => {
              if (view.lockReason) {
                explain(view.lockReason);
                return;
              }
              closeTray();
              onBuildMode(active ? null : rule.piece);
            }}
            pressed={active}
            state={view.state}
            title={rule.label}
            tooltip={`${rule.label}: ${words}. ${left} left`}
          />
        );
      })}
    </div>
  );

  return (
    <section
      aria-labelledby="building-actions-title"
      className="game-build-panel"
      data-locked={rowLocked || undefined}
      data-setup={setup || undefined}
      onKeyDown={(event) => {
        if (piecesOpen && event.key === "Escape") {
          closeTray();
        }
      }}
      ref={panelRef}
    >
      <h2 className="sr-only" id="building-actions-title">
        Build and trade
      </h2>
      {/* The opening placements: the four steps in place of tiles that don't apply yet. The tiles
          stay laid out (hidden) under them, so the dock keeps its size. */}
      {setup ? <SetupSteps game={game} /> : null}
      {/* In the order the tiles are seen: from md up Road, Settlement, City, Dev card, Trade (the
          Build tile is hidden there); on phones Trade, Dev card, then the Build tile and the tray
          it opens. The keys keep each tile (and the trade composer's state) across the switch. */}
      <div aria-hidden={setup || undefined} className="game-build-actions" inert={setup}>
        {dockRow
          ? [buildingTiles, developmentCardTile, tradeTile, buildMenuTile]
          : [tradeTile, developmentCardTile, buildMenuTile, buildingTiles]}
      </div>
      {callout && !piecesOpen ? (
        <p
          className="game-build-callout motion-safe:animate-game-pop"
          key={callout.id}
          role="status"
        >
          {callout.reason}
        </p>
      ) : null}
    </section>
  );
}
