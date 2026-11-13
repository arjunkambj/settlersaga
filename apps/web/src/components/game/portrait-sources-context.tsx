"use client";

import { createContext, useContext } from "react";

import type { PortraitSources } from "@/lib/game/hud-portraits";

const PortraitSourcesContext = createContext<PortraitSources | null>(null);

/** Set once by the game screen, so every portrait in the dock picks its art the way the rail does. */
export const PortraitSourcesProvider = PortraitSourcesContext.Provider;

/** Null outside a game screen; portraits then fall back to the seat's character. */
export function usePortraitSources(): PortraitSources | null {
  return useContext(PortraitSourcesContext);
}
