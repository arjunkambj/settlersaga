"use client";

import { Button } from "@/components/ui/button";
import { LiveMessage } from "@/components/ui/live-message";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmationDialogProps {
  busy: boolean;
  confirmLabel: string;
  description: string;
  /** Why the confirmed action failed, shown above the buttons so the player can retry or back out. */
  error?: string;
  onCancel(): void;
  onConfirm(): void;
  title: string;
}

export function ConfirmationDialog({
  busy,
  confirmLabel,
  description,
  error = "",
  onCancel,
  onConfirm,
  title,
}: ConfirmationDialogProps) {
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <LiveMessage message={error} />
        <AlertDialogFooter>
          <Button disabled={busy} onClick={onCancel} size="game-md" variant="game-secondary">
            Go back
          </Button>
          <Button disabled={busy} onClick={onConfirm} size="game-md" variant="game-danger">
            {busy ? <Spinner data-icon="inline-start" /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
