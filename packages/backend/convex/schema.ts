import { defineSchema, defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

export const resourceInventoryValidator = v.object({
  brick: v.number(),
  sheep: v.number(),
  stone: v.number(),
  tree: v.number(),
  wheat: v.number(),
});

export const resourceTypeValidator = v.union(
  v.literal("brick"),
  v.literal("sheep"),
  v.literal("stone"),
  v.literal("tree"),
  v.literal("wheat"),
);

const gameSettingsFields = {
  balancedDice: v.boolean(),
  discardLimit: v.number(),
  friendlyRobber: v.boolean(),
  hideBankCards: v.boolean(),
  maxPlayers: v.union(
    v.literal(3),
    v.literal(4),
    v.literal(5),
    v.literal(6),
    v.literal(7),
    v.literal(8),
  ),
  turnTimerSeconds: v.union(
    v.literal(0),
    v.literal(30),
    v.literal(60),
    v.literal(90),
    v.literal(120),
  ),
  victoryPoints: v.number(),
};

const gameMapValidator = v.union(
  v.literal("base"),
  v.literal("extended-6"),
  v.literal("extended-8"),
);

export const baseGameSettingsValidator = v.object({
  ...gameSettingsFields,
  map: gameMapValidator,
});

export const storedBaseGameSettingsValidator = baseGameSettingsValidator;

export type StoredBaseGameSettings = Infer<typeof storedBaseGameSettingsValidator>;

export const botDifficultyValidator = v.union(
  v.literal("easy"),
  v.literal("medium"),
  v.literal("hard"),
);

const roomStatusValidator = v.union(
  v.literal("waiting"),
  v.literal("active"),
  v.literal("finished"),
);

const seatKindValidator = v.union(v.literal("human"), v.literal("bot"));
const gameStatusValidator = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("finished"),
);

export default defineSchema({
  rooms: defineTable({
    botDifficulty: botDifficultyValidator,
    code: v.string(),
    createdAt: v.number(),
    gameId: v.optional(v.id("games")),
    hostSeatId: v.optional(v.id("seats")),
    settings: storedBaseGameSettingsValidator,
    status: roomStatusValidator,
    updatedAt: v.number(),
  }).index("by_code", ["code"]),

  seats: defineTable({
    authUserId: v.optional(v.string()),
    displayName: v.string(),
    joinedAt: v.number(),
    kind: seatKindValidator,
    roomId: v.id("rooms"),
    seatIndex: v.number(),
  })
    .index("by_room_and_seat_index", ["roomId", "seatIndex"])
    .index("by_room_and_auth_user_id", ["roomId", "authUserId"]),

  games: defineTable({
    botDifficulty: botDifficultyValidator,
    createdAt: v.number(),
    nextActionAt: v.optional(v.number()),
    pausedNextActionRemainingMs: v.optional(v.number()),
    pausedTurnDeadlineRemainingMs: v.optional(v.number()),
    revision: v.number(),
    roomId: v.id("rooms"),
    settings: storedBaseGameSettingsValidator,
    stateJson: v.string(),
    status: gameStatusValidator,
    turnDeadlineAt: v.optional(v.number()),
    updatedAt: v.number(),
  }),

  gameActions: defineTable({
    actorSeatId: v.id("seats"),
    afterRevision: v.number(),
    beforeRevision: v.number(),
    clientActionId: v.string(),
    commandJson: v.string(),
    createdAt: v.number(),
    eventKind: v.optional(v.string()),
    gameId: v.id("games"),
    text: v.string(),
  })
    .index("by_game_and_after_revision", ["gameId", "afterRevision"])
    .index("by_game_and_client_action_id", ["gameId", "clientActionId"]),
});
