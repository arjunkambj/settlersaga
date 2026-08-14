"use client";

import { getGameMapDefinition } from "@settersaga/game/maps";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@iconify/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import checkIcon from "@iconify-icons/solar/check-circle-bold";
import copyIcon from "@iconify-icons/solar/copy-bold";
import botIcon from "@iconify-icons/solar/cpu-bolt-bold";
import gamepadIcon from "@iconify-icons/solar/gamepad-bold";
import logoutIcon from "@iconify-icons/solar/logout-bold";
import chatIcon from "@iconify-icons/solar/chat-round-line-bold";
import sendIcon from "@iconify-icons/solar/plain-2-bold";
import usersIcon from "@iconify-icons/solar/users-group-two-rounded-bold";

import { AccountToolbar } from "@/components/app/account-toolbar";
import { BrandMark } from "@/components/app/brand-logo";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { LiveMessage } from "@/components/ui/live-message";
import { getPlayerPortraitPath } from "@/constants/game/player-assets";
import type { PendingAction } from "@/lib/app/pending-action";
import type { RoomView } from "@/lib/game/types";
import {
  createLobbySeatPreview,
  getBotCapacity,
  getMinimumPlayerCount,
  tableSizeForPlayerCount,
  toBotCount,
  type BotCount,
} from "@/lib/lobby/lobby-settings-model";
import { LobbySettings, type LobbySettingsValue } from "./lobby-settings";

type LobbyConfirmation =
  | { kind: "leave" }
  | { displayName: string; kind: "replace"; targetSeatId: string };

export interface LobbyScreenProps {
  error: string;
  onLeave(): Promise<void>;
  onReplacePlayer(targetSeatId: string): Promise<void>;
  onSaveSettings(value: LobbySettingsValue): Promise<void>;
  onStart(value: LobbySettingsValue): Promise<void>;
  pendingAction: PendingAction;
  room: RoomView;
}

export function LobbyScreen({
  error,
  onLeave,
  onReplacePlayer,
  onSaveSettings,
  onStart,
  pendingAction,
  room,
}: LobbyScreenProps) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<readonly { id: number; text: string }[]>([]);
  const [confirmation, setConfirmation] = useState<LobbyConfirmation | null>(null);
  const botCount = room.members.filter((member) => member.controller === "bot").length as BotCount;
  const [settingsDraft, setSettingsDraft] = useState<LobbySettingsValue>(() => ({
    botCount,
    botDifficulty: room.botDifficulty,
    settings: room.settings,
  }));
  const draftRef = useRef(settingsDraft);
  draftRef.current = settingsDraft;
  const persistTimer = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const humanCount = room.members.length - botCount;
  const botCapacity = getBotCapacity(settingsDraft.settings.maxPlayers, humanCount);
  const seats = createLobbySeatPreview({
    botCount: settingsDraft.botCount,
    maxPlayers: settingsDraft.settings.maxPlayers,
    members: room.members,
    savedMaxPlayers: room.settings.maxPlayers,
  });
  const occupiedSeatCount = seats.filter(Boolean).length;
  const emptySeatCount = settingsDraft.settings.maxPlayers - occupiedSeatCount;
  const minPlayerCount = getMinimumPlayerCount(settingsDraft.settings.map, humanCount);
  const settingsLocked = !room.isHost || pendingAction === "start" || pendingAction === "leave";
  const shrinkStart = tableSizeForPlayerCount(occupiedSeatCount);
  const filledStart = withFilledBots(settingsDraft, humanCount);
  const shrinkStartValue =
    shrinkStart && emptySeatCount > 0
      ? {
          ...settingsDraft,
          botCount: toBotCount(
            Math.min(settingsDraft.botCount, shrinkStart.maxPlayers - humanCount),
          ),
          settings: {
            ...settingsDraft.settings,
            map: shrinkStart.map,
            maxPlayers: shrinkStart.maxPlayers,
          },
        }
      : null;

  useEffect(() => {
    const incoming = { botCount, botDifficulty: room.botDifficulty, settings: room.settings };
    if (sameLobbySettings(incoming, draftRef.current)) {
      dirtyRef.current = false;
      return;
    }
    if (dirtyRef.current) {
      return;
    }
    setSettingsDraft(incoming);
  }, [
    botCount,
    room.botDifficulty,
    room.settings.balancedDice,
    room.settings.discardLimit,
    room.settings.friendlyRobber,
    room.settings.hideBankCards,
    room.settings.map,
    room.settings.maxPlayers,
    room.settings.turnTimerSeconds,
    room.settings.victoryPoints,
  ]);

  useEffect(() => {
    return () => {
      if (persistTimer.current !== null) {
        window.clearTimeout(persistTimer.current);
      }
    };
  }, []);

  const applyDraft = (next: LobbySettingsValue, persist: "now" | "soon") => {
    dirtyRef.current = true;
    setSettingsDraft(next);
    if (!room.isHost) return;
    if (persistTimer.current !== null) {
      window.clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    if (sameLobbySettings(next, room)) {
      dirtyRef.current = false;
      return;
    }
    if (persist === "now") {
      void onSaveSettings(next);
      return;
    }
    persistTimer.current = window.setTimeout(() => {
      persistTimer.current = null;
      const latest = draftRef.current;
      if (!sameLobbySettings(latest, room)) {
        void onSaveSettings(latest);
      }
    }, 400);
  };

  const runConfirmedAction = async () => {
    if (!confirmation) return;
    if (confirmation.kind === "leave") await onLeave();
    else await onReplacePlayer(confirmation.targetSeatId);
    setConfirmation(null);
  };

  const copyValue = async (kind: "code" | "link") => {
    const value =
      kind === "code"
        ? room.code
        : `${window.location.origin}/room/${encodeURIComponent(room.code)}`;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  };

  const addBot = () => {
    const current = draftRef.current;
    applyDraft(
      {
        ...current,
        botCount: toBotCount(Math.min(current.botCount + 1, botCapacity)),
      },
      "now",
    );
  };

  const removeBot = () => {
    const current = draftRef.current;
    applyDraft(
      {
        ...current,
        botCount: toBotCount(Math.max(0, current.botCount - 1)),
      },
      "now",
    );
  };

  const fillEmptySeats = () => {
    applyDraft(withFilledBots(draftRef.current, humanCount), "now");
  };

  const submitChatMessage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = chatDraft.trim();
    if (!text) return;
    setChatMessages((messages) => [...messages, { id: Date.now(), text }]);
    setChatDraft("");
  };

  const startWith = (value: LobbySettingsValue) => {
    if (persistTimer.current !== null) {
      window.clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    void onStart({
      ...draftRef.current,
      ...value,
      settings: { ...draftRef.current.settings, ...value.settings },
    });
  };

  const startHint = !room.isHost
    ? "Waiting for the host to start."
    : occupiedSeatCount < minPlayerCount
      ? `Need ${minPlayerCount - occupiedSeatCount} more player${minPlayerCount - occupiedSeatCount === 1 ? "" : "s"} or bots to start.`
      : emptySeatCount > 0
        ? shrinkStart
          ? `You can start with ${occupiedSeatCount}, or fill the open seats first.`
          : `Fill the remaining ${emptySeatCount} seat${emptySeatCount === 1 ? "" : "s"} to start.`
        : "";

  const startActions = room.isHost ? (
    <div className="flex items-center justify-end gap-2">
      {emptySeatCount === 0 ? (
        <Button
          disabled={pendingAction !== null && pendingAction !== "settings"}
          onClick={() => startWith(draftRef.current)}
          size="lg"
        >
          <Icon data-icon="inline-start" icon={gamepadIcon} />
          {pendingAction === "start" ? (
            <>
              <Spinner data-icon="inline-start" /> Building island...
            </>
          ) : (
            "Start game"
          )}
        </Button>
      ) : shrinkStartValue ? (
        <>
          <Button
            disabled={pendingAction !== null && pendingAction !== "settings"}
            onClick={() => startWith(shrinkStartValue)}
            size="lg"
          >
            <Icon data-icon="inline-start" icon={gamepadIcon} />
            {pendingAction === "start" ? (
              <>
                <Spinner data-icon="inline-start" /> Building island...
              </>
            ) : (
              `Start with ${occupiedSeatCount}`
            )}
          </Button>
          <Button
            disabled={pendingAction !== null && pendingAction !== "settings"}
            onClick={() => startWith(filledStart)}
            size="lg"
            variant="secondary"
          >
            Fill seats & start
          </Button>
        </>
      ) : (
        <Button
          disabled={pendingAction !== null && pendingAction !== "settings"}
          onClick={() => startWith(filledStart)}
          size="lg"
        >
          <Icon data-icon="inline-start" icon={gamepadIcon} />
          {pendingAction === "start" ? (
            <>
              <Spinner data-icon="inline-start" /> Building island...
            </>
          ) : (
            "Fill seats & start"
          )}
        </Button>
      )}
    </div>
  ) : (
    <p className="text-sm text-muted-foreground">The host will start when the table is set.</p>
  );

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background" id="main-content">
      <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <BrandMark className="size-8 drop-shadow-none" />
          <div>
            <p className="text-sm font-bold leading-none">Host Island</p>
            <p className="text-xs text-muted-foreground">Private table</p>
          </div>
        </div>
        <Badge variant="secondary" className="font-mono">
          Private room {room.code}
        </Badge>
        <div className="flex items-center justify-end gap-2">
          <AccountToolbar />
          <Button
            variant="destructive"
            disabled={pendingAction !== null && pendingAction !== "settings"}
            onClick={() => setConfirmation({ kind: "leave" })}
          >
            <Icon data-icon="inline-start" icon={logoutIcon} />
            {pendingAction === "leave" ? (
              <>
                <Spinner data-icon="inline-start" /> Leaving...
              </>
            ) : (
              "Leave"
            )}
          </Button>
        </div>
      </div>

      <div className="mx-auto grid min-h-0 w-full min-w-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[20rem_minmax(0,1fr)_22rem] lg:overflow-hidden">
        <Card className="flex h-full min-h-0 min-w-0 flex-col">
          <CardHeader className="shrink-0 border-b">
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Icon icon={usersIcon} />
                Players
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                {occupiedSeatCount}/{settingsDraft.settings.maxPlayers}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pt-3">
            <ol className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              {seats.map((member, index) => (
                <li
                  key={member?.id ?? `open-seat-${index}`}
                  className="flex min-h-0 min-w-0 items-center gap-3 rounded-2xl bg-muted/40 px-3 py-2.5"
                >
                  {member ? (
                    <>
                      <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                        <Image
                          alt=""
                          height={56}
                          width={56}
                          className="size-14 object-cover"
                          src={getPlayerPortraitPath(member.playerColor)}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-semibold">
                          {member.displayName}
                        </span>
                        <span className="block text-sm text-muted-foreground">
                          {member.role === "host"
                            ? "Host"
                            : member.controller === "bot"
                              ? "Bot"
                              : "Crew"}
                        </span>
                      </span>
                      {room.isHost && member.controller === "bot" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={settingsLocked}
                          onClick={removeBot}
                        >
                          Remove
                        </Button>
                      ) : null}
                      {room.isHost && member.controller === "player" && member.role !== "host" ? (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label={`Replace ${member.displayName} with a bot`}
                          disabled={pendingAction !== null && pendingAction !== "settings"}
                          onClick={() =>
                            setConfirmation({
                              displayName: member.displayName,
                              kind: "replace",
                              targetSeatId: member.id,
                            })
                          }
                        >
                          <Icon icon={botIcon} />
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-sm font-semibold text-muted-foreground">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold">Open seat</span>
                      </span>
                      {room.isHost ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={settingsLocked || settingsDraft.botCount >= botCapacity}
                          onClick={addBot}
                        >
                          <Icon data-icon="inline-start" icon={botIcon} />
                          Bot
                        </Button>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ol>

            {room.isHost && emptySeatCount > 0 ? (
              <Button
                className="shrink-0"
                size="sm"
                variant="secondary"
                disabled={settingsLocked}
                onClick={fillEmptySeats}
              >
                <Icon data-icon="inline-start" icon={botIcon} />
                Fill empty seats
              </Button>
            ) : null}
          </CardContent>
          <CardFooter className="flex shrink-0 flex-col items-stretch gap-2 border-t">
            <div>
              <p className="text-sm font-semibold">Invite your crew</p>
              <p className="text-xs text-muted-foreground">
                Share the room link to fill open seats.
              </p>
            </div>
            <Button variant="secondary" onClick={() => void copyValue("link")}>
              <Icon data-icon="inline-start" icon={copied === "link" ? checkIcon : copyIcon} />
              {copied === "link" ? "Invite copied" : "Copy invite link"}
            </Button>
          </CardFooter>
        </Card>

        <Card className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <CardHeader className="shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Room ID
                </p>
                <CardTitle className="font-mono text-3xl tracking-[0.12em]">{room.code}</CardTitle>
              </div>
              <Button variant="secondary" onClick={() => void copyValue("code")}>
                <Icon data-icon="inline-start" icon={copied === "code" ? checkIcon : copyIcon} />
                {copied === "code" ? "Copied" : "Copy code"}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="rounded-2xl bg-muted/40 px-3 py-2">
                <p className="text-xs text-muted-foreground">Game mode</p>
                <p className="text-sm font-semibold">Base Game</p>
              </div>
              <div className="rounded-2xl bg-muted/40 px-3 py-2">
                <p className="text-xs text-muted-foreground">Map</p>
                <p className="text-sm font-semibold">
                  {getGameMapDefinition(settingsDraft.settings.map).label}
                </p>
              </div>
              <div className="rounded-2xl bg-muted/40 px-3 py-2">
                <p className="text-xs text-muted-foreground">Victory</p>
                <p className="text-sm font-semibold">
                  {settingsDraft.settings.victoryPoints} points
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <LobbySettings
              botCount={settingsDraft.botCount}
              botDifficulty={settingsDraft.botDifficulty}
              disabled={settingsLocked}
              humanCount={humanCount}
              onChange={(value) => applyDraft(value, "soon")}
              settings={settingsDraft.settings}
              variant="rules"
            />
          </CardContent>
          <CardFooter className="flex shrink-0 items-center justify-between gap-3 border-t">
            <div className="min-w-0">
              <LiveMessage message={error} />
              {startHint ? <p className="text-xs text-muted-foreground">{startHint}</p> : null}
            </div>
            {startActions}
          </CardFooter>
        </Card>

        <Card className="flex h-full min-h-[24rem] min-w-0 flex-col lg:min-h-0">
          <CardHeader className="flex shrink-0 flex-row items-center justify-between border-b">
            <CardTitle>Chat</CardTitle>
            <CardDescription>Room</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {chatMessages.length === 0 ? (
              <Empty className="min-h-0 overflow-hidden border p-6">
                <EmptyHeader>
                  <EmptyMedia
                    variant="icon"
                    className="size-16 rounded-2xl [&_svg:not([class*='size-'])]:size-8"
                  >
                    <Icon icon={chatIcon} />
                  </EmptyMedia>
                  <EmptyTitle>No messages yet</EmptyTitle>
                  <EmptyDescription>Say hello while everyone gets ready.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-y-auto">
                {chatMessages.map((message) => (
                  <div key={message.id} className="flex flex-col items-end gap-1">
                    <span className="px-1 text-xs text-muted-foreground">You</span>
                    <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground">
                      {message.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="shrink-0 border-t">
            <form className="flex w-full items-center gap-2" onSubmit={submitChatMessage}>
              <label className="sr-only" htmlFor="room-chat-message">
                Send a message
              </label>
              <Input
                id="room-chat-message"
                maxLength={240}
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                placeholder="Send a message..."
                className="flex-1"
              />
              <Button
                aria-label="Send message"
                disabled={!chatDraft.trim()}
                size="icon"
                type="submit"
              >
                <Icon icon={sendIcon} />
              </Button>
            </form>
          </CardFooter>
        </Card>
      </div>

      {confirmation ? (
        <ConfirmationDialog
          busy={pendingAction !== null && pendingAction !== "settings"}
          confirmLabel={confirmation.kind === "leave" ? "Leave Room" : "Use Bot"}
          description={
            confirmation.kind === "leave"
              ? room.isHost
                ? "Leaving now closes this waiting room for everyone in it."
                : "Leaving now frees your seat for another player or bot."
              : `${confirmation.displayName} will lose control of this seat, and a bot will take over.`
          }
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void runConfirmedAction()}
          title={confirmation.kind === "leave" ? "Leave this room?" : "Replace this player?"}
        />
      ) : null}
    </main>
  );
}

function withFilledBots(value: LobbySettingsValue, humanCount: number): LobbySettingsValue {
  return {
    ...value,
    botCount: getBotCapacity(value.settings.maxPlayers, humanCount),
  };
}

function sameLobbySettings(
  left: LobbySettingsValue,
  right: LobbySettingsValue | RoomView,
): boolean {
  const rightBotCount =
    "botCount" in right
      ? right.botCount
      : right.members.filter((member) => member.controller === "bot").length;
  return (
    left.botCount === rightBotCount &&
    left.botDifficulty === right.botDifficulty &&
    Object.entries(left.settings).every(
      ([key, setting]) => right.settings[key as keyof typeof right.settings] === setting,
    )
  );
}
