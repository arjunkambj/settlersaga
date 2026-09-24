"use client";

import type { ResourceInventory, ResourceType } from "@settersaga/game";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export type HandInteractionOwner = "discard" | "trade";

export interface HandInteraction {
  disabled: boolean;
  label: string;
  onSelect(resource: ResourceType): void;
  preserveHandAppearance?: boolean;
  selected: Readonly<ResourceInventory>;
  sourceResources: Readonly<ResourceInventory>;
}

interface OwnedHandInteraction {
  interaction: HandInteraction;
  owner: HandInteractionOwner;
}

interface HandDockContextValue {
  clearInteraction(owner: HandInteractionOwner): void;
  interaction: HandInteraction | null;
  setInteraction(owner: HandInteractionOwner, interaction: HandInteraction): void;
  sheetRoot: HTMLElement | null;
}

const HandDockContext = createContext<HandDockContextValue | null>(null);

/** `sheetRoot` is the slot above the dock that trade and discard sheets render into. */
export function HandDockProvider({
  children,
  sheetRoot,
}: {
  children: ReactNode;
  sheetRoot: HTMLElement | null;
}) {
  const [ownedInteraction, setOwnedInteraction] = useState<OwnedHandInteraction | null>(null);

  const clearInteraction = useCallback((owner: HandInteractionOwner) => {
    setOwnedInteraction((current) => (current?.owner === owner ? null : current));
  }, []);

  const setInteraction = useCallback(
    (owner: HandInteractionOwner, interaction: HandInteraction) => {
      setOwnedInteraction({ interaction, owner });
    },
    [],
  );

  const value = useMemo<HandDockContextValue>(
    () => ({
      clearInteraction,
      interaction: ownedInteraction?.interaction ?? null,
      setInteraction,
      sheetRoot,
    }),
    [clearInteraction, ownedInteraction, setInteraction, sheetRoot],
  );

  return <HandDockContext.Provider value={value}>{children}</HandDockContext.Provider>;
}

export function useHandDock(): HandDockContextValue {
  const context = useContext(HandDockContext);
  if (!context) {
    throw new Error("useHandDock must be used inside HandDockProvider");
  }
  return context;
}

/** Renders a sheet (trade, discard) into the sheet slot above the dock. */
export function HandDockPortal({ children }: { children: ReactNode }) {
  const { sheetRoot } = useHandDock();
  return sheetRoot ? createPortal(children, sheetRoot) : null;
}
