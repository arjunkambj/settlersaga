"use client";

import type { BaseGameSettings, BotDifficulty, GameMapId } from "@settersaga/game";
import { AVAILABLE_GAME_MAPS, getGameMapDefinition } from "@settersaga/game/maps";
import { useId } from "react";
import type { CSSProperties } from "react";

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

const LIGHT_PANEL_STYLE = { colorScheme: "light" } satisfies CSSProperties;
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
  const id = useId();
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
    <fieldset
      aria-describedby={`${id}-description`}
      className="lobby-settings-panel"
      disabled={disabled}
      style={LIGHT_PANEL_STYLE}
    >
      <legend className="lobby-settings-title">Standard Game Settings</legend>
      <p className="lobby-settings-intro" id={`${id}-description`}>
        Configure the standard base game rules, seats, and table options.
      </p>

      <div className="lobby-settings-grid">
        <section aria-labelledby={`${id}-rules-title`} className="lobby-settings-group">
          <header className="lobby-settings-group-header">
            <h2 id={`${id}-rules-title`}>Game Rules</h2>
            <p>Choose the win target and the limits used during play.</p>
          </header>

          <NumberSetting
            description="The first player to reach this total wins."
            disabled={disabled}
            id={`${id}-victory-points`}
            label="Victory Points"
            max={13}
            min={3}
            onChange={(value) => updateSetting("victoryPoints", value)}
            value={settings.victoryPoints}
          />

          <NumberSetting
            description="Players above this many resource cards discard half after a 7."
            disabled={disabled}
            id={`${id}-discard-limit`}
            label="Discard Limit"
            max={20}
            min={5}
            onChange={(value) => updateSetting("discardLimit", value)}
            value={settings.discardLimit}
          />

          <Field className="lobby-settings-control">
            <FieldLabel htmlFor={`${id}-turn-timer`} className="lobby-settings-label">
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
              <SelectTrigger id={`${id}-turn-timer`} className="lobby-settings-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="lobby-settings-popover">
                {TURN_TIMER_OPTIONS.map((seconds) => (
                  <SelectItem key={seconds} value={String(seconds)}>
                    {seconds === 0 ? "Off" : `${seconds} seconds`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription
              className="lobby-settings-description"
              id={`${id}-turn-timer-description`}
            >
              Off keeps turns untimed. Timed turns show a shared countdown.
            </FieldDescription>
          </Field>

          <Field className="lobby-settings-control">
            <FieldLabel htmlFor={`${id}-max-players`} className="lobby-settings-label">
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
              <SelectTrigger id={`${id}-max-players`} className="lobby-settings-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="lobby-settings-popover">
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
              className="lobby-settings-description"
              id={`${id}-max-players-description`}
            >
              {selectedMap.description}
            </FieldDescription>
          </Field>
        </section>

        <section aria-labelledby={`${id}-bots-title`} className="lobby-settings-group">
          <header className="lobby-settings-group-header">
            <h2 id={`${id}-bots-title`}>Bot Players</h2>
            <p>Reserve open seats for bots and set one shared difficulty.</p>
          </header>

          <Field className="lobby-settings-control">
            <FieldLabel htmlFor={`${id}-bot-count`} className="lobby-settings-label">
              Bot Seats
            </FieldLabel>
            <div className="lobby-settings-stepper">
              <Button
                type="button"
                aria-label="Remove one bot seat"
                className="lobby-settings-step-button"
                disabled={disabled || botCount <= botFloor}
                onClick={() => emit(settings, toBotCount(botCount - 1))}
                size="icon-sm"
                variant="outline"
              >
                −
              </Button>
              <Input
                id={`${id}-bot-count`}
                className="lobby-settings-step-value"
                disabled={disabled}
                readOnly
                value={String(botCount)}
              />
              <Button
                type="button"
                aria-label="Add one bot seat"
                className="lobby-settings-step-button"
                disabled={disabled || botCount >= botLimit}
                onClick={() => emit(settings, toBotCount(botCount + 1))}
                size="icon-sm"
                variant="outline"
              >
                +
              </Button>
            </div>
            <FieldDescription
              className="lobby-settings-description"
              id={`${id}-bot-count-description`}
            >
              {botLimit === 0
                ? "No bot seats are available for this table."
                : botFloor === botLimit
                  ? `${botLimit} bot ${botLimit === 1 ? "seat is" : "seats are"} required for this table.`
                  : `Choose ${botFloor}–${botLimit} bot seats for this table.`}
            </FieldDescription>
          </Field>

          <Field className="lobby-settings-control">
            <FieldLabel htmlFor={`${id}-bot-difficulty`} className="lobby-settings-label">
              Bot Difficulty
            </FieldLabel>
            <Select
              disabled={disabled || botCount === 0}
              value={botDifficulty}
              onValueChange={(value) => emit(settings, botCount, value as BotDifficulty)}
            >
              <SelectTrigger id={`${id}-bot-difficulty`} className="lobby-settings-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="lobby-settings-popover">
                {BOT_DIFFICULTY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription
              className="lobby-settings-description"
              id={`${id}-bot-difficulty-description`}
            >
              {selectedDifficulty.description}
            </FieldDescription>
          </Field>
        </section>

        <section aria-labelledby={`${id}-options-title`} className="lobby-settings-group">
          <header className="lobby-settings-group-header">
            <h2 id={`${id}-options-title`}>Table Options</h2>
            <p>Apply the same optional rules to every player.</p>
          </header>

          <Field className="lobby-settings-control">
            <FieldLabel htmlFor={`${id}-map`} className="lobby-settings-label">
              Map Size
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
              <SelectTrigger id={`${id}-map`} className="lobby-settings-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="lobby-settings-popover">
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
            <FieldDescription className="lobby-settings-description" id={`${id}-map-description`}>
              {selectedMap.description}
            </FieldDescription>
          </Field>

          <RuleToggle
            checked={settings.friendlyRobber}
            description="The robber cannot target a player with 2 or fewer victory points."
            disabled={disabled}
            id={`${id}-friendly-robber`}
            label="Friendly Robber"
            name="friendlyRobber"
            onChange={(checked) => updateSetting("friendlyRobber", checked)}
          />
          <RuleToggle
            checked={settings.balancedDice}
            description="Reduces short streaks while keeping rolls deterministic and fair."
            disabled={disabled}
            id={`${id}-balanced-dice`}
            label="Balanced Dice"
            name="balancedDice"
            onChange={(checked) => updateSetting("balancedDice", checked)}
          />
          <RuleToggle
            checked={settings.hideBankCards}
            description="Players see each resource type without its exact remaining bank count."
            disabled={disabled}
            id={`${id}-hide-bank-counts`}
            label="Hide Bank Counts"
            name="hideBankCards"
            onChange={(checked) => updateSetting("hideBankCards", checked)}
          />
          <div className="lobby-settings-static">
            <span className="lobby-settings-label">Table Access</span>
            <strong>Invite code only</strong>
            <small>Private rooms and bot games never enter public matchmaking.</small>
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
    <Field className="lobby-settings-control">
      <FieldLabel htmlFor={id} className="lobby-settings-label" id={`${id}-label`}>
        {label}
      </FieldLabel>
      <div className="lobby-settings-stepper">
        <Button
          type="button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          className="lobby-settings-step-button"
          disabled={disabled || value <= min}
          onClick={decrement}
          size="icon-sm"
          variant="outline"
        >
          −
        </Button>
        <Input
          className="lobby-settings-step-value"
          id={id}
          readOnly
          disabled={disabled}
          value={String(value)}
        />
        <Button
          type="button"
          aria-label={`Increase ${label.toLowerCase()}`}
          className="lobby-settings-step-button"
          disabled={disabled || value >= max}
          onClick={increment}
          size="icon-sm"
          variant="outline"
        >
          +
        </Button>
      </div>
      <FieldDescription className="lobby-settings-description" id={`${id}-description`}>
        {description} Choose {min}–{max}.
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
    <Field className="lobby-settings-toggle">
      <div className="lobby-settings-toggle-content flex items-center gap-3">
        <Switch
          id={id}
          checked={checked}
          disabled={disabled}
          name={name}
          onCheckedChange={onChange}
        />
        <Label htmlFor={id} className="font-medium">
          {label}
        </Label>
      </div>
      <FieldDescription className="lobby-settings-description" id={`${id}-description`}>
        {description}
      </FieldDescription>
    </Field>
  );
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}
