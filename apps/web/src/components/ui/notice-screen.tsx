"use client";

import { useState } from "react";

import { MenuScreen, MenuScreenText } from "@/components/app/menu-screen";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { LiveMessage } from "@/components/ui/live-message";
import { Spinner } from "@/components/ui/spinner";
import { toActionableError } from "@/lib/app/action-errors";

export interface NoticeScreenProps {
  actionLabel: string;
  /** Asks before running the action; its failure is then shown inside the confirmation. */
  confirmation?: { confirmLabel: string; description: string; title: string };
  message: string;
  /** May reject; the screen then explains the failure and lets the player try again. */
  onAction(): Promise<void> | void;
  title: string;
}

export function NoticeScreen({
  actionLabel,
  confirmation,
  message,
  onAction,
  title,
}: NoticeScreenProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [runningAction, setRunningAction] = useState(false);
  const [error, setError] = useState("");

  const runAction = async () => {
    if (runningAction) return;
    setError("");
    setRunningAction(true);
    try {
      await onAction();
      setShowConfirmation(false);
    } catch (cause) {
      setError(toActionableError(cause));
    } finally {
      setRunningAction(false);
    }
  };

  const openConfirmation = () => {
    setError("");
    setShowConfirmation(true);
  };

  return (
    <>
      <MenuScreen
        actions={
          <Button
            disabled={runningAction}
            onClick={() => (confirmation ? openConfirmation() : void runAction())}
            size="game-md"
            variant={confirmation ? "game-danger" : "game-gold"}
          >
            {runningAction && !confirmation ? <Spinner data-icon="inline-start" /> : null}
            {actionLabel}
          </Button>
        }
        title={title}
      >
        <MenuScreenText>{message}</MenuScreenText>
        <LiveMessage className="w-full" message={showConfirmation ? "" : error} />
      </MenuScreen>
      {confirmation && showConfirmation ? (
        <ConfirmationDialog
          busy={runningAction}
          confirmLabel={confirmation.confirmLabel}
          description={confirmation.description}
          error={error}
          onCancel={() => setShowConfirmation(false)}
          onConfirm={() => void runAction()}
          title={confirmation.title}
        />
      ) : null}
    </>
  );
}
