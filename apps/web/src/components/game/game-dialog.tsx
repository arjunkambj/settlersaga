"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ReactNode } from "react";

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
}

export function GameDialog({
  ariaLabel,
  bodyClassName,
  children,
  footer,
  id,
  isBusy = false,
  kicker,
  onClose,
  title,
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
        className="sm:max-w-2xl max-h-[90vh] overflow-auto"
      >
        <DialogHeader>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {kicker}
          </p>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className={bodyClassName}>{children}</div>
        <div className="flex justify-end gap-2 border-t pt-4">{footer}</div>
      </DialogContent>
    </Dialog>
  );
}
