import {
  BOT_DIFFICULTIES,
  GAME_MAP_IDS,
  PLAYER_COLORS,
  PLAYER_COUNTS,
  RESOURCE_TYPES,
  TURN_TIMER_OPTIONS,
} from "@settersaga/game";
import { type Infer, v } from "convex/values";

function literals<const Literal extends string | number>(values: readonly Literal[]) {
  return v.union(...values.map((value) => v.literal(value)));
}

const resourceTypeValidator = literals(RESOURCE_TYPES);

const resourceInventoryValidator = v.object({
  brick: v.number(),
  sheep: v.number(),
  stone: v.number(),
  tree: v.number(),
  wheat: v.number(),
});

export const botDifficultyValidator = literals(BOT_DIFFICULTIES);

export const baseGameSettingsValidator = v.object({
  balancedDice: v.boolean(),
  discardLimit: v.number(),
  friendlyRobber: v.boolean(),
  hideBankCards: v.boolean(),
  map: literals(GAME_MAP_IDS),
  maxPlayers: literals(PLAYER_COUNTS),
  turnTimerSeconds: literals(TURN_TIMER_OPTIONS),
  victoryPoints: v.number(),
});

export const roomStatusValidator = v.union(
  v.literal("waiting"),
  v.literal("active"),
  v.literal("finished"),
  v.literal("closed"),
);

export const seatKindValidator = v.union(v.literal("human"), v.literal("bot"));

export const gameStatusValidator = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("finished"),
);

export const commandValidator = v.union(
  v.object({
    kind: v.literal("place_settlement"),
    vertexKey: v.string(),
  }),
  v.object({
    edgeKey: v.string(),
    kind: v.literal("place_road"),
  }),
  v.object({ kind: v.literal("roll") }),
  v.object({
    kind: v.literal("discard"),
    resources: resourceInventoryValidator,
  }),
  v.object({
    kind: v.literal("move_robber"),
    tileId: v.string(),
  }),
  v.object({
    kind: v.literal("steal"),
    victimPlayerId: v.string(),
  }),
  v.object({
    kind: v.literal("build_city"),
    vertexKey: v.string(),
  }),
  v.object({ kind: v.literal("buy_development_card") }),
  v.object({ kind: v.literal("play_knight") }),
  v.object({
    kind: v.literal("play_monopoly"),
    resource: resourceTypeValidator,
  }),
  v.object({ kind: v.literal("play_road_building") }),
  v.object({
    kind: v.literal("play_year_of_plenty"),
    resources: resourceInventoryValidator,
  }),
  v.object({
    give: resourceTypeValidator,
    kind: v.literal("trade_bank"),
    receive: resourceTypeValidator,
  }),
  v.object({
    give: resourceInventoryValidator,
    kind: v.literal("propose_trade"),
    recipientPlayerIds: v.array(v.string()),
    want: resourceInventoryValidator,
  }),
  v.object({
    accept: v.boolean(),
    kind: v.literal("respond_trade"),
    offerActionNumber: v.number(),
  }),
  v.object({
    kind: v.literal("confirm_trade"),
    offerActionNumber: v.number(),
    partnerPlayerId: v.string(),
  }),
  v.object({
    kind: v.literal("cancel_trade"),
    offerActionNumber: v.number(),
  }),
  v.object({ kind: v.literal("end_turn") }),
);

const SYSTEM_EVENT_KINDS = [
  "bot_control_started",
  "game_paused",
  "game_resumed",
  "game_started",
] as const;

export type SystemEventKind = (typeof SYSTEM_EVENT_KINDS)[number];

export const gameEventKindValidator = v.union(
  ...commandValidator.members.map((member) => member.fields.kind),
  v.literal("move_robber_and_steal"),
  ...SYSTEM_EVENT_KINDS.map((kind) => v.literal(kind)),
);

export type GameEventKind = Infer<typeof gameEventKindValidator>;

const playerColorValidator = literals(PLAYER_COLORS);

const gameEventViewValidator = v.object({
  actorPlayerId: v.string(),
  createdAt: v.number(),
  id: v.id("gameActions"),
  kind: gameEventKindValidator,
  /** The other player the move names, where its text already does: a trade's partner. */
  targetPlayerId: v.optional(v.string()),
  text: v.string(),
});

const roomMemberViewValidator = v.object({
  controller: v.union(v.literal("bot"), v.literal("player")),
  displayName: v.string(),
  id: v.string(),
  isViewer: v.boolean(),
  playerColor: playerColorValidator,
  role: v.union(v.literal("host"), v.literal("player")),
  seatIndex: v.number(),
});

export const roomViewValidator = v.object({
  botDifficulty: botDifficultyValidator,
  botThinking: v.boolean(),
  /** The viewer is the host and may remove the room (see canHostRemoveRoom). */
  canRemove: v.boolean(),
  code: v.string(),
  events: v.array(gameEventViewValidator),
  gameJson: v.optional(v.string()),
  isHost: v.boolean(),
  isPaused: v.boolean(),
  members: v.array(roomMemberViewValidator),
  nextActionAt: v.optional(v.number()),
  pausedRemainingMs: v.optional(v.number()),
  settings: baseGameSettingsValidator,
  status: roomStatusValidator,
});

export const chatMessageViewValidator = v.object({
  body: v.string(),
  displayName: v.string(),
  id: v.id("roomMessages"),
  isMine: v.boolean(),
  playerColor: playerColorValidator,
  seatIndex: v.number(),
  sentAt: v.number(),
});

export const presenceViewValidator = v.object({
  lastSeenAt: v.number(),
  seatIndex: v.number(),
});
