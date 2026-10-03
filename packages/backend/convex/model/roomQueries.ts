import { MAX_SEATS, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "./constants";
import { fail } from "./errors";
import { normalizeRoomCode } from "./normalize";
import type { ReadCtx, RoomDoc, RoomId, SeatDoc, SeatRecord } from "./types";

function roomCodeCandidate(): string {
  return Array.from(
    { length: ROOM_CODE_LENGTH },
    () => ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)],
  ).join("");
}

export async function allocateRoomCode(ctx: ReadCtx): Promise<string> {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const code = roomCodeCandidate();
    if (!(await findRoom(ctx, code))) return code;
  }
  fail("ROOM_CODE_EXHAUSTED", "Could not allocate a unique room code.");
}

async function findRoom(ctx: ReadCtx, code: string): Promise<RoomDoc | null> {
  return await ctx.db
    .query("rooms")
    .withIndex("by_code", (index) => index.eq("code", code))
    .unique();
}

export async function requireRoom(ctx: ReadCtx, rawCode: string): Promise<RoomDoc> {
  const room = await findRoom(ctx, normalizeRoomCode(rawCode));
  if (!room) fail("ROOM_NOT_FOUND", "Room not found.");
  if (room.status === "closed") fail("ROOM_CLOSED", "This room has closed.");
  return room;
}

/** The caller's human seat in an open room, or null when they cannot see the room. */
export async function findHumanMembership(
  ctx: ReadCtx,
  rawCode: string,
  authUserId: string,
): Promise<{ room: RoomDoc; seat: SeatDoc; seats: SeatDoc[] } | null> {
  const room = await findRoom(ctx, normalizeRoomCode(rawCode));
  if (!room || room.status === "closed") return null;
  const seats = await listSeats(ctx, room._id);
  const seat = seats.find(
    (candidate) => candidate.authUserId === authUserId && candidate.kind === "human",
  );
  return seat ? { room, seat, seats } : null;
}

export async function listSeats(ctx: ReadCtx, roomId: RoomId): Promise<SeatDoc[]> {
  const seats = await ctx.db
    .query("seats")
    .withIndex("by_room_and_seat_index", (index) => index.eq("roomId", roomId))
    .take(MAX_SEATS + 1);
  if (seats.length > MAX_SEATS) {
    fail("CORRUPT_GAME_STATE", `Room contains more than ${MAX_SEATS} seats.`);
  }
  return seats;
}

async function findSeatByAuthUser(
  ctx: ReadCtx,
  roomId: RoomId,
  authUserId: string,
): Promise<SeatDoc | null> {
  return await ctx.db
    .query("seats")
    .withIndex("by_room_and_auth_user_id", (index) =>
      index.eq("roomId", roomId).eq("authUserId", authUserId),
    )
    .unique();
}

export async function requireHumanSeat(
  ctx: ReadCtx,
  roomId: RoomId,
  authUserId: string,
): Promise<SeatDoc> {
  const seat = await findSeatByAuthUser(ctx, roomId, authUserId);
  if (!seat || seat.kind !== "human") {
    fail("NOT_ROOM_MEMBER", "Your account does not own a human seat in this room.");
  }
  return seat;
}

export function requireHumanSeatFromList<Seat extends SeatRecord>(
  seats: readonly Seat[],
  authUserId: string,
): Seat {
  const seat = seats.find((candidate) => candidate.authUserId === authUserId);
  if (!seat || seat.kind !== "human") {
    fail("NOT_ROOM_MEMBER", "Your account does not own a human seat in this room.");
  }
  return seat;
}

export function requireHost(room: RoomDoc, seat: SeatRecord, message: string): void {
  if (seat._id !== room.hostSeatId) fail("NOT_HOST", message);
}

export async function requireWaitingHost(
  ctx: ReadCtx,
  rawCode: string,
  authUserId: string,
  message: string,
): Promise<{ room: RoomDoc; seats: SeatDoc[] }> {
  const room = await requireRoom(ctx, rawCode);
  const seats = await listSeats(ctx, room._id);
  requireHost(room, requireHumanSeatFromList(seats, authUserId), message);
  if (room.status !== "waiting") {
    fail("ROOM_STARTED", "The lobby can only be changed before the game starts.");
  }
  return { room, seats };
}

/**
 * The other humans in the order of `seats`; with listSeats' seat order, the first one inherits
 * the host role.
 */
/**
 * Whether the host may remove the room for good: always before the game starts, and after that
 * only while no other person holds a seat, so a host never ends a game others are playing.
 */
export function canHostRemoveRoom(
  room: Pick<RoomDoc, "status">,
  seats: readonly SeatRecord[],
  hostSeat: SeatRecord,
): boolean {
  return room.status === "waiting" || otherHumans(seats, hostSeat).length === 0;
}

export function otherHumans<Seat extends SeatRecord>(
  seats: readonly Seat[],
  leavingSeat: SeatRecord,
): Seat[] {
  return seats.filter((seat) => seat.kind === "human" && seat._id !== leavingSeat._id);
}

export function nextOpenSeatIndex(
  seats: readonly Pick<SeatRecord, "seatIndex">[],
  maxPlayers: number,
): number {
  const occupied = new Set(seats.map((seat) => seat.seatIndex));
  const seatIndex = Array.from({ length: maxPlayers }, (_, index) => index).find(
    (index) => !occupied.has(index),
  );
  if (seatIndex === undefined) fail("ROOM_FULL", "Room already has its maximum seats.");
  return seatIndex;
}
