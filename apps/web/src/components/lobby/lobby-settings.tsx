"use client";

import type { BaseGameSettings, BotDifficulty, GameMapId } from "@settersaga/game";
import { AVAILABLE_GAME_MAPS, getGameMapDefinition } from "@settersaga/game/maps";
import { Description, Label, ListBox, NumberField, Select, Switch } from "@heroui/react";
import { useId } from "react";
import type { CSSProperties } from "react";

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
            name="victoryPoints"
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
            name="discardLimit"
            onChange={(value) => updateSetting("discardLimit", value)}
            value={settings.discardLimit}
          />

          <Select
            className="lobby-settings-control"
            isDisabled={disabled}
            onChange={(value) =>
              updateSetting(
                "turnTimerSeconds",
                Number(value) as BaseGameSettings["turnTimerSeconds"],
              )
            }
            value={String(settings.turnTimerSeconds)}
          >
            <Label className="lobby-settings-label">Turn Timer</Label>
            <Select.Trigger
              aria-describedby={`${id}-turn-timer-description`}
              className="lobby-settings-select"
              id={`${id}-turn-timer`}
            >
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Description className="lobby-settings-description" id={`${id}-turn-timer-description`}>
              Off keeps turns untimed. Timed turns show a shared countdown.
            </Description>
            <Select.Popover className="lobby-settings-popover">
              <ListBox>
                {TURN_TIMER_OPTIONS.map((seconds) => (
                  <ListBox.Item id={String(seconds)} key={seconds} textValue={String(seconds)}>
                    {seconds === 0 ? "Off" : `${seconds} seconds`}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <Select
            className="lobby-settings-control"
            isDisabled={disabled}
            onChange={(value) => {
              const maxPlayers = Number(value) as BaseGameSettings["maxPlayers"];
              const nextBotLimit = getBotCapacity(maxPlayers, humanCount);
              const nextBotFloor = toBotCount(Math.min(minBotCount, nextBotLimit));
              emit(
                { ...settings, maxPlayers },
                toBotCount(Math.max(nextBotFloor, Math.min(botCount, nextBotLimit))),
              );
            }}
            value={String(settings.maxPlayers)}
          >
            <Label className="lobby-settings-label">Max Players</Label>
            <Select.Trigger
              aria-describedby={`${id}-max-players-description`}
              className="lobby-settings-select"
              id={`${id}-max-players`}
            >
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Description
              className="lobby-settings-description"
              id={`${id}-max-players-description`}
            >
              {selectedMap.description}
            </Description>
            <Select.Popover className="lobby-settings-popover">
              <ListBox>
                {selectedMap.playerCounts.map((playerCount) => (
                  <ListBox.Item
                    id={String(playerCount)}
                    isDisabled={playerCount < minPlayerCount}
                    key={playerCount}
                    textValue={`${playerCount} players`}
                  >
                    {playerCount} players
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </section>

        <section aria-labelledby={`${id}-bots-title`} className="lobby-settings-group">
          <header className="lobby-settings-group-header">
            <h2 id={`${id}-bots-title`}>Bot Players</h2>
            <p>Reserve open seats for bots and set one shared difficulty.</p>
          </header>

          <NumberField
            aria-describedby={`${id}-bot-count-description`}
            className="lobby-settings-control"
            isDisabled={disabled}
            maxValue={botLimit}
            minValue={botFloor}
            name="botCount"
            onChange={(value) => emit(settings, toBotCount(value))}
            value={botCount}
          >
            <Label className="lobby-settings-label">Bot Seats</Label>
            <NumberField.Group className="lobby-settings-stepper">
              <NumberField.DecrementButton
                aria-label="Remove one bot seat"
                className="lobby-settings-step-button"
              >
                −
              </NumberField.DecrementButton>
              <NumberField.Input className="lobby-settings-step-value" />
              <NumberField.IncrementButton
                aria-label="Add one bot seat"
                className="lobby-settings-step-button"
              >
                +
              </NumberField.IncrementButton>
            </NumberField.Group>
            <Description className="lobby-settings-description" id={`${id}-bot-count-description`}>
              {botLimit === 0
                ? "No bot seats are available for this table."
                : botFloor === botLimit
                  ? `${botLimit} bot ${botLimit === 1 ? "seat is" : "seats are"} required for this table.`
                  : `Choose ${botFloor}–${botLimit} bot seats for this table.`}
            </Description>
          </NumberField>

          <Select
            className="lobby-settings-control"
            isDisabled={disabled || botCount === 0}
            onChange={(value) => emit(settings, botCount, value as BotDifficulty)}
            value={botDifficulty}
          >
            <Label className="lobby-settings-label">Bot Difficulty</Label>
            <Select.Trigger
              aria-describedby={`${id}-bot-difficulty-description`}
              className="lobby-settings-select"
              id={`${id}-bot-difficulty`}
            >
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Description
              className="lobby-settings-description"
              id={`${id}-bot-difficulty-description`}
            >
              {selectedDifficulty.description}
            </Description>
            <Select.Popover className="lobby-settings-popover">
              <ListBox>
                {BOT_DIFFICULTY_OPTIONS.map((option) => (
                  <ListBox.Item id={option.value} key={option.value} textValue={option.label}>
                    {option.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </section>

        <section aria-labelledby={`${id}-options-title`} className="lobby-settings-group">
          <header className="lobby-settings-group-header">
            <h2 id={`${id}-options-title`}>Table Options</h2>
            <p>Apply the same optional rules to every player.</p>
          </header>

          <Select
            className="lobby-settings-control"
            isDisabled={disabled}
            onChange={(value) => {
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
            value={settings.map}
          >
            <Label className="lobby-settings-label">Map Size</Label>
            <Select.Trigger
              aria-describedby={`${id}-map-description`}
              className="lobby-settings-select"
              id={`${id}-map`}
            >
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Description className="lobby-settings-description" id={`${id}-map-description`}>
              {selectedMap.description}
            </Description>
            <Select.Popover className="lobby-settings-popover">
              <ListBox>
                {AVAILABLE_GAME_MAPS.map((map) => (
                  <ListBox.Item
                    id={map.id}
                    isDisabled={
                      getCompatiblePlayerCount(map.id, humanCount, settings.maxPlayers) === null
                    }
                    key={map.id}
                    textValue={map.label}
                  >
                    {map.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

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
  name,
  onChange,
  value,
}: {
  readonly description: string;
  readonly disabled: boolean;
  readonly id: string;
  readonly label: string;
  readonly max: number;
  readonly min: number;
  readonly name: string;
  readonly onChange: (value: number) => void;
  readonly value: number;
}) {
  return (
    <NumberField
      aria-describedby={`${id}-description`}
      className="lobby-settings-control"
      isDisabled={disabled}
      maxValue={max}
      minValue={min}
      name={name}
      onChange={(nextValue) => onChange(clampInteger(nextValue, min, max))}
      value={value}
    >
      <Label className="lobby-settings-label" id={`${id}-label`}>
        {label}
      </Label>
      <NumberField.Group className="lobby-settings-stepper">
        <NumberField.DecrementButton
          aria-label={`Decrease ${label.toLowerCase()}`}
          className="lobby-settings-step-button"
        >
          −
        </NumberField.DecrementButton>
        <NumberField.Input className="lobby-settings-step-value" id={id} />
        <NumberField.IncrementButton
          aria-label={`Increase ${label.toLowerCase()}`}
          className="lobby-settings-step-button"
        >
          +
        </NumberField.IncrementButton>
      </NumberField.Group>
      <Description className="lobby-settings-description" id={`${id}-description`}>
        {description} Choose {min}–{max}.
      </Description>
    </NumberField>
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
    <Switch
      className="lobby-settings-toggle"
      id={id}
      isDisabled={disabled}
      isSelected={checked}
      name={name}
      onChange={onChange}
    >
      <Switch.Content className="lobby-settings-toggle-content">
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <strong>{label}</strong>
      </Switch.Content>
      <Description className="lobby-settings-description" id={`${id}-description`}>
        {description}
      </Description>
    </Switch>
  );
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}
