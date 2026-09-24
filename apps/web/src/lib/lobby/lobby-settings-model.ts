import {
  AVAILABLE_GAME_MAPS,
  chooseBotName,
  getGameMapDefinition,
  PLAYER_COLORS,
  type BaseGameSettings,
  type BotDifficulty,
  type GameMapId,
  type PlayerColor,
  type PlayerCount,
} from "@settersaga/game";

import type { RoomView } from "@/lib/game/types";

export interface LobbySettingsValue {
  readonly botCount: number;
  readonly botDifficulty: BotDifficulty;
  readonly settings: Readonly<BaseGameSettings>;
}

export type LobbySeatMember = Pick<
  RoomView["members"][number],
  "controller" | "displayName" | "id" | "isViewer" | "playerColor" | "role" | "seatIndex"
>;

export interface LobbyStartOption {
  readonly kind: "start" | "shrink" | "fill";
  readonly value: LobbySettingsValue;
}

interface TableSize {
  readonly map: GameMapId;
  readonly maxPlayers: PlayerCount;
}

interface LobbySeatPreviewInput {
  readonly botCount: number;
  readonly maxPlayers: PlayerCount;
  readonly members: readonly LobbySeatMember[];
  readonly savedMaxPlayers: PlayerCount;
}

export function roomToLobbyValue(
  room: Pick<RoomView, "botDifficulty" | "members" | "settings">,
): LobbySettingsValue {
  return {
    botCount: room.members.filter((member) => member.controller === "bot").length,
    botDifficulty: room.botDifficulty,
    settings: room.settings,
  };
}

export function getBotCapacity(maxPlayers: PlayerCount, humanCount: number): number {
  return Math.max(0, maxPlayers - humanCount);
}

export function getCompatiblePlayerCount(
  mapId: GameMapId,
  humanCount: number,
  preferredPlayerCount: PlayerCount,
): PlayerCount | null {
  const playerCounts = getGameMapDefinition(mapId).playerCounts.filter(
    (playerCount) => playerCount >= humanCount,
  );

  return (
    playerCounts.sort(
      (left, right) =>
        Math.abs(left - preferredPlayerCount) - Math.abs(right - preferredPlayerCount) ||
        left - right,
    )[0] ?? null
  );
}

export function tableSizeForPlayerCount(playerCount: number): TableSize | null {
  for (const map of AVAILABLE_GAME_MAPS) {
    const maxPlayers = map.playerCounts.find((count) => count === playerCount);
    if (maxPlayers !== undefined) {
      return { map: map.id, maxPlayers };
    }
  }
  return null;
}

export function withTableSize(
  value: LobbySettingsValue,
  size: TableSize,
  humanCount: number,
): LobbySettingsValue {
  return {
    ...value,
    botCount: Math.min(value.botCount, getBotCapacity(size.maxPlayers, humanCount)),
    settings: { ...value.settings, map: size.map, maxPlayers: size.maxPlayers },
  };
}

export function withBotCount(
  value: LobbySettingsValue,
  botCount: number,
  humanCount: number,
): LobbySettingsValue {
  const capacity = getBotCapacity(value.settings.maxPlayers, humanCount);
  return { ...value, botCount: Math.min(Math.max(0, botCount), capacity) };
}

/** Refits an edit made for an earlier crew to the humans seated now, so a guest who joined
 * mid-edit takes a bot's seat, or grows the table, instead of making the save fail. An island
 * too small for the whole crew is left for the server to refuse. */
export function fitToRoom(value: LobbySettingsValue, humanCount: number): LobbySettingsValue {
  const { map, maxPlayers } = value.settings;
  const fittedPlayerCount = getCompatiblePlayerCount(map, humanCount, maxPlayers);
  return fittedPlayerCount === null
    ? value
    : withTableSize(value, { map, maxPlayers: fittedPlayerCount }, humanCount);
}

/** The ways the host can start: as-is when every seat is taken, otherwise by having the server
 * fill the open seats with bots or, when the taken seats make a valid table on their own, by
 * shrinking the table to them. */
export function getLobbyStartOptions(
  value: LobbySettingsValue,
  occupiedSeatCount: number,
  humanCount: number,
): LobbyStartOption[] {
  if (occupiedSeatCount >= value.settings.maxPlayers) {
    return [{ kind: "start", value }];
  }
  const fill: LobbyStartOption = { kind: "fill", value };
  const smallerTable = tableSizeForPlayerCount(occupiedSeatCount);
  return smallerTable
    ? [{ kind: "shrink", value: withTableSize(value, smallerTable, humanCount) }, fill]
    : [fill];
}

export function createLobbySeatPreview({
  botCount,
  maxPlayers,
  members,
  savedMaxPlayers,
}: LobbySeatPreviewInput): ReadonlyArray<LobbySeatMember | undefined> {
  const resizedMembers =
    maxPlayers === savedMaxPlayers ? members : fitMembersToPlayerLimit(members, maxPlayers);
  const humans = resizedMembers.filter((member) => member.controller === "player");
  const desiredBotCount = Math.min(botCount, getBotCapacity(maxPlayers, humans.length));
  const bots = resizedMembers
    .filter((member) => member.controller === "bot")
    .sort(bySeatIndex)
    .slice(0, desiredBotCount);
  const occupiedSeatIndexes = new Set([...humans, ...bots].map((member) => member.seatIndex));
  const unavailableNames = new Set([...humans, ...bots].map((member) => member.displayName));
  const addedBots = Array.from({ length: maxPlayers }, (_, seatIndex) => seatIndex)
    .filter((seatIndex) => !occupiedSeatIndexes.has(seatIndex))
    .slice(0, desiredBotCount - bots.length)
    .map((seatIndex) => {
      const bot = createDraftBot(seatIndex, [...unavailableNames]);
      unavailableNames.add(bot.displayName);
      return bot;
    });
  const membersBySeat = new Map(
    [...humans, ...bots, ...addedBots].map((member) => [member.seatIndex, member]),
  );

  return Array.from({ length: maxPlayers }, (_, seatIndex) => membersBySeat.get(seatIndex));
}

// Mirrors the server's fitWaitingSeatsToSettings: the host sits first, then the other humans,
// then as many bots (lowest seats first) as the smaller table still has room for.
function fitMembersToPlayerLimit(
  members: readonly LobbySeatMember[],
  maxPlayers: PlayerCount,
): LobbySeatMember[] {
  const humans = members
    .filter((member) => member.controller === "player")
    .sort((left, right) =>
      left.role === right.role ? bySeatIndex(left, right) : left.role === "host" ? -1 : 1,
    );
  const bots = members
    .filter((member) => member.controller === "bot")
    .sort(bySeatIndex)
    .slice(0, getBotCapacity(maxPlayers, humans.length));

  return [...humans, ...bots].map((member, seatIndex) => ({
    ...member,
    playerColor: seatColor(seatIndex),
    seatIndex,
  }));
}

function seatColor(seatIndex: number): PlayerColor {
  return PLAYER_COLORS[seatIndex] ?? PLAYER_COLORS[0];
}

function bySeatIndex(left: LobbySeatMember, right: LobbySeatMember): number {
  return left.seatIndex - right.seatIndex;
}

function createDraftBot(seatIndex: number, unavailableNames: readonly string[]): LobbySeatMember {
  return {
    controller: "bot",
    displayName: chooseBotName(`draft-bot:${seatIndex}`, unavailableNames),
    id: `draft-bot-${seatIndex}`,
    isViewer: false,
    playerColor: seatColor(seatIndex),
    role: "player",
    seatIndex,
  };
}
