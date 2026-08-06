"use client";

import type { BaseGameSettings } from "@settersaga/game";
import { getGameMapDefinition } from "@settersaga/game/maps";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@iconify/react";
import Image from "next/image";
import { useEffect, useState } from "react";
import botIcon from "@iconify-icons/game-icons/robot-golem";
import gamepadIcon from "@iconify-icons/game-icons/gamepad";
import checkIcon from "@iconify-icons/solar/check-circle-outline";
import copyIcon from "@iconify-icons/solar/copy-outline";
import logoutIcon from "@iconify-icons/solar/logout-outline";
import sendIcon from "@iconify-icons/solar/plain-2-outline";
import usersIcon from "@iconify-icons/solar/users-group-two-rounded-outline";

import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { LiveMessage } from "@/components/ui/live-message";
import { getPlayerPortraitPath } from "@/constants/game/player-assets";
import type { PendingAction } from "@/lib/app/pending-action";
import type { RoomView } from "@/lib/game/types";
import {
  createLobbySeatPreview,
  getBotCapacity,
  toBotCount,
} from "@/lib/lobby/lobby-settings-model";
import { LobbySettings, type BotCount, type LobbySettingsValue } from "./lobby-settings";

type LobbyConfirmation =
  | { kind: "leave" }
  | { displayName: string; kind: "replace"; targetSeatId: string };
interface ChatMessage {
  readonly id: number;
  readonly text: string;
}

export interface LobbyScreenProps {
  error: string;
  onLeave(): Promise<void>;
  onReplacePlayer(targetSeatId: string): Promise<void>;
  onSaveSettings(value: LobbySettingsValue): Promise<void>;
  onStart(): Promise<void>;
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
  const [copied, setCopied] = useState(false);
  const [confirmation, setConfirmation] = useState<LobbyConfirmation | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<readonly ChatMessage[]>([]);
  const botCount = room.members.filter((m) => m.controller === "bot").length as BotCount;
  const [settingsDraft, setSettingsDraft] = useState<LobbySettingsValue>(() => ({
    botCount,
    botDifficulty: room.botDifficulty,
    settings: room.settings,
  }));
  const humanCount = room.members.length - botCount;
  const botCapacity = getBotCapacity(settingsDraft.settings.maxPlayers, humanCount);
  const seats = createLobbySeatPreview({
    botCount: settingsDraft.botCount,
    maxPlayers: settingsDraft.settings.maxPlayers,
    members: room.members,
    savedMaxPlayers: room.settings.maxPlayers,
  });
  const occupiedSeatCount = seats.filter(Boolean).length;
  const settingsAreSaved = sameLobbySettings(settingsDraft, room);
  const tableIsFull = room.members.length === room.settings.maxPlayers;
  const startHint = !settingsAreSaved
    ? "Save game settings before starting."
    : !tableIsFull
      ? `Fill all ${room.settings.maxPlayers} seats before starting.`
      : "";

  useEffect(() => {
    setSettingsDraft({ botCount, botDifficulty: room.botDifficulty, settings: room.settings });
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

  const runConfirmedAction = async () => {
    if (!confirmation) return;
    if (confirmation.kind === "leave") await onLeave();
    else await onReplacePlayer(confirmation.targetSeatId);
    setConfirmation(null);
  };
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/room/${room.code}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  const addBot = () => {
    setSettingsDraft((current) => ({
      ...current,
      botCount: toBotCount(
        Math.min(current.botCount + 1, getBotCapacity(current.settings.maxPlayers, humanCount)),
      ),
    }));
  };
  const submitChatMessage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = chatDraft.trim();
    if (!text) return;
    setChatMessages((messages) => [...messages, { id: Date.now(), text }]);
    setChatDraft("");
  };

  return (
    <main className="min-h-dvh bg-background" id="main-content">
      <header className="flex items-center justify-between border-b bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
            S
          </div>
          <span className="text-sm font-bold">SetterSaga</span>
          <Badge variant="secondary">
            Private room <span className="font-mono ml-1">{room.code}</span>
          </Badge>
        </div>
        <Button
          variant="ghost"
          disabled={pendingAction !== null}
          onClick={() => setConfirmation({ kind: "leave" })}
        >
          <Icon icon={logoutIcon} />
          {pendingAction === "leave" ? (
            <>
              <Spinner data-icon="inline-start" /> Leaving...
            </>
          ) : (
            "Leave"
          )}
        </Button>
      </header>

      <div className="mx-auto grid max-w-6xl gap-4 p-4 lg:grid-cols-[280px_1fr_280px]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Icon icon={usersIcon} /> Players
              </span>
              <Badge variant="outline">
                {occupiedSeatCount}/{settingsDraft.settings.maxPlayers}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="space-y-2">
              {seats.map((member, index) => (
                <li
                  key={member?.id ?? `open-seat-${index}`}
                  className="flex items-center gap-2 rounded-md border p-2"
                >
                  {member ? (
                    <>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold overflow-hidden">
                        {member.controller === "bot" ? (
                          <Image
                            alt=""
                            height={32}
                            width={32}
                            src={getPlayerPortraitPath(member.playerColor)}
                          />
                        ) : (
                          member.displayName.slice(0, 1).toUpperCase()
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {member.displayName}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {member.role === "host"
                            ? "Host"
                            : member.controller === "bot"
                              ? "Bot player"
                              : "Ready"}
                        </span>
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        Ready
                      </Badge>
                      {room.isHost && member.controller === "player" && member.role !== "host" ? (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label={`Replace ${member.displayName} with a bot`}
                          disabled={pendingAction !== null}
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
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">Open seat</span>
                        <span className="block text-xs text-muted-foreground">
                          Waiting for a player
                        </span>
                      </span>
                      {room.isHost ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pendingAction !== null || settingsDraft.botCount >= botCapacity}
                          onClick={addBot}
                        >
                          <Icon icon={botIcon} /> Add bot
                        </Button>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ol>
            <Separator />
            <div className="space-y-2 rounded-md bg-muted p-3">
              <p className="text-sm font-semibold">Invite your crew</p>
              <p className="text-xs text-muted-foreground">
                Share the room link to fill open seats.
              </p>
              <Button variant="secondary" size="sm" onClick={copyInvite} className="w-full">
                <Icon icon={copied ? checkIcon : copyIcon} />
                {copied ? "Invite copied" : "Copy invite link"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Room <span className="font-mono">{room.code}</span>
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={copyInvite}>
                <Icon icon={copied ? checkIcon : copyIcon} />
                {copied ? "Copied" : "Copy invite"}
              </Button>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border p-2">
                <p className="text-xs text-muted-foreground">Game mode</p>
                <p className="text-sm font-semibold">Base Game</p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-xs text-muted-foreground">Map</p>
                <p className="text-sm font-semibold">
                  {getGameMapDefinition(settingsDraft.settings.map).label}
                </p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-xs text-muted-foreground">Victory</p>
                <p className="text-sm font-semibold">
                  {settingsDraft.settings.victoryPoints} points
                </p>
              </div>
            </div>
            <LobbySettings
              botCount={settingsDraft.botCount}
              botDifficulty={settingsDraft.botDifficulty}
              disabled={!room.isHost || pendingAction !== null}
              humanCount={humanCount}
              onChange={setSettingsDraft}
              settings={settingsDraft.settings}
            />
            <Separator />
            <div className="space-y-2">
              <LiveMessage message={error} />
              {startHint ? (
                <p id="start-game-hint" className="text-xs text-muted-foreground">
                  {startHint}
                </p>
              ) : null}
              {room.isHost ? (
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={pendingAction !== null || settingsAreSaved}
                    onClick={() => void onSaveSettings(settingsDraft)}
                  >
                    {pendingAction === "settings" ? (
                      <>
                        <Spinner data-icon="inline-start" /> Saving...
                      </>
                    ) : (
                      "Save settings"
                    )}
                  </Button>
                  <Button disabled={pendingAction !== null || Boolean(startHint)} onClick={onStart}>
                    <Icon icon={gamepadIcon} />
                    {pendingAction === "start" ? (
                      <>
                        <Spinner data-icon="inline-start" /> Building island...
                      </>
                    ) : (
                      "Start game"
                    )}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Waiting for the host to start...</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Chat</CardTitle>
            <CardDescription>Room</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            <div className="flex-1 space-y-2 overflow-auto rounded-md border bg-muted/30 p-3 text-sm">
              <div className="rounded-md bg-background p-2 text-xs">
                <strong>Room created</strong> — Say hello while everyone gets ready.
              </div>
              {chatMessages.map((m) => (
                <div key={m.id} className="rounded-md bg-background p-2">
                  <span className="text-xs font-semibold">You</span>
                  <p className="text-sm">{m.text}</p>
                </div>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={submitChatMessage}>
              <label className="sr-only" htmlFor="room-chat-message">
                Send a message
              </label>
              <Input
                id="room-chat-message"
                maxLength={240}
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
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
          </CardContent>
        </Card>
      </div>

      {confirmation ? (
        <ConfirmationDialog
          busy={pendingAction !== null}
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

function sameLobbySettings(value: LobbySettingsValue, room: RoomView): boolean {
  const roomBotCount = room.members.filter((m) => m.controller === "bot").length;
  return (
    value.botCount === roomBotCount &&
    value.botDifficulty === room.botDifficulty &&
    Object.entries(value.settings).every(
      ([key, setting]) => room.settings[key as keyof BaseGameSettings] === setting,
    )
  );
}
