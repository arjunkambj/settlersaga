"use client";

import type { BotDifficulty } from "@settersaga/game";
import crownIcon from "@iconify-icons/solar/crown-minimalistic-bold";
import { Icon } from "@iconify/react/offline";
import Image from "next/image";

import { CopyButton } from "@/components/lobby/copy-button";
import { Button } from "@/components/ui/button";
import { MinusIcon, PlusIcon } from "@/components/ui/step-icons";
import { Tooltip } from "@/components/ui/tooltip";
import { getPlayerPortraitPath } from "@/constants/game/player-assets";
import { EMPTY_SEAT_ASSET_PATH } from "@/constants/game/ui-assets";
import { nameFit } from "@/lib/app/name-fit";
import { BOT_DIFFICULTY_DETAILS } from "@/lib/lobby/bot-difficulty";
import type { LobbySeatMember } from "@/lib/lobby/lobby-settings-model";
import { cn } from "@/lib/utils";

export interface LobbyCrewProps {
  /** Crew members whose presence heartbeat has gone quiet. */
  readonly awayMemberIds: ReadonlySet<string>;
  readonly botCapacity: number;
  readonly botCount: number;
  readonly botDifficulty: BotDifficulty;
  /** Whether this viewer hosts the room and may seat bots or remove crew. */
  readonly canManage: boolean;
  readonly disabled: boolean;
  readonly onBotCountChange: (botCount: number) => void;
  readonly onRemoveMember: (member: LobbySeatMember) => void;
  readonly roomCode: string;
  readonly seats: ReadonlyArray<LobbySeatMember | undefined>;
}

export function LobbyCrew({
  awayMemberIds,
  botCapacity,
  botCount,
  botDifficulty,
  canManage,
  disabled,
  onBotCountChange,
  onRemoveMember,
  roomCode,
  seats,
}: LobbyCrewProps) {
  const bot = BOT_DIFFICULTY_DETAILS[botDifficulty];

  return (
    <div className="lobby-scroll game-scroll-fade @container flex flex-col gap-4">
      {canManage ? (
        <div className="game-well flex items-center justify-between gap-2 p-2">
          <span className="flex min-w-0 items-center gap-2">
            <Image
              alt=""
              className="hidden size-10 shrink-0 object-contain @min-[16rem]:block"
              height={80}
              src={bot.artSrc}
              width={80}
            />
            <span className="truncate text-base font-extrabold @max-[16rem]:pl-2">Bots</span>
          </span>
          <div className="flex items-center gap-2">
            <Button
              aria-label="Remove a bot"
              className="max-lg:size-11 pointer-coarse:size-11"
              disabled={disabled || botCount === 0}
              onClick={() => onBotCountChange(botCount - 1)}
              size="game-sm"
              variant="game-icon"
            >
              <MinusIcon />
            </Button>
            <output aria-live="polite" className="lobby-counter lobby-counter-small">
              {botCount}
            </output>
            <Button
              aria-label="Add a bot"
              className="max-lg:size-11 pointer-coarse:size-11"
              disabled={disabled || botCount >= botCapacity}
              onClick={() => onBotCountChange(botCount + 1)}
              size="game-sm"
              variant="game-icon"
            >
              <PlusIcon />
            </Button>
          </div>
        </div>
      ) : null}

      <ol aria-label="Seats" className="flex flex-col gap-2.5">
        {seats.map((member, seatIndex) =>
          member ? (
            <CrewPlaque
              away={awayMemberIds.has(member.id)}
              botArt={bot.artSrc}
              botLabel={bot.label}
              key={member.id}
              member={member}
              onRemove={
                canManage && member.controller === "player" && member.role !== "host"
                  ? () => onRemoveMember(member)
                  : undefined
              }
              removeDisabled={disabled}
            />
          ) : (
            <li className="lobby-seat lobby-seat-open" key={`open-seat-${seatIndex}`}>
              <span className="lobby-seat-portrait">
                <Image
                  alt=""
                  className="size-full object-contain p-1"
                  height={112}
                  src={EMPTY_SEAT_ASSET_PATH}
                  width={112}
                />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="lobby-seat-name">Open seat</span>
                <span className="lobby-seat-meta truncate">Waiting for a player…</span>
              </span>
            </li>
          ),
        )}
      </ol>

      <CopyButton
        className="w-full"
        copiedMessage="Invite link copied"
        failedMessage={`Couldn't copy. Share the code ${roomCode}`}
        share
        size="game-md"
        value={() => `${window.location.origin}/room/${encodeURIComponent(roomCode)}`}
      >
        Invite crew
      </CopyButton>
    </div>
  );
}

function CrewPlaque({
  away,
  botArt,
  botLabel,
  member,
  onRemove,
  removeDisabled,
}: {
  away: boolean;
  botArt: string;
  botLabel: string;
  member: LobbySeatMember;
  onRemove?: () => void;
  removeDisabled: boolean;
}) {
  const role =
    member.role === "host" ? "Host" : member.controller === "bot" ? `${botLabel} bot` : "Player";
  return (
    <li className={cn("lobby-seat", `player-${member.playerColor}`, away && "lobby-seat-away")}>
      <span className="lobby-seat-portrait">
        <Image
          alt=""
          className="size-full object-cover"
          height={112}
          src={member.controller === "bot" ? botArt : getPlayerPortraitPath(member.playerColor)}
          width={112}
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="lobby-seat-title">
          <span className="lobby-seat-name" data-name-fit={nameFit(member.displayName)}>
            {member.displayName}
          </span>
          {member.isViewer ? (
            <span className="game-pill" data-tone="you">
              You
            </span>
          ) : null}
          {away ? (
            <span className="game-pill" data-tone="quiet">
              Away
            </span>
          ) : null}
        </span>
        <span className="lobby-seat-meta">
          {member.role === "host" ? (
            <Icon className="size-4 shrink-0 text-ui-text-soft" icon={crownIcon} />
          ) : null}
          <span className="truncate">{role}</span>
        </span>
      </span>
      {onRemove ? (
        <Tooltip label={`Remove ${member.displayName} from the table`}>
          <Button
            aria-label={`Remove ${member.displayName}`}
            className="lobby-seat-remove"
            disabled={removeDisabled}
            onClick={onRemove}
            size="game-sm"
            variant="game-secondary"
          >
            Remove
          </Button>
        </Tooltip>
      ) : null}
    </li>
  );
}
