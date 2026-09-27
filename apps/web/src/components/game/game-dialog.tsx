"use client";

import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface GameDialogProps {
  children: ReactNode;
  dialogClassName?: string;
  footer: ReactNode;
  footerClassName?: string;
  id?: string;
  /** A short line under the title. */
  kicker: string;
  onClose(): void;
  title: string;
  toolbar?: ReactNode;
}

/** A kit dialog with the title first (level with the close button), then the kicker. */
export function GameDialog({
  children,
  dialogClassName,
  footer,
  footerClassName,
  id,
  kicker,
  onClose,
  title,
  toolbar,
}: GameDialogProps) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        id={id}
        className={cn("flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-2xl", dialogClassName)}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{kicker}</DialogDescription>
        </DialogHeader>
        {toolbar ? <div className="shrink-0">{toolbar}</div> : null}
        <div className="game-scroll-fade min-h-0 flex-1 overflow-y-auto">{children}</div>
        <div className={cn("flex shrink-0 justify-end gap-2", footerClassName)}>{footer}</div>
      </DialogContent>
    </Dialog>
  );
}
