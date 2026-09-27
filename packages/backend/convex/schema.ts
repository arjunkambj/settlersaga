import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
  baseGameSettingsValidator,
  botDifficultyValidator,
  gameEventKindValidator,
  gameStatusValidator,
  roomStatusValidator,
  seatKindValidator,
} from "./model/validators";

export default defineSchema({
  rooms: defineTable({
    botDifficulty: botDifficultyValidator,
    code: v.string(),
    gameId: v.optional(v.id("games")),
    hostSeatId: v.optional(v.id("seats")),
    kickedAuthUserIds: v.array(v.string()),
    settings: baseGameSettingsValidator,
    status: roomStatusValidator,
    updatedAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_status_and_updated_at", ["status", "updatedAt"]),

  seats: defineTable({
    authUserId: v.optional(v.string()),
    displayName: v.string(),
    kind: seatKindValidator,
    roomId: v.id("rooms"),
    seatIndex: v.number(),
  })
    .index("by_room_and_seat_index", ["roomId", "seatIndex"])
    .index("by_room_and_auth_user_id", ["roomId", "authUserId"])
    .index("by_auth_user_id", ["authUserId"]),

  games: defineTable({
    automationToken: v.number(),
    nextActionAt: v.optional(v.number()),
    pausedNextActionRemainingMs: v.optional(v.number()),
    pausedTurnDeadlineRemainingMs: v.optional(v.number()),
    revision: v.number(),
    roomId: v.id("rooms"),
    stateJson: v.string(),
    status: gameStatusValidator,
    turnDeadlineAt: v.optional(v.number()),
  }).index("by_room_id", ["roomId"]),

  gameActions: defineTable({
    actorSeatId: v.id("seats"),
    afterRevision: v.number(),
    clientActionId: v.optional(v.string()),
    commandJson: v.optional(v.string()),
    eventKind: gameEventKindValidator,
    gameId: v.id("games"),
    text: v.string(),
  })
    .index("by_game_and_after_revision", ["gameId", "afterRevision"])
    .index("by_game_and_client_action_id", ["gameId", "clientActionId"]),

  roomMessages: defineTable({
    authUserId: v.string(),
    authorSeatId: v.id("seats"),
    body: v.string(),
    displayName: v.string(),
    roomId: v.id("rooms"),
    seatIndex: v.number(),
  })
    // oxlint-disable-next-line @convex-dev/no-duplicate-indexes -- chat history reads a room's messages in _creationTime order, which the compound index can't give
    .index("by_room_id", ["roomId"])
    .index("by_room_and_auth_user_id", ["roomId", "authUserId"]),

  presence: defineTable({
    authUserId: v.string(),
    lastSeenAt: v.number(),
    roomId: v.id("rooms"),
  }).index("by_room_and_auth_user_id", ["roomId", "authUserId"]),
});
