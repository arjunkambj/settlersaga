"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

const UTC_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});
const LOCAL_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

/** False in the server render and while hydrating, true once the client has taken over. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/**
 * Formats a time of day ("5:30 PM"). The server has no idea of the player's time zone, so the
 * server render and hydration use UTC, and the player's local time takes over right after.
 */
export function useTimeOfDayFormatter(): Intl.DateTimeFormat {
  return useHydrated() ? LOCAL_TIME_FORMATTER : UTC_TIME_FORMATTER;
}
