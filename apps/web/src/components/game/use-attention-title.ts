"use client";

import { useEffect } from "react";

const FLASH_INTERVAL_MS = 1_000;

export interface AttentionRequest {
  /** Changes whenever a new moment needs the player (a new turn, a new offer). */
  key: string;
  title: string;
}

/**
 * While the tab is in the background, flashes the document title when something new needs the
 * player, and puts the page's own title back once they return (or the moment passes).
 */
export function useAttentionTitle(request: AttentionRequest | null) {
  const key = request?.key;
  const title = request?.title;

  useEffect(() => {
    if (!title || !document.hidden) {
      return;
    }

    const pageTitle = document.title;
    const alertTitle = `● ${title} · SetterSaga`;
    const flash = () => {
      document.title = document.title === alertTitle ? pageTitle : alertTitle;
    };
    const stop = () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.title = pageTitle;
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        stop();
      }
    };

    flash();
    const timer = window.setInterval(flash, FLASH_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return stop;
  }, [key, title]);
}
