"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useState } from "react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
export interface NoticeScreenProps { actionLabel: string; confirmation?: { confirmLabel: string; description: string; title: string; }; message: string; onAction(): Promise<void> | void; title: string; }
export function NoticeScreen({ actionLabel, confirmation, message, onAction, title }: NoticeScreenProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [runningAction, setRunningAction] = useState(false);
  const runAction = async () => { if (runningAction) return; setRunningAction(true); try { await onAction(); setShowConfirmation(false); } finally { setRunningAction(false); } };
  return (
    <>
      <main className="flex min-h-dvh items-center justify-center bg-background p-6" id="main-content">
        <Card className="w-full max-w-md text-center">
          <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{message}</CardDescription></CardHeader>
          <CardContent className="flex justify-center">
            <Button disabled={runningAction} onClick={() => (confirmation ? setShowConfirmation(true) : void runAction())}>{runningAction ? (<><Spinner data-icon="inline-start" /> Working...</>) : (actionLabel)}</Button>
          </CardContent>
        </Card>
      </main>
      {confirmation && showConfirmation ? (<ConfirmationDialog busy={runningAction} confirmLabel={confirmation.confirmLabel} description={confirmation.description} onCancel={() => setShowConfirmation(false)} onConfirm={() => void runAction()} title={confirmation.title} />) : null}
    </>
  );
}
