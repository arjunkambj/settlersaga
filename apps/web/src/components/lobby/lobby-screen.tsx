"use client";

import chevronDownIcon from "@iconify-icons/solar/alt-arrow-down-linear";
import bookIcon from "@iconify-icons/solar/book-bookmark-bold";
import chatIcon from "@iconify-icons/solar/chat-round-dots-bold";
import closeIcon from "@iconify-icons/solar/close-circle-bold";
import logoutIcon from "@iconify-icons/solar/logout-2-bold";
import playIcon from "@iconify-icons/solar/play-bold";
import trashIcon from "@iconify-icons/solar/trash-bin-2-bold";
import { Icon } from "@iconify/react/offline";
import Image from "next/image";
import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";

import { AccountToolbar } from "@/components/app/account-toolbar";
import { SceneBackdrop } from "@/components/app/scene-backdrop";
import { GameHelpDialog } from "@/components/game/game-help-dialog";
import { CopyButton } from "@/components/lobby/copy-button";
import { LobbyCrew } from "@/components/lobby/lobby-crew";
import { LobbySettings } from "@/components/lobby/lobby-settings";
import { ChatPanel, type RoomChat } from "@/components/room/chat-panel";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { LiveMessage } from "@/components/ui/live-message";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { WAIT_ICON_ASSET_PATH } from "@/constants/game/ui-assets";
import { toActionableError } from "@/lib/app/action-errors";
import type { PendingAction } from "@/lib/app/pending-action";
import type { RoomView } from "@/lib/game/types";
import {
  createLobbySeatPreview,
  fitToRoom,
  getBotCapacity,
  getLobbyStartOptions,
  roomToLobbyValue,
  withBotCount,
  type LobbySettingsValue,
  type LobbyStartOption,
} from "@/lib/lobby/lobby-settings-model";
import { GAME_MAP_NAMES } from "@/lib/lobby/map-names";
import { cn } from "@/lib/utils";

// Coalesces quick taps (a stepper held down, several chips in a row) into one save.
const SETTINGS_SAVE_DELAY_MS = 300;
/** A rules section that starts within this many rem of the list's bottom stays out of view. */
const RULES_REST_BAND_REM = 7;

function getRootFontSize(): number {
  return Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

type LobbyConfirmation =
  | { kind: "close" }
  | { kind: "leave" }
  | { displayName: string; kind: "remove"; targetSeatId: string };

export interface LobbyScreenProps {
  chat: RoomChat;
  error: string;
  /** Human seats whose players have stopped sending presence heartbeats. */
  offlineSeatIndexes: ReadonlySet<number>;
  /** Rejects when the server refuses, so the confirmation can say why and offer a retry. */
  onLeave(): Promise<void>;
  /** The host closes the lobby for everyone. Rejects when the server refuses. */
  onRemoveRoom(): Promise<void>;
  /** Rejects when the server refuses, so the confirmation can say why and offer a retry. */
  onReplacePlayer(targetSeatId: string): Promise<void>;
  /** Settles once the server has answered; a refusal is reported through `error`. */
  onSaveSettings(value: LobbySettingsValue): Promise<unknown>;
  /** Settles once the server has answered; a refusal is reported through `error`. */
  onStart(option: LobbyStartOption): Promise<unknown>;
  pendingAction: PendingAction;
  room: RoomView;
}

export function LobbyScreen({
  chat,
  error,
  offlineSeatIndexes,
  onLeave,
  onRemoveRoom,
  onReplacePlayer,
  onSaveSettings,
  onStart,
  pendingAction,
  room,
}: LobbyScreenProps) {
  // The host's unsaved edits. Without one the room is shown exactly as the server has it.
  const [draft, setDraft] = useState<LobbySettingsValue | null>(null);
  const [confirmation, setConfirmation] = useState<LobbyConfirmation | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  // Messages already in the log when the harbor opens, such as the last game's, count as read.
  const [chatSeenAt, setChatSeenAt] = useState(() => Date.now());
  const chatPanelId = useId();
  const chatPanelRef = useRef<HTMLElement>(null);
  const chatToggleRef = useRef<HTMLButtonElement>(null);
  const rulesScrollRef = useRef<HTMLDivElement>(null);

  const saved = roomToLobbyValue(room);
  const value = draft ?? saved;
  const humanCount = room.members.length - saved.botCount;
  const seats = createLobbySeatPreview({
    botCount: value.botCount,
    maxPlayers: value.settings.maxPlayers,
    members: room.members,
    savedMaxPlayers: room.settings.maxPlayers,
  });
  const occupiedSeatCount = seats.filter(Boolean).length;
  // Presence is keyed by the server's seat numbers, which a draft table size may reshuffle.
  const awayMemberIds = new Set(
    room.members
      .filter((member) => offlineSeatIndexes.has(member.seatIndex))
      .map((member) => member.id),
  );
  const hostName = room.members.find((member) => member.role === "host")?.displayName;
  const nextHostName = room.members.find(
    (member) => member.controller === "player" && !member.isViewer,
  )?.displayName;
  const leaving = confirming && (confirmation?.kind === "leave" || confirmation?.kind === "close");
  const busy = confirming || (pendingAction !== null && pendingAction !== "settings");
  const locked = leaving || pendingAction === "start";
  // One save at a time, and no start during one: whichever settles first would end the other's
  // pending state.
  const saving = pendingAction === "settings";
  const unreadChatCount = chatOpen
    ? 0
    : chat.messages.filter((message) => !message.isMine && message.sentAt > chatSeenAt).length;

  // The draft is fitted to the crew seated when the save goes out, since someone may have
  // joined after the edit. Once the save settles the room props are authoritative again:
  // they hold the saved value, or the old one if the save failed. Newer edits keep their draft.
  const saveDraft = useEffectEvent((next: LobbySettingsValue) => {
    void onSaveSettings(fitToRoom(next, humanCount)).then(() =>
      setDraft((current) => (current === next ? null : current)),
    );
  });

  useEffect(() => {
    if (!draft || locked || saving) return;
    const timer = window.setTimeout(() => saveDraft(draft), SETTINGS_SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft, locked, saving]);

  // At rest, the rules end on a whole section: one that only starts in the bottom strip (its
  // heading and a sliver under the fade) is left out of view until the list scrolls.
  useEffect(() => {
    const list = rulesScrollRef.current;
    if (!list) return;
    const measure = () => {
      const band = RULES_REST_BAND_REM * getRootFontSize();
      const listBottom = list.getBoundingClientRect().bottom;
      let cut = 0;
      if (list.scrollTop < 1 && list.scrollHeight > list.clientHeight + 1) {
        for (const section of list.querySelectorAll(":scope > * > section")) {
          const fromBottom = listBottom - section.getBoundingClientRect().top;
          if (fromBottom > 0 && fromBottom < band) {
            cut = fromBottom;
            break;
          }
        }
      }
      if (cut > 0) {
        list.style.setProperty("--rules-rest-cut", `${Math.ceil(cut)}px`);
        list.dataset.restCut = "";
      } else {
        delete list.dataset.restCut;
      }
    };
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(list);
    if (list.firstElementChild) resizeObserver.observe(list.firstElementChild);
    list.addEventListener("scroll", measure, { passive: true });
    measure();
    return () => {
      resizeObserver.disconnect();
      list.removeEventListener("scroll", measure);
    };
  }, []);

  // Until wide screens give the chat its own column, it opens from the header in the crew's place.
  const openChat = () => {
    flushSync(() => setChatOpen(true));
    chatPanelRef.current?.focus();
  };

  const closeChat = () => {
    setChatOpen(false);
    setChatSeenAt(chat.messages.at(-1)?.sentAt ?? chatSeenAt);
    chatToggleRef.current?.focus();
  };

  const openConfirmation = (target: LobbyConfirmation) => {
    setConfirmError("");
    setConfirmation(target);
  };

  const confirm = async (target: LobbyConfirmation) => {
    setConfirming(true);
    setConfirmError("");
    try {
      await (target.kind === "leave"
        ? onLeave()
        : target.kind === "close"
          ? onRemoveRoom()
          : onReplacePlayer(target.targetSeatId));
      setConfirmation(null);
    } catch (cause) {
      setConfirmError(toActionableError(cause));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <main className="lobby-screen" id="main-content">
      <SceneBackdrop />

      <header className="lobby-header">
        <div className="lobby-header-start">
          <Tooltip label="Leave game">
            <Button
              aria-label="Leave game"
              disabled={busy}
              onClick={() => openConfirmation({ kind: "leave" })}
              size="game-md"
              variant="game-icon-danger"
            >
              {confirming && confirmation?.kind === "leave" ? (
                <Spinner className="size-5" />
              ) : (
                <Icon icon={logoutIcon} />
              )}
            </Button>
          </Tooltip>
          {room.canRemove ? (
            <Tooltip label="Remove lobby">
              <Button
                aria-label="Remove lobby"
                className="lobby-remove"
                disabled={busy}
                onClick={() => openConfirmation({ kind: "close" })}
                size="game-md"
                variant="game-icon"
              >
                {confirming && confirmation?.kind === "close" ? (
                  <Spinner className="size-5" />
                ) : (
                  <Icon icon={trashIcon} />
                )}
              </Button>
            </Tooltip>
          ) : null}
          <Tooltip label="How to play">
            <Button
              aria-label="How to play"
              onClick={() => setShowHelp(true)}
              size="game-md"
              variant="game-icon"
            >
              <Icon icon={bookIcon} />
            </Button>
          </Tooltip>
          <Tooltip label="Chat">
            <Button
              aria-controls={chatPanelId}
              aria-expanded={chatOpen}
              aria-label={unreadChatCount > 0 ? `Chat, ${unreadChatCount} new` : "Chat"}
              className="lobby-chat-toggle relative"
              onClick={chatOpen ? closeChat : openChat}
              ref={chatToggleRef}
              size="game-md"
              variant="game-icon"
            >
              <Icon icon={chatIcon} />
              {unreadChatCount > 0 ? (
                <span aria-hidden className="lobby-unread">
                  {Math.min(unreadChatCount, 99)}
                </span>
              ) : null}
            </Button>
          </Tooltip>
          <CopyButton
            className="lobby-header-code w-auto gap-2 px-3"
            copiedMessage="Code copied"
            failedMessage={`Couldn't copy. Share the code ${room.code}`}
            size="game-md"
            value={() => room.code}
            variant="game-icon"
          >
            <span className="sr-only">Copy game code </span>
            <span className="tracking-[0.12em] tabular-nums">{room.code}</span>
          </CopyButton>
        </div>
        <h1 className="lobby-header-title game-heading game-title-on-art">
          {room.isHost || !hostName ? (
            "Your table"
          ) : (
            // Only the name gives way, so a long one still reads as a table.
            <>
              <span className="truncate">{hostName}</span>
              <span className="shrink-0">&apos;s table</span>
            </>
          )}
        </h1>
        <div className="lobby-header-end">
          <AccountToolbar />
        </div>
      </header>

      <div className="lobby-layout" data-chat-open={chatOpen || undefined}>
        <LobbyPanel
          aside={
            <span className="game-pill">
              <span aria-hidden>
                {occupiedSeatCount}/{value.settings.maxPlayers}
              </span>
              <span className="sr-only">
                {occupiedSeatCount} of {value.settings.maxPlayers} seats taken
              </span>
            </span>
          }
          className="lobby-area-crew"
          title="Crew"
        >
          <LobbyCrew
            awayMemberIds={awayMemberIds}
            botCapacity={getBotCapacity(value.settings.maxPlayers, humanCount)}
            botCount={value.botCount}
            botDifficulty={value.botDifficulty}
            canManage={room.isHost}
            disabled={locked}
            onBotCountChange={(botCount) => setDraft(withBotCount(value, botCount, humanCount))}
            onRemoveMember={(member) =>
              openConfirmation({
                displayName: member.displayName,
                kind: "remove",
                targetSeatId: member.id,
              })
            }
            roomCode={room.code}
            seats={seats}
          />
        </LobbyPanel>

        <LobbyPanel
          aside={
            room.isHost ? (
              // Keeps its space while hidden so the settings do not jump on every save.
              <span className={cn("game-pill", !draft && "invisible")}>Saving…</span>
            ) : (
              <span className="game-pill">Set by host</span>
            )
          }
          className="lobby-area-rules"
          title="Rules"
        >
          <div className="lobby-scroll game-scroll-fade" ref={rulesScrollRef}>
            <LobbySettings
              disabled={locked}
              humanCount={humanCount}
              onChange={setDraft}
              readOnly={!room.isHost}
              value={value}
            />
          </div>
          {/* A pointer shortcut, shown by CSS only while more rules sit below the fold. Keyboard
              and screen reader users reach every rule by moving through the list itself. */}
          <button
            aria-hidden="true"
            className="lobby-more-rules"
            onClick={() => {
              const list = rulesScrollRef.current;
              list?.scrollBy({ behavior: "smooth", top: list.clientHeight * 0.75 });
            }}
            tabIndex={-1}
            type="button"
          >
            More rules
            <Icon icon={chevronDownIcon} />
          </button>
        </LobbyPanel>

        <LobbyPanel
          aside={
            <Button
              aria-label="Close chat"
              className="lobby-chat-close"
              onClick={closeChat}
              size="game-md"
              variant="game-icon"
            >
              <Icon icon={closeIcon} />
            </Button>
          }
          className="lobby-area-chat"
          id={chatPanelId}
          onKeyDown={(event) => {
            if (event.key === "Escape" && chatOpen) closeChat();
          }}
          ref={chatPanelRef}
          tabIndex={-1}
          title="Chat"
        >
          <ChatPanel
            className="flex-1"
            disabled={locked}
            messages={chat.messages}
            onSend={chat.onSend}
          />
        </LobbyPanel>

        <section aria-label="Start the game" className="lobby-launch game-menu-panel">
          {room.isHost ? (
            <HostLaunch
              busy={busy || saving}
              error={error}
              humanCount={humanCount}
              occupiedSeatCount={occupiedSeatCount}
              onStart={(option) => void onStart(option)}
              starting={pendingAction === "start"}
              value={value}
            />
          ) : (
            <div className="flex items-center gap-3">
              <Image
                alt=""
                className="size-12 shrink-0 object-contain motion-safe:animate-game-sway"
                height={96}
                src={WAIT_ICON_ASSET_PATH}
                width={96}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-base font-bold sm:text-lg">
                  Waiting for {hostName ?? "the host"} to start
                </p>
                <p className="text-sm font-semibold text-ui-text-soft">
                  {occupiedSeatCount} of {value.settings.maxPlayers} seats taken
                </p>
                <LiveMessage message={error} />
              </div>
            </div>
          )}
        </section>
      </div>

      {showHelp ? (
        <GameHelpDialog onClose={() => setShowHelp(false)} settings={value.settings} />
      ) : null}

      {confirmation ? (
        <ConfirmationDialog
          busy={confirming}
          confirmLabel={confirmation.kind === "leave" ? "Leave" : "Remove"}
          description={
            confirmation.kind === "remove"
              ? "They can't rejoin this game, and a bot takes their seat."
              : confirmation.kind === "close"
                ? nextHostName
                  ? "Everyone here is sent home, and the code stops working."
                  : "The lobby closes, and the code stops working."
                : !nextHostName
                  ? "You're the last one here, so the game closes when you leave."
                  : room.isHost
                    ? `${nextHostName} becomes the host when you leave.`
                    : "Your seat opens up for someone else."
          }
          onCancel={() => setConfirmation(null)}
          error={confirmError}
          onConfirm={() => void confirm(confirmation)}
          title={
            confirmation.kind === "remove"
              ? `Remove ${confirmation.displayName} from the table?`
              : confirmation.kind === "close"
                ? "Remove this lobby?"
                : "Leave this game?"
          }
        />
      ) : null}
    </main>
  );
}

function LobbyPanel({
  aside,
  children,
  className,
  title,
  ...props
}: ComponentProps<"section"> & { aside?: ReactNode; title: string }) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn("lobby-panel game-menu-panel", className)}
      {...props}
    >
      <header className="lobby-panel-head">
        <h2 className="lobby-panel-title game-heading" id={titleId}>
          {title}
        </h2>
        {aside ? <div className="lobby-panel-aside">{aside}</div> : null}
      </header>
      {children}
    </section>
  );
}

function HostLaunch({
  busy,
  error,
  humanCount,
  occupiedSeatCount,
  onStart,
  starting,
  value,
}: {
  busy: boolean;
  error: string;
  humanCount: number;
  occupiedSeatCount: number;
  onStart: (option: LobbyStartOption) => void;
  starting: boolean;
  value: LobbySettingsValue;
}) {
  const options = getLobbyStartOptions(value, occupiedSeatCount, humanCount);
  const openSeatCount = value.settings.maxPlayers - occupiedSeatCount;
  const shrinkMap = options.find((option) => option.kind === "shrink")?.value.settings.map;
  // Seating exactly this crew can mean moving islands: six players leave Grand Isle for Wide Isle.
  const newIsland =
    shrinkMap && shrinkMap !== value.settings.map ? ` on ${GAME_MAP_NAMES[shrinkMap]}` : "";
  const labels: Record<LobbyStartOption["kind"], string> = {
    fill: "Start with bots",
    shrink: `Start with ${occupiedSeatCount}`,
    start: "Start game",
  };
  const openSeats = `${openSeatCount} open seat${openSeatCount === 1 ? "" : "s"}`;
  const hint =
    openSeatCount === 0
      ? "Every seat is taken. Start when you're ready."
      : shrinkMap
        ? `${openSeats}. Start with ${occupiedSeatCount}${newIsland}, or let bots fill in.`
        : `${openSeats}. Bots fill in when you start.`;
  const buttonSize = "max-md:h-11 max-md:gap-2 max-md:px-3 max-md:text-base";

  // The hint takes the spare room while everything fits on one row. Once the buttons no
  // longer fit beside it they get a full-width row, where sibling buttons share it equally.
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <div className="flex min-w-0 grow-999 basis-48 flex-col gap-1">
        <p className="text-base font-bold sm:text-lg">{hint}</p>
        <LiveMessage className="text-left" message={error} />
      </div>
      <div className="grid grow auto-cols-fr grid-flow-col gap-2">
        {starting ? (
          <Button className={buttonSize} disabled size="game-lg" variant="game-gold">
            <Spinner className="size-6" /> Starting…
          </Button>
        ) : (
          options.map((option, index) => (
            <Button
              className={buttonSize}
              disabled={busy}
              key={option.kind}
              onClick={() => onStart(option)}
              size="game-lg"
              variant={index === 0 ? "game-gold" : "game-secondary"}
            >
              {index === 0 ? <Icon className="size-6 max-md:size-5" icon={playIcon} /> : null}
              {labels[option.kind]}
            </Button>
          ))
        )}
      </div>
    </div>
  );
}
