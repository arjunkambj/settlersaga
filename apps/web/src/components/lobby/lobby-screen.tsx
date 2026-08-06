"use client";

import type { BaseGameSettings } from "@settersaga/game";
import { getGameMapDefinition } from "@settersaga/game/maps";
import { Button } from "@heroui/react";
import botIcon from "@iconify-icons/game-icons/robot-golem";
import crownIcon from "@iconify-icons/game-icons/crown";
import gamepadIcon from "@iconify-icons/game-icons/gamepad";
import checkIcon from "@iconify-icons/solar/check-circle-outline";
import copyIcon from "@iconify-icons/solar/copy-outline";
import logoutIcon from "@iconify-icons/solar/logout-outline";
import sendIcon from "@iconify-icons/solar/plain-2-outline";
import usersIcon from "@iconify-icons/solar/users-group-two-rounded-outline";
import { Icon } from "@iconify/react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { Brand } from "@/components/ui/brand";
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
import styles from "./lobby-screen.module.css";

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
  const botCount = room.members.filter((member) => member.controller === "bot").length as BotCount;
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
    setSettingsDraft({
      botCount,
      botDifficulty: room.botDifficulty,
      settings: room.settings,
    });
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
    if (confirmation.kind === "leave") {
      await onLeave();
    } else {
      await onReplacePlayer(confirmation.targetSeatId);
    }
    setConfirmation(null);
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?room=${room.code}`);
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
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <Brand className={styles.brand} />
        <div className={styles.headerRoom}>
          <span>Private room</span>
          <strong translate="no">{room.code}</strong>
        </div>
        <Button
          className={styles.leaveButton}
          isDisabled={pendingAction !== null}
          onPress={() => setConfirmation({ kind: "leave" })}
          variant="ghost"
        >
          <Icon aria-hidden="true" icon={logoutIcon} />
          {pendingAction === "leave" ? "Leaving…" : "Leave"}
        </Button>
      </header>

      <div className={styles.roomLayout}>
        <aside className={`${styles.panel} ${styles.playersPanel}`}>
          <div className={styles.panelTitle}>
            <span>
              <Icon aria-hidden="true" icon={usersIcon} /> Players
            </span>
            <small>
              {occupiedSeatCount}/{settingsDraft.settings.maxPlayers}
            </small>
          </div>

          <ol className={styles.seatList} aria-label="Player seats">
            {seats.map((member, index) => (
              <li
                className={`${styles.seat} ${member ? styles.occupiedSeat : styles.openSeat}`}
                key={member?.id ?? `open-seat-${index}`}
                style={
                  member
                    ? ({ "--seat-color": member.playerColor } as React.CSSProperties)
                    : undefined
                }
              >
                {member ? (
                  <>
                    <span className={styles.avatar} aria-hidden="true">
                      {member.controller === "bot" ? (
                        <Image
                          alt=""
                          height={96}
                          src={getPlayerPortraitPath(member.playerColor)}
                          width={96}
                        />
                      ) : (
                        member.displayName.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <span className={styles.playerInfo}>
                      <strong>{member.displayName}</strong>
                      <small>
                        {member.role === "host" ? (
                          <>
                            <Icon aria-hidden="true" icon={crownIcon} /> Host
                          </>
                        ) : member.controller === "bot" ? (
                          "Bot player"
                        ) : (
                          "Ready"
                        )}
                      </small>
                    </span>
                    <span className={styles.ready}>Ready</span>
                    {room.isHost && member.controller === "player" && member.role !== "host" ? (
                      <Button
                        aria-label={`Replace ${member.displayName} with a bot`}
                        className={styles.replaceButton}
                        isDisabled={pendingAction !== null}
                        onPress={() =>
                          setConfirmation({
                            displayName: member.displayName,
                            kind: "replace",
                            targetSeatId: member.id,
                          })
                        }
                        variant="ghost"
                      >
                        <Icon aria-hidden="true" icon={botIcon} />
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <>
                    <span className={styles.emptySeatNumber}>{index + 1}</span>
                    <span className={styles.playerInfo}>
                      <strong>Open seat</strong>
                      <small>Waiting for a player</small>
                    </span>
                    {room.isHost ? (
                      <Button
                        className={styles.addBotButton}
                        isDisabled={pendingAction !== null || settingsDraft.botCount >= botCapacity}
                        onPress={addBot}
                        variant="secondary"
                      >
                        <Icon aria-hidden="true" icon={botIcon} /> Add bot
                      </Button>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ol>

          <div className={styles.inviteFriends}>
            <strong>Invite your crew</strong>
            <p>Share the room link to fill open seats.</p>
            <Button onPress={copyInvite} variant="secondary">
              <Icon aria-hidden="true" icon={copied ? checkIcon : copyIcon} />
              {copied ? "Invite copied" : "Copy invite link"}
            </Button>
          </div>
        </aside>

        <section
          className={`${styles.panel} ${styles.settingsPanel}`}
          aria-labelledby="lobby-title"
        >
          <div className={styles.roomHeading}>
            <div>
              <p>Room ID</p>
              <h1 id="lobby-title" translate="no">
                {room.code}
              </h1>
            </div>
            <Button
              aria-label={`Copy invite link for room ${room.code}`}
              className={styles.copyButton}
              onPress={copyInvite}
              variant="secondary"
            >
              <Icon aria-hidden="true" icon={copied ? checkIcon : copyIcon} />
              {copied ? "Copied" : "Copy invite"}
            </Button>
          </div>

          <div className={styles.settingsScroll}>
            <div className={styles.modeSummary}>
              <div>
                <small>Game mode</small>
                <strong>Base Game</strong>
              </div>
              <div>
                <small>Map</small>
                <strong>{getGameMapDefinition(settingsDraft.settings.map).label}</strong>
              </div>
              <div>
                <small>Victory</small>
                <strong>{settingsDraft.settings.victoryPoints} points</strong>
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
          </div>

          <footer className={styles.settingsFooter}>
            <div>
              <LiveMessage message={error} />
              {startHint ? <p id="start-game-hint">{startHint}</p> : null}
            </div>
            {room.isHost ? (
              <div className={styles.hostActions}>
                <Button
                  isDisabled={pendingAction !== null || settingsAreSaved}
                  isPending={pendingAction === "settings"}
                  onPress={() => void onSaveSettings(settingsDraft)}
                  variant="secondary"
                >
                  {pendingAction === "settings" ? "Saving…" : "Save settings"}
                </Button>
                <Button
                  aria-describedby={startHint ? "start-game-hint" : undefined}
                  className={styles.startButton}
                  isDisabled={pendingAction !== null || Boolean(startHint)}
                  isPending={pendingAction === "start"}
                  onPress={onStart}
                >
                  <Icon aria-hidden="true" icon={gamepadIcon} />
                  {pendingAction === "start" ? "Building island…" : "Start game"}
                </Button>
              </div>
            ) : (
              <p className={styles.waiting}>Waiting for the host to start…</p>
            )}
          </footer>
        </section>

        <aside className={`${styles.panel} ${styles.chatPanel}`} aria-label="Room chat">
          <div className={styles.panelTitle}>
            <span>Chat</span>
            <small>Room</small>
          </div>
          <div className={styles.chatMessages} aria-live="polite">
            <div className={styles.systemMessage}>
              <Icon aria-hidden="true" icon={usersIcon} />
              <p>
                <strong>Room created</strong>Say hello while everyone gets ready.
              </p>
            </div>
            {chatMessages.map((message) => (
              <div className={styles.chatMessage} key={message.id}>
                <span>You</span>
                <p>{message.text}</p>
              </div>
            ))}
          </div>
          <form className={styles.chatForm} onSubmit={submitChatMessage}>
            <label className="sr-only" htmlFor="room-chat-message">
              Send a message
            </label>
            <input
              id="room-chat-message"
              maxLength={240}
              onChange={(event) => setChatDraft(event.target.value)}
              placeholder="Send a message…"
              value={chatDraft}
            />
            <Button
              aria-label="Send message"
              isDisabled={!chatDraft.trim()}
              isIconOnly
              type="submit"
            >
              <Icon aria-hidden="true" icon={sendIcon} />
            </Button>
          </form>
        </aside>
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
  const roomBotCount = room.members.filter((member) => member.controller === "bot").length;
  return (
    value.botCount === roomBotCount &&
    value.botDifficulty === room.botDifficulty &&
    Object.entries(value.settings).every(
      ([key, setting]) => room.settings[key as keyof BaseGameSettings] === setting,
    )
  );
}
