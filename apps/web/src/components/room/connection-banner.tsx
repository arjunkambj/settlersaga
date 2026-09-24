"use client";

import { useConvexConnectionState } from "convex/react";
import { useEffect, useState } from "react";

import { Spinner } from "@/components/ui/spinner";

// Short drops are common on mobile and recover on their own; only say something once a
// reconnect is taking long enough that actions will visibly stall.
const RECONNECT_GRACE_MS = 2_000;

export function ConnectionBanner() {
  const { isWebSocketConnected } = useConvexConnectionState();
  const [graceElapsed, setGraceElapsed] = useState(false);

  useEffect(() => {
    if (isWebSocketConnected) return;
    const timer = window.setTimeout(() => setGraceElapsed(true), RECONNECT_GRACE_MS);
    return () => {
      window.clearTimeout(timer);
      setGraceElapsed(false);
    };
  }, [isWebSocketConnected]);

  // The live region stays mounted so screen readers notice the message appearing inside it.
  return (
    <div className="fixed top-3 left-1/2 z-50 -translate-x-1/2" role="status">
      {!isWebSocketConnected && graceElapsed ? (
        <div className="game-menu-panel flex items-center gap-2 px-4 py-2 text-sm font-bold text-foreground">
          <Spinner aria-hidden />
          Reconnecting to the table…
        </div>
      ) : null}
    </div>
  );
}
