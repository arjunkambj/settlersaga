import {
  BUILD_COSTS,
  DEVELOPMENT_CARD_COST,
  type PlayerGameView,
  type PrivatePlayerState,
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
  getLockNote,
  getPiecesLeftCaption,
  type ActionTileStatus,
  type BuildPieceRule,
} from "@/lib/game/dock-actions";
import { formatInventory } from "@/lib/game/resources";

import { ActionTile, type ActionTileState } from "./action-tile";
import { CostPips } from "./dock-resource";
import { TradeCenter } from "./trade-center";

const BUILD_PIECES_ID = "game-build-pieces";
const CALLOUT_DURATION_MS = 2_400;
/** The longest piece name that fits the phone Build tile's chip. */
const PHONE_CHIP_NAME_LENGTH = 4;
/** What a building tile says while its build mode is on. */
const PLACING_LABEL = "Pick a spot";

function TileArt({ src }: { src: string }) {
  return (
    <Image
      alt=""
      className="size-full object-contain"
      draggable={false}
      height={768}
      loading="eager"
      sizes="4.5rem"
      src={src}
      width={512}
    />
  );
}

/**
 * The three building pieces as small thumbnails on the phone Build tile. A piece the player can
 * build now is lit and the others fade back, so what is within reach reads without opening the
 * tray.
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

/**
 * A tile's lock and status line from the panel-wide lock (roll first, not your turn) and its own
 * status. The order matters: an empty supply stands whatever the phase, then the panel's lock,
 * then the price, then the board. `lockReason` is the full sentence for the tooltip and the
 * callout; the state is the few words on the tile.
 */
function getTileView(
  panelLock: string | undefined,
  status: ActionTileStatus,
): { lockReason: string | null; state: ActionTileState } {
  if (status.kind === "blocked" && status.by === "supply") {
    return { lockReason: status.reason, state: { kind: "locked", label: status.note } };
  }
  if (panelLock) {
    return { lockReason: panelLock, state: { kind: "locked", label: getLockNote(panelLock) } };
  }
  switch (status.kind) {
    case "ready":
      return { lockReason: null, state: { kind: "ready" } };
    case "short":
      return { lockReason: status.reason, state: { kind: "need", label: status.note } };
    case "blocked":
      return { lockReason: status.reason, state: { kind: "locked", label: status.note } };
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
 * The viewer's opening round as four numbered steps: the ones placed carry a check, the one to
 * place now a gold line (only on the viewer's turn), the rest wait quietly.
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
 * Trade, development card and building tiles. Each building and card tile shows its art, its name
 * with how many are left, its price as a row of resource coins, and a status line in words: a
 * green "Ready" chip when it can be used now, "Need 1 Brick" when the player is short, or a lock
 * and a few words ("No open corner", "Roll first") when something else stops it. Only a ready tile is
 * lit; the others are drawn quiet. Locked tiles stay pressable: pressing one says why in a
 * callout above the panel (a tooltip says the same on hover and focus). From md up the tiles are
 * wide rows in a 2×2 grid over a slim Trade button (styles/game-layout.css); phones show Trade,
 * Dev card and a Build tile that opens the three building tiles as a tray, which closes on any
 * tap outside it or when the action moves on. During the opening placements the panel shows the
 * viewer's four opening steps instead.
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
  const developmentCard = getTileView(lockReason, getDevelopmentCardTileStatus(game, me));
  const pieceViews = BUILD_PIECE_RULES.map((rule) => ({
    rule,
    view: getTileView(lockReason, getBuildTileStatus(rule, game, me)),
  }));
  const readyRules = pieceViews
    .filter(({ view }) => view.state.kind === "ready")
    .map(({ rule }) => rule);
  // The phone Build tile names the one piece that is ready when the name fits its chip ("Road",
  // "City"); otherwise it counts them.
  const [onlyReady] = readyRules;
  // Nothing ready and nothing locking the panel: say when it is the cards that are missing.
  const buildMenuState: ActionTileState | undefined =
    readyRules.length > 0
      ? {
          kind: "ready",
          label:
            readyRules.length === 1 && onlyReady && onlyReady.label.length <= PHONE_CHIP_NAME_LENGTH
              ? onlyReady.label
              : `${readyRules.length} ready`,
        }
      : lockReason
        ? { kind: "locked", label: getLockNote(lockReason) }
        : pieceViews.some(({ view }) => view.state.kind === "need")
          ? { kind: "need", label: "Need cards" }
          : undefined;
  const trayNote = piecesOpen && callout ? callout.reason : lockReason;

  return (
    <section
      aria-labelledby="building-actions-title"
      className="game-build-panel"
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
      <div aria-hidden={setup || undefined} className="game-build-actions" inert={setup}>
        <TradeCenter
          game={game}
          isPaused={isPaused}
          lockReason={lockReason}
          me={me}
          onCommand={onCommand}
          onLockedPress={explain}
          onPausedAction={onPausedAction}
          pending={pending}
        />
        <ActionTile
          ariaLabel={`Buy dev card, ${formatInventory(DEVELOPMENT_CARD_COST)}. ${
            game.developmentCardSupply
          } left${developmentCard.lockReason ? `. ${developmentCard.lockReason}` : ""}`}
          art={<TileArt src={DEVELOPMENT_CARD_BACK_ASSET_PATH} />}
          caption={`${game.developmentCardSupply} left`}
          captionWideOnly
          cost={<CostPips cost={DEVELOPMENT_CARD_COST} />}
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
          tooltip={`Development card: ${formatInventory(DEVELOPMENT_CARD_COST)}`}
        />
        <div className="game-build-menu-toggle">
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
            cost={readyRules.length > 0 ? <span className="game-build-hint">Can build</span> : null}
            dimmed={readyRules.length === 0}
            kind="build-menu"
            onClick={() => setTrayActionNumber(piecesOpen ? null : game.actionNumber)}
            pressed={buildMode !== null}
            state={buildMenuState}
            title="Build"
          />
        </div>
        <div className="game-build-pieces" data-open={piecesOpen || undefined} id={BUILD_PIECES_ID}>
          {trayNote ? (
            <p aria-hidden="true" className="game-build-tray-note">
              {trayNote}
            </p>
          ) : null}
          {pieceViews.map(({ rule, view }) => {
            const active = buildMode === rule.piece;
            const cost = BUILD_COSTS[rule.piece];
            const left = me.piecesRemaining[rule.remaining];
            const piecesLeft = getPiecesLeftCaption(left);
            return (
              <ActionTile
                activeLabel={PLACING_LABEL}
                ariaLabel={`${active ? "Cancel" : "Build"} ${rule.label.toLowerCase()}, ${formatInventory(
                  cost,
                )}. ${left} left${view.lockReason ? `. ${view.lockReason}` : ""}`}
                art={<TileArt src={ACTION_CARD_ASSET_PATHS[rule.piece]} />}
                caption={piecesLeft.text}
                captionWideOnly={!piecesLeft.low}
                cost={<CostPips cost={cost} />}
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
                tooltip={`${rule.label}: ${formatInventory(cost)}. ${left} left`}
              />
            );
          })}
        </div>
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
