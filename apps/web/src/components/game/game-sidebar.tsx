"use client";

import type { BotDifficulty, PlayerGameView } from "@settersaga/game";
import closeIcon from "@iconify-icons/solar/close-circle-bold";
import { Icon } from "@iconify/react/offline";
import { useEffect, useRef, type KeyboardEvent } from "react";

import { ChatPanel, type RoomChat } from "@/components/room/chat-panel";
import { Button } from "@/components/ui/button";
import type { RoomEventView } from "@/lib/game/types";

import { EventLog } from "./event-log";
import { GAME_SIDEBAR_ID } from "./game-header";
import { PlayerPanel } from "./player-panel";
import { ResourceBank } from "./resource-bank";

export type GameFeedTab = "chat" | "log";

const SIDEBAR_TITLE_ID = "game-sidebar-title";

const FEED_TABS: readonly { id: GameFeedTab; label: string }[] = [
  { id: "log", label: "Log" },
  { id: "chat", label: "Chat" },
];

/**
 * The crew plaques, the bank and the Log/Chat feed. A rail beside the board on wide screens;
 * below that, a modal drawer the header opens (styles/game-layout.css).
 */
export function GameSidebar({
  botDifficulty,
  chat,
  events,
  feedTab,
  game,
  hostSeatIndex,
  isHost,
  longestRoadByPlayerId,
  modal,
  offlineSeatIndexes,
  onClose,
  onFeedTabChange,
  onReplacePlayer,
  open,
  pendingReplacementId,
  unreadChatCount,
  viewerProfileImageUrl,
}: {
  botDifficulty: BotDifficulty;
  chat: RoomChat;
  events: readonly RoomEventView[];
  feedTab: GameFeedTab;
  game: PlayerGameView;
  hostSeatIndex: number | null;
  isHost: boolean;
  longestRoadByPlayerId: ReadonlyMap<string, number>;
  /** An open drawer: a dialog over the inert game. */
  modal: boolean;
  offlineSeatIndexes: ReadonlySet<number>;
  onClose(): void;
  onFeedTabChange(tab: GameFeedTab): void;
  onReplacePlayer(playerId: string): void;
  /** Only means something while the sidebar is a drawer. */
  open: boolean;
  pendingReplacementId: string | null;
  unreadChatCount: number;
  viewerProfileImageUrl: string | null;
}) {
  const asideRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (modal) {
      closeButtonRef.current?.focus();
    }
  }, [modal]);

  useEffect(() => {
    if (!modal) {
      return;
    }
    // A click on the drawer's blank space leaves focus on the body, where Escape still closes it.
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      const target = event.target;
      if (
        event.key === "Escape" &&
        target instanceof Node &&
        (target === document.body || asideRef.current?.contains(target))
      ) {
        onClose();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [modal, onClose]);

  const moveTabFocus = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    const nextTab = feedTab === "log" ? "chat" : "log";
    onFeedTabChange(nextTab);
    document.getElementById(`game-feed-tab-${nextTab}`)?.focus();
  };

  return (
    <aside
      aria-label={modal ? undefined : "Crew & chat"}
      aria-labelledby={modal ? SIDEBAR_TITLE_ID : undefined}
      aria-modal={modal || undefined}
      className="game-sidebar"
      data-open={open || undefined}
      id={GAME_SIDEBAR_ID}
      ref={asideRef}
      role={modal ? "dialog" : undefined}
    >
      <div className="game-sidebar-head">
        <h2 className="game-title m-0 text-xl" id={SIDEBAR_TITLE_ID}>
          Crew & chat
        </h2>
        <Button
          aria-label="Close"
          onClick={onClose}
          ref={closeButtonRef}
          size="game-md"
          variant="game-icon"
        >
          <Icon aria-hidden="true" icon={closeIcon} />
        </Button>
      </div>

      <PlayerPanel
        activePlayerId={game.activePlayerId}
        botDifficulty={botDifficulty}
        hostSeatIndex={hostSeatIndex}
        isHost={isHost}
        largestArmyPlayerId={game.largestArmyPlayerId}
        lastDiceRoll={game.lastDiceRoll}
        longestRoadByPlayerId={longestRoadByPlayerId}
        longestRoadPlayerId={game.longestRoadPlayerId}
        offlineSeatIndexes={offlineSeatIndexes}
        onReplacePlayer={onReplacePlayer}
        pendingReplacementId={pendingReplacementId}
        players={game.players}
        turnOrder={game.turnOrder}
        viewerProfileImageUrl={viewerProfileImageUrl}
        victoryTarget={game.settings.victoryPoints}
        winnerPlayerId={game.winnerPlayerId}
      />

      <ResourceBank bank={game.bank} developmentCardSupply={game.developmentCardSupply} />

      <div className="game-feed game-panel">
        <div aria-label="Table feed" className="game-feed-tabs" role="tablist">
          {FEED_TABS.map((tab) => {
            const selected = feedTab === tab.id;
            const unread = tab.id === "chat" && !selected ? unreadChatCount : 0;
            return (
              <button
                aria-controls={`game-feed-${tab.id}`}
                aria-selected={selected}
                className="game-feed-tab"
                id={`game-feed-tab-${tab.id}`}
                key={tab.id}
                onClick={() => onFeedTabChange(tab.id)}
                onKeyDown={moveTabFocus}
                role="tab"
                tabIndex={selected ? 0 : -1}
                type="button"
              >
                {tab.label}
                {unread > 0 ? (
                  <span className="game-unread-badge">
                    {unread > 9 ? "9+" : unread}
                    <span className="sr-only"> unread</span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div
          aria-labelledby="game-feed-tab-log"
          className="game-feed-panel"
          hidden={feedTab !== "log"}
          id="game-feed-log"
          role="tabpanel"
        >
          <EventLog
            botDifficulty={botDifficulty}
            events={events}
            players={game.players}
            viewerPlayerId={game.viewerPlayerId}
            viewerProfileImageUrl={viewerProfileImageUrl}
          />
        </div>
        <div
          aria-labelledby="game-feed-tab-chat"
          className="game-feed-panel"
          hidden={feedTab !== "chat"}
          id="game-feed-chat"
          role="tabpanel"
        >
          <ChatPanel
            className="h-full"
            disabled={false}
            messages={chat.messages}
            onSend={chat.onSend}
          />
        </div>
      </div>
    </aside>
  );
}
