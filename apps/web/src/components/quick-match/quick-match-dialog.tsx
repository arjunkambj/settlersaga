"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import type { BotDifficulty } from "@settersaga/game";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LiveMessage } from "@/components/ui/live-message";
import { Spinner } from "@/components/ui/spinner";
import { QUICK_MATCH_BOT_COUNT } from "@/lib/app/quick-match";
import { BOT_DIFFICULTY_DETAILS, BOT_DIFFICULTY_OPTIONS } from "@/lib/lobby/bot-difficulty";

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
  botDifficulty: BotDifficulty;
  disabled: boolean;
  error: string;
  onBotDifficultyChange(value: BotDifficulty): void;
  onOpenChange(open: boolean): void;
  onStart(): void;
  open: boolean;
  pending: boolean;
}) {
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quick Match</DialogTitle>
          <DialogDescription>
            Start right away against {QUICK_MATCH_BOT_COUNT} bots. Pick how tough they are.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup<BotDifficulty>
          aria-label="Bot difficulty"
          className="grid grid-cols-3 gap-2 sm:gap-3"
          disabled={disabled}
          onValueChange={onBotDifficultyChange}
          value={botDifficulty}
        >
          {BOT_DIFFICULTY_OPTIONS.map((option) => (
            <Radio.Root
              className="game-choice-tile flex min-w-0 flex-col items-center gap-2 p-2 sm:p-3"
              key={option.value}
              value={option.value}
            >
              <Image
                alt=""
                className="aspect-square w-full max-w-24 object-contain"
                height={512}
                sizes="96px"
                src={option.artSrc}
                width={512}
              />
              <span className="text-base font-bold">{option.label}</span>
            </Radio.Root>
          ))}
        </RadioGroup>
        <p className="text-center text-sm font-semibold text-balance" aria-live="polite">
          {BOT_DIFFICULTY_DETAILS[botDifficulty].description}
        </p>
        <LiveMessage message={error} />
        <DialogFooter>
          <Button
            disabled={disabled}
            onClick={onStart}
            size="game-lg"
            type="button"
            variant="game-gold"
          >
            {pending ? (
              <>
                <Spinner className="size-6" data-icon="inline-start" /> Starting…
              </>
            ) : (
              "Start game"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
