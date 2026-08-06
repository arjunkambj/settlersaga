"use client";

import type { BaseGameSettings, BotDifficulty, GameMapId } from "@settersaga/game";
import { AVAILABLE_GAME_MAPS, getGameMapDefinition } from "@settersaga/game/maps";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
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

  return (
    <fieldset className="space-y-6 border-0 p-0 m-0" disabled={disabled}>
      <legend className="sr-only">Standard Game Settings</legend>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section
          aria-labelledby="${id}-rules-title"
          className="rounded-xl border bg-card/60 p-4 sm:p-5 space-y-4 shadow-xs"
        >
          <header className="space-y-1 border-b pb-3">
            <h2 id="${id}-rules-title" className="text-base font-bold text-foreground">
              Game Rules
            </h2>
            <p className="text-xs text-muted-foreground">
              Choose the win target and turn limits for play.
            </p>
          </header>

          <NumberSetting
            description="First player to reach this total wins."
            disabled={disabled}
            id="${id}-victory-points"
            label="Victory Points"
            max={13}
            min={3}
            onChange={(value) => updateSetting("victoryPoints", value)}
            value={settings.victoryPoints}
          />

          <NumberSetting
            description="Players with more cards discard half after a 7."
            disabled={disabled}
            id="${id}-discard-limit"
            label="Discard Limit"
            max={20}
            min={5}
            onChange={(value) => updateSetting("discardLimit", value)}
            value={settings.discardLimit}
          />

          <Field className="space-y-1.5">
            <FieldLabel
              htmlFor="${id}-turn-timer"
              className="text-sm font-semibold text-foreground"
            >
              Turn Timer
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
                id="${id}-turn-timer"
                className="w-full h-9 bg-background border rounded-lg px-3 text-sm flex items-center justify-between font-medium"
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
            <FieldDescription
              className="text-xs text-muted-foreground"
              id="${id}-turn-timer-description"
            >
              Timed turns display a shared turn countdown.
            </FieldDescription>
          </Field>

          <Field className="space-y-1.5">
            <FieldLabel
              htmlFor="${id}-max-players"
              className="text-sm font-semibold text-foreground"
            >
              Max Players
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
                id="${id}-max-players"
                className="w-full h-9 bg-background border rounded-lg px-3 text-sm flex items-center justify-between font-medium"
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
            <FieldDescription
              className="text-xs text-muted-foreground"
              id="${id}-max-players-description"
            >
              {selectedMap.description}
            </FieldDescription>
          </Field>
        </section>

        <section
          aria-labelledby="${id}-bots-title"
          className="rounded-xl border bg-card/60 p-4 sm:p-5 space-y-4 shadow-xs"
        >
          <header className="space-y-1 border-b pb-3">
            <h2 id="${id}-bots-title" className="text-base font-bold text-foreground">
              Bot Players
            </h2>
            <p className="text-xs text-muted-foreground">
              Reserve open seats for bots and set difficulty.
            </p>
          </header>

          <Field className="space-y-1.5">
            <FieldLabel htmlFor="${id}-bot-count" className="text-sm font-semibold text-foreground">
              Bot Seats
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
                id="${id}-bot-count"
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
            <FieldDescription
              className="text-xs text-muted-foreground"
              id="${id}-bot-count-description"
            >
              {botLimit === 0
                ? "No bot seats available."
                : botFloor === botLimit
                  ? `${botLimit} bot seat${botLimit === 1 ? "" : "s"} required.`
                  : `Choose ${botFloor}–${botLimit} bot seats.`}
            </FieldDescription>
          </Field>

          <Field className="space-y-1.5">
            <FieldLabel
              htmlFor="${id}-bot-difficulty"
              className="text-sm font-semibold text-foreground"
            >
              Bot Difficulty
            </FieldLabel>
            <Select
              disabled={disabled || botCount === 0}
              value={botDifficulty}
              onValueChange={(value) => emit(settings, botCount, value as BotDifficulty)}
            >
              <SelectTrigger
                id="${id}-bot-difficulty"
                className="w-full h-9 bg-background border rounded-lg px-3 text-sm flex items-center justify-between font-medium"
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
            <FieldDescription
              className="text-xs text-muted-foreground"
              id="${id}-bot-difficulty-description"
            >
              {selectedDifficulty.description}
            </FieldDescription>
          </Field>
        </section>

        <section
          aria-labelledby="${id}-options-title"
          className="rounded-xl border bg-card/60 p-4 sm:p-5 space-y-4 shadow-xs md:col-span-2"
        >
          <header className="space-y-1 border-b pb-3">
            <h2 id="${id}-options-title" className="text-base font-bold text-foreground">
              Table Options & Optional Rules
            </h2>
            <p className="text-xs text-muted-foreground">
              Configure map layout and special game rules.
            </p>
          </header>

          <Field className="space-y-1.5">
            <FieldLabel htmlFor="${id}-map" className="text-sm font-semibold text-foreground">
              Map Layout
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
                id="${id}-map"
                className="w-full sm:w-72 h-9 bg-background border rounded-lg px-3 text-sm flex items-center justify-between font-medium"
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
            <FieldDescription className="text-xs text-muted-foreground" id="${id}-map-description">
              {selectedMap.description}
            </FieldDescription>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <RuleToggle
              checked={settings.friendlyRobber}
              description="Robber cannot target players with <=2 VP."
              disabled={disabled}
              id="${id}-friendly-robber"
              label="Friendly Robber"
              name="friendlyRobber"
              onChange={(checked) => updateSetting("friendlyRobber", checked)}
            />
            <RuleToggle
              checked={settings.balancedDice}
              description="Reduces extreme dice roll streaks."
              disabled={disabled}
              id="${id}-balanced-dice"
              label="Balanced Dice"
              name="balancedDice"
              onChange={(checked) => updateSetting("balancedDice", checked)}
            />
            <RuleToggle
              checked={settings.hideBankCards}
              description="Hides exact card counts in bank."
              disabled={disabled}
              id="${id}-hide-bank-counts"
              label="Hide Bank Cards"
              name="hideBankCards"
              onChange={(checked) => updateSetting("hideBankCards", checked)}
            />
          </div>
        </section>
      </div>
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
    <Field className="space-y-1.5">
      <FieldLabel htmlFor={id} className="text-sm font-semibold text-foreground" id="${id}-label">
        {label}
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
      <FieldDescription className="text-xs text-muted-foreground" id="${id}-description">
        {description} Range: {min}–{max}.
      </FieldDescription>
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
    <div className="flex items-start justify-between rounded-lg border bg-card/40 p-3 gap-3 hover:bg-muted/30 transition-colors">
      <div className="space-y-0.5 min-w-0 flex-1">
        <Label htmlFor={id} className="text-xs font-semibold text-foreground cursor-pointer block">
          {label}
        </Label>
        <p className="text-[11px] leading-tight text-muted-foreground" id="${id}-description">
          {description}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        name={name}
        onCheckedChange={onChange}
        className="shrink-0 mt-0.5"
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
