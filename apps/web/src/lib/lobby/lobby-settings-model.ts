import {
  chooseBotName,
  PLAYER_COLORS,
  type BaseGameSettings,
  type GameMapId,
  type PlayerColor,
  type PlayerCount,
} from "@settersaga/game";
import { getGameMapDefinition } from "@settersaga/game/maps";

export type BotCount = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface LobbySeatMember {
  readonly controller: "bot" | "player";
  readonly displayName: string;
  readonly id: string;
  readonly playerColor: PlayerColor;
  readonly ready: boolean;
  readonly role: "host" | "player";
  readonly seatIndex: number;
}

interface LobbySeatPreviewInput {
  readonly botCount: BotCount;
  readonly maxPlayers: BaseGameSettings["maxPlayers"];
  readonly members: readonly LobbySeatMember[];
  readonly savedMaxPlayers: BaseGameSettings["maxPlayers"];
}

export function getBotCapacity(
  maxPlayers: BaseGameSettings["maxPlayers"],
  humanCount: number,
): BotCount {
  return toBotCount(Math.max(0, maxPlayers - humanCount));
}

export function getMinimumPlayerCount(
  mapId: GameMapId,
  humanCount: number,
): BaseGameSettings["maxPlayers"] {
  const playerCounts = getGameMapDefinition(mapId).playerCounts;
  return (
    playerCounts.find((playerCount) => playerCount >= humanCount) ??
    playerCounts[playerCounts.length - 1]!
  );
}

export function getCompatiblePlayerCount(
  mapId: GameMapId,
  humanCount: number,
  preferredPlayerCount: BaseGameSettings["maxPlayers"],
): BaseGameSettings["maxPlayers"] | null {
  const playerCounts = getGameMapDefinition(mapId).playerCounts.filter(
    (playerCount) => playerCount >= humanCount,
  );

  return (
    [...playerCounts].sort(
      (left, right) =>
        Math.abs(left - preferredPlayerCount) - Math.abs(right - preferredPlayerCount) ||
        left - right,
    )[0] ?? null
  );
}

export function toBotCount(value: number): BotCount {
  return clampInteger(value, 0, 7) as BotCount;
}

export const TABLE_SIZES = [
  { map: "base", maxPlayers: 3 },
  { map: "base", maxPlayers: 4 },
  { map: "extended-6", maxPlayers: 5 },
  { map: "extended-6", maxPlayers: 6 },
  { map: "extended-8", maxPlayers: 7 },
  { map: "extended-8", maxPlayers: 8 },
] as const satisfies ReadonlyArray<{
  map: GameMapId;
  maxPlayers: PlayerCount;
}>;

export function tableSizeForPlayerCount(playerCount: number): (typeof TABLE_SIZES)[number] | null {
  return TABLE_SIZES.find((size) => size.maxPlayers === playerCount) ?? null;
}

export function stepTableSize(
  mapId: GameMapId,
  maxPlayers: BaseGameSettings["maxPlayers"],
  humanCount: number,
  direction: -1 | 1,
): (typeof TABLE_SIZES)[number] | null {
  const currentIndex = TABLE_SIZES.findIndex(
    (size) => size.map === mapId && size.maxPlayers === maxPlayers,
  );
  const startIndex =
    currentIndex === -1 ? (direction === 1 ? -1 : TABLE_SIZES.length) : currentIndex;
  const next = TABLE_SIZES[startIndex + direction];
  if (!next || next.maxPlayers < humanCount) {
    return null;
  }
  return next;
}

export function createLobbySeatPreview({
  botCount,
  maxPlayers,
  members,
  savedMaxPlayers,
}: LobbySeatPreviewInput): ReadonlyArray<LobbySeatMember | undefined> {
  const resizedMembers =
    maxPlayers === savedMaxPlayers ? [...members] : fitMembersToPlayerLimit(members, maxPlayers);
  const humans = resizedMembers.filter((member) => member.controller === "player");
  const availableBotSeats = Math.max(0, maxPlayers - humans.length);
  const desiredBotCount = Math.min(botCount, availableBotSeats);
  const bots = resizedMembers
    .filter((member) => member.controller === "bot")
    .sort((left, right) => left.seatIndex - right.seatIndex)
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

function fitMembersToPlayerLimit(
  members: readonly LobbySeatMember[],
  maxPlayers: BaseGameSettings["maxPlayers"],
): LobbySeatMember[] {
  const humans = members
    .filter((member) => member.controller === "player")
    .sort(compareLobbyMembers);
  const bots = members
    .filter((member) => member.controller === "bot")
    .sort((left, right) => left.seatIndex - right.seatIndex)
    .slice(0, Math.max(0, maxPlayers - humans.length));

  return [...humans, ...bots].map(moveMemberToSeat);
}

function compareLobbyMembers(left: LobbySeatMember, right: LobbySeatMember): number {
  if (left.role !== right.role) return left.role === "host" ? -1 : 1;
  return left.seatIndex - right.seatIndex;
}

function moveMemberToSeat(member: LobbySeatMember, seatIndex: number): LobbySeatMember {
  return {
    ...member,
    playerColor: PLAYER_COLORS[seatIndex] ?? PLAYER_COLORS[0],
    seatIndex,
  };
}

function createDraftBot(seatIndex: number, unavailableNames: readonly string[]): LobbySeatMember {
  return {
    controller: "bot",
    displayName: chooseBotName(`draft-bot:${seatIndex}`, unavailableNames),
    id: `draft-bot-${seatIndex}`,
    playerColor: PLAYER_COLORS[seatIndex] ?? PLAYER_COLORS[0],
    ready: true,
    role: "player",
    seatIndex,
  };
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}
