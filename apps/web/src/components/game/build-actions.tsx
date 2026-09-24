import {
  BUILD_COSTS,
  DEVELOPMENT_CARD_COST,
  type PlayerGameView,
  type PrivatePlayerState,
} from "@settersaga/game";
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
  getBuildLockReason,
  getDevelopmentCardLockReason,
} from "@/lib/game/dock-actions";
import { formatInventory } from "@/lib/game/resources";

import { ActionTile } from "./action-tile";
import { CostPips } from "./dock-resource";
import { TradeCenter } from "./trade-center";

const BUILD_PIECES_ID = "game-build-pieces";
const CALLOUT_DURATION_MS = 2_400;

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
 * Trade, development card and building tiles, each with its price in resource pips. Locked tiles
 * stay pressable: pressing one shows why it is locked in a callout above the panel (a tooltip
 * says the same on hover and focus). Phones show a Build tile that opens the three building tiles
 * as a tray (styles/game-layout.css); it closes on any tap outside it or when the action moves on.
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

  const developmentCardLock = lockReason ?? getDevelopmentCardLockReason(game, me);
  const trayNote = piecesOpen && callout ? callout.reason : lockReason;

  return (
    <section
      aria-labelledby="building-actions-title"
      className="game-build-panel"
      onKeyDown={(event) => {
        if (piecesOpen && event.key === "Escape") {
          closeTray();
        }
      }}
      ref={panelRef}
    >
      <div className="game-panel-heading">
        <strong className="game-build-heading" id="building-actions-title">
          Build & trade
        </strong>
      </div>
      <div className="game-build-actions">
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
          ariaLabel={`Buy a development card, ${formatInventory(DEVELOPMENT_CARD_COST)}. ${
            game.developmentCardSupply
          } left${developmentCardLock ? `. ${developmentCardLock}` : ""}`}
          art={<TileArt src={DEVELOPMENT_CARD_BACK_ASSET_PATH} />}
          cost={<CostPips cost={DEVELOPMENT_CARD_COST} resources={me.resources} />}
          count={game.developmentCardSupply}
          kind="development-card"
          lockReason={developmentCardLock}
          onClick={() => {
            if (developmentCardLock) {
              explain(developmentCardLock);
            } else if (!pending) {
              void onCommand({ kind: "buy_development_card" }, "Development card bought.");
            }
          }}
          title="Dev card"
          tooltip={`Development card: ${formatInventory(DEVELOPMENT_CARD_COST)}`}
        />
        <div className="game-build-menu-toggle">
          <ActionTile
            ariaControls={BUILD_PIECES_ID}
            ariaExpanded={piecesOpen}
            ariaLabel="Build a road, settlement or city"
            art={<TileArt src={ACTION_CARD_ASSET_PATHS.settlement} />}
            kind="build-menu"
            onClick={() => setTrayActionNumber(piecesOpen ? null : game.actionNumber)}
            pressed={buildMode !== null}
            title="Build"
          />
        </div>
        <div className="game-build-pieces" data-open={piecesOpen || undefined} id={BUILD_PIECES_ID}>
          {trayNote ? (
            <p aria-hidden="true" className="game-build-tray-note">
              {trayNote}
            </p>
          ) : null}
          {BUILD_PIECE_RULES.map((rule) => {
            const pieceLock = lockReason ?? getBuildLockReason(rule, game, me);
            const active = buildMode === rule.piece;
            const cost = BUILD_COSTS[rule.piece];
            const left = me.piecesRemaining[rule.remaining];
            return (
              <ActionTile
                ariaLabel={`${active ? "Cancel" : "Build"} ${rule.label.toLowerCase()}, ${formatInventory(
                  cost,
                )}. ${left} left${pieceLock ? `. ${pieceLock}` : ""}`}
                art={<TileArt src={ACTION_CARD_ASSET_PATHS[rule.piece]} />}
                cost={<CostPips cost={cost} resources={me.resources} />}
                count={left}
                key={rule.piece}
                kind={rule.piece}
                lockReason={pieceLock}
                onClick={() => {
                  if (pieceLock) {
                    explain(pieceLock);
                    return;
                  }
                  closeTray();
                  onBuildMode(active ? null : rule.piece);
                }}
                pressed={active}
                title={rule.label}
                tooltip={`${rule.label}: ${formatInventory(cost)}`}
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
