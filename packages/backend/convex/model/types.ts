import type { Infer } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { roomViewValidator } from "./validators";

export type ReadCtx = Pick<QueryCtx, "db">;
export type WriteCtx = MutationCtx;
export type RoomDoc = Doc<"rooms">;
export type RoomRecord = Omit<RoomDoc, "_creationTime">;
export type SeatDoc = Doc<"seats">;
export type SeatRecord = Omit<SeatDoc, "_creationTime">;
export type GameDoc = Doc<"games">;
export type RoomId = Id<"rooms">;
export type GameId = Id<"games">;
export type RoomView = Infer<typeof roomViewValidator>;
export type GameEventView = RoomView["events"][number];
