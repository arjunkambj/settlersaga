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
      <AlertDialogContent className="confirmation-dialog-card">
        <AlertDialogHeader className="confirmation-dialog-header">
          <div>
            <p className="eyebrow">Please Confirm</p>
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
        </AlertDialogHeader>
        <AlertDialogDescription className="confirmation-dialog-body">
          {description}
        </AlertDialogDescription>
        <AlertDialogFooter className="confirmation-dialog-footer">
          <Button
            className="button-secondary"
            disabled={busy}
            onClick={onCancel}
            variant="secondary"
          >
            Go Back
          </Button>
          <Button
            className="button-danger"
            disabled={busy}
            onClick={onConfirm}
            variant="destructive"
          >
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
