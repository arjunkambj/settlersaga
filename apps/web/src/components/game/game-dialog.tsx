"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface GameDialogProps {
  ariaLabel: string;
  bodyClassName?: string;
  children: ReactNode;
  dialogClassName?: string;
  footer: ReactNode;
  footerClassName?: string;
  id?: string;
  isBusy?: boolean;
  kicker: string;
  onClose(): void;
  title: string;
  toolbar?: ReactNode;
}

export function GameDialog({
  ariaLabel,
  bodyClassName,
  children,
  dialogClassName,
  footer,
  footerClassName,
  id,
  isBusy = false,
  kicker,
  onClose,
  title,
  toolbar,
}: GameDialogProps) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isBusy) onClose();
      }}
    >
      <DialogContent
        aria-label={ariaLabel}
        id={id}
        className={cn("flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl", dialogClassName)}
      >
        <DialogHeader className="shrink-0">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            {kicker}
          </p>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {toolbar ? <div className="shrink-0">{toolbar}</div> : null}
        <div className={cn("min-h-0 flex-1 overflow-y-auto", bodyClassName)}>{children}</div>
        <div className={cn("flex shrink-0 justify-end gap-2 pt-2", footerClassName)}>{footer}</div>
      </DialogContent>
    </Dialog>
  );
}
