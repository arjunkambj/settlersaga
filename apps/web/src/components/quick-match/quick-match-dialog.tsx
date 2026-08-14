"use client";

import type { BotDifficulty } from "@settersaga/game";
import { Icon } from "@iconify/react";
import botIcon from "@iconify-icons/solar/cpu-bolt-bold";

import { BOT_DIFFICULTY_OPTIONS } from "@/lib/lobby/bot-difficulty";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { LiveMessage } from "@/components/ui/live-message";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function QuickMatchDialog({
  botDifficulty,
  disabled,
  error,
  onBotDifficultyChange,
  onOpenChange,
  onStart,
  open,
  pending,
}: {
  readonly botDifficulty: BotDifficulty;
  readonly disabled: boolean;
  readonly error?: string;
  readonly onBotDifficultyChange: (value: BotDifficulty) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onStart: () => void;
  readonly open: boolean;
  readonly pending: boolean;
}) {
  const selectedDifficulty =
    BOT_DIFFICULTY_OPTIONS.find((option) => option.value === botDifficulty) ??
    BOT_DIFFICULTY_OPTIONS[1];

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && pending) {
          return;
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Match</DialogTitle>
          <DialogDescription>
            Pick bot difficulty. The table uses the standard 4-player island and default rules.
          </DialogDescription>
        </DialogHeader>
        <Field className="gap-2">
          <FieldLabel className="text-sm font-semibold">Bot Difficulty</FieldLabel>
          <div aria-label="Bot difficulty" className="grid grid-cols-3 gap-2" role="radiogroup">
            {BOT_DIFFICULTY_OPTIONS.map((option) => {
              const selected = option.value === botDifficulty;
              return (
                <Button
                  key={option.value}
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => onBotDifficultyChange(option.value)}
                  role="radio"
                  type="button"
                  variant={selected ? "default" : "outline"}
                  className={cn("h-10", selected && "pointer-events-none")}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {selectedDifficulty.description}
          </p>
        </Field>
        {error ? <LiveMessage message={error} /> : null}
        <DialogFooter>
          <Button disabled={disabled} onClick={onStart} type="button">
            {pending ? (
              <>
                <Spinner data-icon="inline-start" /> Starting...
              </>
            ) : (
              <>
                <Icon icon={botIcon} /> Start Quick Match
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
