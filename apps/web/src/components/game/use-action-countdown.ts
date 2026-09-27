"use client";

import { useEffect, useState } from "react";

export type CountdownStatus = "expired" | "paused" | "running" | "starting";

/** Seconds left at which a countdown turns red and starts to pulse. */
const URGENT_SECONDS = 10;

export function useActionCountdown({
  isPaused,
  nextActionAt,
}: {
  isPaused: boolean;
  nextActionAt?: number;
}): {
  remainingMs: number | null;
  seconds: number | null;
  status: CountdownStatus;
  /** Running out (or out) of time. */
  urgent: boolean;
} {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    if (isPaused || !nextActionAt) {
      // oxlint-disable-next-line react/set-state-in-effect -- reads the clock, which a render can't
      setRemainingMs(nextActionAt ? Math.max(0, nextActionAt - Date.now()) : null);
      return;
    }

    const updateRemainingTime = () => {
      const nextRemainingMs = Math.max(0, nextActionAt - Date.now());
      setRemainingMs(nextRemainingMs);
      return nextRemainingMs;
    };

    if (updateRemainingTime() === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      if (updateRemainingTime() === 0) {
        window.clearInterval(timer);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [isPaused, nextActionAt]);

  const seconds = remainingMs === null ? null : Math.ceil(remainingMs / 1_000);
  if (isPaused) {
    return { remainingMs, seconds, status: "paused", urgent: false };
  }
  if (nextActionAt !== undefined && remainingMs === 0) {
    return { remainingMs, seconds, status: "expired", urgent: true };
  }
  return seconds === null
    ? { remainingMs, seconds, status: "starting", urgent: false }
    : { remainingMs, seconds, status: "running", urgent: seconds <= URGENT_SECONDS };
}

export function formatCountdown(status: CountdownStatus, remainingMs: number | null): string {
  switch (status) {
    case "paused":
    case "starting":
      return "—";
    case "expired":
      return "…";
    case "running":
      return formatClockTime(remainingMs ?? 0);
  }
}

/** Minutes and seconds, e.g. "0:42". */
export function formatClockTime(milliseconds: number): string {
  const totalSeconds = Math.ceil(milliseconds / 1_000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
