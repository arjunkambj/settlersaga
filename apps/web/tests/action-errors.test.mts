import { describe, expect, test } from "bun:test";
import { ConvexError } from "convex/values";

import { getErrorCode, toActionableError } from "../src/lib/app/action-errors";

const GENERIC_MESSAGE = "That didn't go through. Check your connection and try again.";

describe("action errors", () => {
  test("maps known server codes to player-facing copy", () => {
    const roomFull = new ConvexError({ code: "ROOM_FULL", message: "Room is full." });
    const notHost = new ConvexError({ code: "NOT_HOST", message: "Caller is not the room host." });

    expect(getErrorCode(roomFull)).toBe("ROOM_FULL");
    expect(toActionableError(roomFull)).toBe("That game is full.");
    expect(getErrorCode(notHost)).toBe("NOT_HOST");
    expect(toActionableError(notHost)).toBe("Only the host can do that.");
  });

  test("falls back to generic copy for an unknown code", () => {
    const error = new ConvexError({ code: "SOMETHING_NEW", message: "Internal detail." });

    expect(getErrorCode(error)).toBe("SOMETHING_NEW");
    expect(toActionableError(error)).toBe(GENERIC_MESSAGE);
  });

  test("never shows the text of a plain error", () => {
    const error = new Error("ROOM_FULL: stack trace and request id");

    expect(getErrorCode(error)).toBeUndefined();
    expect(toActionableError(error)).toBe(GENERIC_MESSAGE);
  });

  test("ignores ConvexError data without a string code", () => {
    expect(getErrorCode(new ConvexError("ROOM_FULL"))).toBeUndefined();
    expect(getErrorCode(new ConvexError({ code: 42 }))).toBeUndefined();
    expect(toActionableError(new ConvexError({ message: "No code" }))).toBe(GENERIC_MESSAGE);
  });
});
