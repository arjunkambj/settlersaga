"use client";

import { api } from "@settersaga/backend/convex/_generated/api";
import { PRESENCE_AWAY_AFTER_MS } from "@settersaga/backend/convex/model/constants";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo } from "react";

import type { RoomView } from "@/lib/game/types";

const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * Tells the room this player is here (every 15s while the tab is visible, and at once when it
 * becomes visible again) and returns the other human seats whose players have gone quiet.
 */
export function useRoomPresence(
  room: Pick<RoomView, "code" | "members"> | null | undefined,
): ReadonlySet<number> {
  const code = room?.code;
  const heartbeat = useMutation(api.rooms.heartbeat);
  const presence = useQuery(api.rooms.listPresence, code ? { code } : "skip");

  useEffect(() => {
    if (!code) return;
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      // A missed beat only matters if every later one fails too, so failures stay silent.
      heartbeat({ code }).catch(() => undefined);
    };
    beat();
    const timer = window.setInterval(beat, HEARTBEAT_INTERVAL_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [code, heartbeat]);

  // Measured against the freshest heartbeat (this player's own, 15s at most behind the server)
  // rather than the device clock, which may be off by minutes.
  const latestSeenAt = Math.max(0, ...(presence ?? []).map(({ lastSeenAt }) => lastSeenAt));
  const otherHumanSeats = new Set(
    room?.members
      .filter((member) => member.controller === "player" && !member.isViewer)
      .map((member) => member.seatIndex),
  );
  const awayKey = (presence ?? [])
    .filter(
      ({ lastSeenAt, seatIndex }) =>
        otherHumanSeats.has(seatIndex) && latestSeenAt - lastSeenAt > PRESENCE_AWAY_AFTER_MS,
    )
    .map(({ seatIndex }) => seatIndex)
    .sort((a, b) => a - b)
    .join(",");

  // Every heartbeat changes the presence rows, so the set keeps its identity until someone
  // actually goes away or comes back.
  return useMemo(() => new Set(awayKey ? awayKey.split(",").map(Number) : []), [awayKey]);
}
