"use client";

import { Button } from "@/components/ui/button";
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
  onCancel(): void;
  onConfirm(): void;
  title: string;
}

export function ConfirmationDialog({
  busy,
  confirmLabel,
  description,
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
          <div>
            <p className="eyebrow">Please Confirm</p>
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
        </AlertDialogHeader>
        <AlertDialogDescription>{description}</AlertDialogDescription>
        <AlertDialogFooter>
          <Button disabled={busy} onClick={onCancel} variant="secondary">
            Go Back
          </Button>
          <Button disabled={busy} onClick={onConfirm} variant="destructive">
            {busy ? (
              <>
                <Spinner data-icon="inline-start" /> Working…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
