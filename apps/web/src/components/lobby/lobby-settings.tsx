"use client";

import { useId } from "react";
import type { BaseGameSettings, BotDifficulty, GameMapId } from "@settersaga/game";
import { AVAILABLE_GAME_MAPS, getGameMapDefinition } from "@settersaga/game/maps";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import {
  getBotCapacity,
  getCompatiblePlayerCount,
  getMinimumPlayerCount,
  toBotCount,
  type BotCount,
} from "@/lib/lobby/lobby-settings-model";

export type { BotCount } from "@/lib/lobby/lobby-settings-model";

function InfoTooltip({ content }: { readonly content: string }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger
        aria-label={content}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        delay={200}
        type="button"
      >
        <HugeiconsIcon icon={InformationCircleIcon} className="size-3.5" strokeWidth={1.8} />
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner align="center" side="top" sideOffset={8}>
          <TooltipPrimitive.Popup className="z-50 max-w-[260px] rounded-xl border bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-md outline-none">
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

const TURN_TIMER_OPTIONS = [0, 30, 60, 90, 120] as const;
const BOT_DIFFICULTY_OPTIONS = [
  {
    description: "Builds legal moves quickly without planning far ahead.",
    label: "Easy",
    value: "easy",
  },
  {
    description: "Balances production, expansion, and bank trades.",
    label: "Medium",
    value: "medium",
  },
  {
    description: "Prioritizes stronger placements and longer-term upgrades.",
    label: "Hard",
    value: "hard",
  },
] as const satisfies ReadonlyArray<{
  description: string;
  label: string;
  value: BotDifficulty;
}>;

export interface LobbySettingsValue {
  readonly botCount: BotCount;
  readonly botDifficulty: BotDifficulty;
  readonly settings: Readonly<BaseGameSettings>;
}

export interface LobbySettingsProps {
  readonly botCount: BotCount;
  readonly botDifficulty: BotDifficulty;
  readonly disabled: boolean;
  readonly humanCount: number;
  readonly minBotCount?: BotCount;
  readonly onChange: (value: LobbySettingsValue) => void;
  readonly settings: Readonly<BaseGameSettings>;
}

export function LobbySettings({
  botCount,
  botDifficulty,
  disabled,
  humanCount,
  minBotCount = 0,
  onChange,
  settings,
}: LobbySettingsProps) {
  const botLimit = getBotCapacity(settings.maxPlayers, humanCount);
  const botFloor = toBotCount(Math.min(minBotCount, botLimit));
  const selectedMap = getGameMapDefinition(settings.map);
  const minPlayerCount = getMinimumPlayerCount(settings.map, humanCount);
  const selectedDifficulty =
    BOT_DIFFICULTY_OPTIONS.find((option) => option.value === botDifficulty) ??
    BOT_DIFFICULTY_OPTIONS[0];

  const emit = (
    nextSettings: Readonly<BaseGameSettings>,
    nextBotCount: BotCount = botCount,
    nextBotDifficulty: BotDifficulty = botDifficulty,
  ) => {
    onChange({
      botCount: nextBotCount,
      botDifficulty: nextBotDifficulty,
      settings: { ...nextSettings },
    });
  };

  const updateSetting = <Key extends keyof BaseGameSettings>(
    key: Key,
    value: BaseGameSettings[Key],
  ) => {
    emit({ ...settings, [key]: value });
  };

  const id = useId();

  return (
    <fieldset className="space-y-4 border-0 p-0 m-0" disabled={disabled}>
      <legend className="sr-only">Standard Game Settings</legend>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 md:divide-x md:divide-border">
        <section className="space-y-3">
          <NumberSetting
            description="First player to reach this total wins."
            disabled={disabled}
            id={`${id}-victory-points`}
            label="Victory Points"
            max={13}
            min={3}
            onChange={(value) => updateSetting("victoryPoints", value)}
            value={settings.victoryPoints}
          />

          <NumberSetting
            description="Players with more cards discard half after a 7."
            disabled={disabled}
            id={`${id}-discard-limit`}
            label="Discard Limit"
            max={20}
            min={5}
            onChange={(value) => updateSetting("discardLimit", value)}
            value={settings.discardLimit}
          />

          <Field className="space-y-1">
            <FieldLabel
              htmlFor={`${id}-bot-count`}
              className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
            >
              Bot Seats
              <InfoTooltip
                content={
                  botLimit === 0
                    ? "No bot seats available."
                    : botFloor === botLimit
                      ? `${botLimit} bot seat${botLimit === 1 ? "" : "s"} required.`
                      : `Choose ${botFloor}–${botLimit} bot seats.`
                }
              />
            </FieldLabel>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                aria-label="Remove one bot seat"
                className="h-8 w-8 rounded-lg font-bold shrink-0"
                disabled={disabled || botCount <= botFloor}
                onClick={() => emit(settings, toBotCount(botCount - 1))}
                size="icon-sm"
                variant="outline"
              >
                −
              </Button>
              <Input
                id={`${id}-bot-count`}
                className="h-8 w-14 text-center font-mono font-bold text-sm bg-muted/30 border rounded-lg px-0 shrink-0"
                disabled={disabled}
                readOnly
                value={String(botCount)}
              />
              <Button
                type="button"
                aria-label="Add one bot seat"
                className="h-8 w-8 rounded-lg font-bold shrink-0"
                disabled={disabled || botCount >= botLimit}
                onClick={() => emit(settings, toBotCount(botCount + 1))}
                size="icon-sm"
                variant="outline"
              >
                +
              </Button>
            </div>
          </Field>
        </section>

        <section className="space-y-3 md:pl-6">
          <Field className="space-y-1">
            <FieldLabel
              htmlFor={`${id}-turn-timer`}
              className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
            >
              Turn Timer
              <InfoTooltip content="Timed turns display a shared turn countdown." />
            </FieldLabel>
            <Select
              disabled={disabled}
              value={String(settings.turnTimerSeconds)}
              onValueChange={(value) =>
                updateSetting(
                  "turnTimerSeconds",
                  Number(value) as BaseGameSettings["turnTimerSeconds"],
                )
              }
            >
              <SelectTrigger
                id={`${id}-turn-timer`}
                className="w-full h-8 bg-background border rounded-lg px-3 text-sm flex items-center justify-between font-medium"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TURN_TIMER_OPTIONS.map((seconds) => (
                  <SelectItem key={seconds} value={String(seconds)}>
                    {seconds === 0 ? "Off (Untimed)" : `${seconds} seconds`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field className="space-y-1">
            <FieldLabel
              htmlFor={`${id}-max-players`}
              className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
            >
              Max Players
              <InfoTooltip content={selectedMap.description} />
            </FieldLabel>
            <Select
              disabled={disabled}
              value={String(settings.maxPlayers)}
              onValueChange={(value) => {
                const maxPlayers = Number(value) as BaseGameSettings["maxPlayers"];
                const nextBotLimit = getBotCapacity(maxPlayers, humanCount);
                const nextBotFloor = toBotCount(Math.min(minBotCount, nextBotLimit));
                emit(
                  { ...settings, maxPlayers },
                  toBotCount(Math.max(nextBotFloor, Math.min(botCount, nextBotLimit))),
                );
              }}
            >
              <SelectTrigger
                id={`${id}-max-players`}
                className="w-full h-8 bg-background border rounded-lg px-3 text-sm flex items-center justify-between font-medium"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectedMap.playerCounts.map((playerCount) => (
                  <SelectItem
                    key={playerCount}
                    value={String(playerCount)}
                    disabled={playerCount < minPlayerCount}
                  >
                    {playerCount} players
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field className="space-y-1">
            <FieldLabel
              htmlFor={`${id}-bot-difficulty`}
              className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
            >
              Bot Difficulty
              <InfoTooltip content={selectedDifficulty.description} />
            </FieldLabel>
            <Select
              disabled={disabled || botCount === 0}
              value={botDifficulty}
              onValueChange={(value) => emit(settings, botCount, value as BotDifficulty)}
            >
              <SelectTrigger
                id={`${id}-bot-difficulty`}
                className="w-full h-8 bg-background border rounded-lg px-3 text-sm flex items-center justify-between font-medium"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOT_DIFFICULTY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field className="space-y-1">
            <FieldLabel
              htmlFor={`${id}-map`}
              className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
            >
              Map Layout
              <InfoTooltip content={selectedMap.description} />
            </FieldLabel>
            <Select
              disabled={disabled}
              value={settings.map}
              onValueChange={(value) => {
                const map = value as GameMapId;
                const maxPlayers = getCompatiblePlayerCount(map, humanCount, settings.maxPlayers);
                if (maxPlayers === null) {
                  return;
                }
                const nextBotLimit = getBotCapacity(maxPlayers, humanCount);
                const nextBotFloor = toBotCount(Math.min(minBotCount, nextBotLimit));
                emit(
                  { ...settings, map, maxPlayers },
                  toBotCount(Math.max(nextBotFloor, Math.min(botCount, nextBotLimit))),
                );
              }}
            >
              <SelectTrigger
                id={`${id}-map`}
                className="w-full h-8 bg-background border rounded-lg px-3 text-sm flex items-center justify-between font-medium"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_GAME_MAPS.map((map) => (
                  <SelectItem
                    key={map.id}
                    value={map.id}
                    disabled={
                      getCompatiblePlayerCount(map.id, humanCount, settings.maxPlayers) === null
                    }
                  >
                    {map.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </section>
      </div>

      <section className="border-t pt-4">
        <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-y-0 sm:gap-5">
          <RuleToggle
            checked={settings.friendlyRobber}
            description="Robber cannot target players with <=2 VP."
            disabled={disabled}
            id={`${id}-friendly-robber`}
            label="Friendly Robber"
            name="friendlyRobber"
            onChange={(checked) => updateSetting("friendlyRobber", checked)}
          />
          <RuleToggle
            checked={settings.balancedDice}
            description="Reduces extreme dice roll streaks."
            disabled={disabled}
            id={`${id}-balanced-dice`}
            label="Balanced Dice"
            name="balancedDice"
            onChange={(checked) => updateSetting("balancedDice", checked)}
          />
          <RuleToggle
            checked={settings.hideBankCards}
            description="Hides exact card counts in bank."
            disabled={disabled}
            id={`${id}-hide-bank-counts`}
            label="Hide Bank Cards"
            name="hideBankCards"
            onChange={(checked) => updateSetting("hideBankCards", checked)}
          />
        </div>
      </section>
    </fieldset>
  );
}

function NumberSetting({
  description,
  disabled,
  id,
  label,
  max,
  min,
  onChange,
  value,
}: {
  readonly description: string;
  readonly disabled: boolean;
  readonly id: string;
  readonly label: string;
  readonly max: number;
  readonly min: number;
  readonly onChange: (value: number) => void;
  readonly value: number;
}) {
  const decrement = () => onChange(clampInteger(value - 1, min, max));
  const increment = () => onChange(clampInteger(value + 1, min, max));
  return (
    <Field className="space-y-1">
      <FieldLabel
        htmlFor={id}
        className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
      >
        {label}
        <InfoTooltip content={`${description} Range: ${min}–${max}.`} />
      </FieldLabel>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          className="h-8 w-8 rounded-lg font-bold shrink-0"
          disabled={disabled || value <= min}
          onClick={decrement}
          size="icon-sm"
          variant="outline"
        >
          −
        </Button>
        <Input
          className="h-8 w-14 text-center font-mono font-bold text-sm bg-muted/30 border rounded-lg px-0 shrink-0"
          id={id}
          readOnly
          disabled={disabled}
          value={String(value)}
        />
        <Button
          type="button"
          aria-label={`Increase ${label.toLowerCase()}`}
          className="h-8 w-8 rounded-lg font-bold shrink-0"
          disabled={disabled || value >= max}
          onClick={increment}
          size="icon-sm"
          variant="outline"
        >
          +
        </Button>
      </div>
    </Field>
  );
}

function RuleToggle({
  checked,
  description,
  disabled,
  id,
  label,
  name,
  onChange,
}: {
  readonly checked: boolean;
  readonly description: string;
  readonly disabled: boolean;
  readonly id: string;
  readonly label: string;
  readonly name: string;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 sm:py-1">
      <div className="space-y-0.5 min-w-0 flex-1">
        <Label
          htmlFor={id}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground cursor-pointer"
        >
          {label}
          <InfoTooltip content={description} />
        </Label>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        name={name}
        onCheckedChange={onChange}
        className="shrink-0"
      />
    </div>
  );
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}
