"use client";

import type { ResourceInventory, ResourceType } from "@settersaga/game";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";

export const HAND_DOCK_ROOT_ID = "game-hand-dock-root";
export const BOARD_INSPECTOR_DOCK_ROOT_ID = "board-inspector-dock-root";

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
}

const HandDockContext = createContext<HandDockContextValue | null>(null);

export function HandDockProvider({ children }: { children: ReactNode }) {
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
    }),
    [clearInteraction, ownedInteraction, setInteraction],
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

function DockPortal({ children, rootId }: { children: ReactNode; rootId: string }) {
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setRoot(document.getElementById(rootId));
  }, [rootId]);

  return root ? createPortal(children, root) : null;
}

export function HandDockPortal({ children }: { children: ReactNode }) {
  return <DockPortal rootId={HAND_DOCK_ROOT_ID}>{children}</DockPortal>;
}

export function BoardInspectorDockPortal({ children }: { children: ReactNode }) {
  return <DockPortal rootId={BOARD_INSPECTOR_DOCK_ROOT_ID}>{children}</DockPortal>;
}
