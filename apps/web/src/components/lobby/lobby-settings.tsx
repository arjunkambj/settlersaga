"use client";

import { useId, type ReactNode } from "react";
import type { BaseGameSettings, BotDifficulty, GameMapId } from "@settersaga/game";
import { AVAILABLE_GAME_MAPS, getGameMapDefinition } from "@settersaga/game/maps";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import infoIcon from "@iconify-icons/solar/info-circle-bold";
import { Icon } from "@iconify/react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

import { BOT_DIFFICULTY_OPTIONS } from "@/lib/lobby/bot-difficulty";
import {
  getBotCapacity,
  getCompatiblePlayerCount,
  getMinimumPlayerCount,
  tableSizeForPlayerCount,
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
        <Icon icon={infoIcon} className="size-3.5" />
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner align="center" side="top" sideOffset={8}>
          <TooltipPrimitive.Popup className="z-50 max-w-[260px] rounded-xl bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-md outline-none">
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

const PLAYER_COUNT_OPTIONS = [4, 5, 6, 7, 8] as const;

const TURN_TIMER_OPTIONS = [0, 30, 60, 90, 120] as const;
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
  readonly variant?: "setup" | "rules";
}

export function LobbySettings({
  botCount,
  botDifficulty,
  disabled,
  humanCount,
  minBotCount = 0,
  onChange,
  settings,
  variant = "setup",
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

  const applyMap = (map: GameMapId) => {
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
  };

  const id = useId();

  if (variant === "rules") {
    return (
      <fieldset className="m-0 flex min-h-0 flex-1 flex-col border-0 p-0" disabled={disabled}>
        <legend className="sr-only">House rules</legend>
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-3">
          <SettingsCategory title="Game rules">
            <SettingPanel>
              <SliderSetting
                disabled={disabled}
                id={`${id}-victory-points`}
                label="Points to Win"
                max={13}
                min={3}
                onChange={(value) => updateSetting("victoryPoints", value)}
                value={settings.victoryPoints}
              />
            </SettingPanel>
            <SettingPanel>
              <SliderSetting
                disabled={disabled}
                id={`${id}-discard-limit`}
                label="Card Discard Limit"
                max={20}
                min={5}
                onChange={(value) => updateSetting("discardLimit", value)}
                value={settings.discardLimit}
              />
            </SettingPanel>
            <SettingPanel>
              <TurnTimerField
                disabled={disabled}
                id={`${id}-turn-timer`}
                onChange={(value) => updateSetting("turnTimerSeconds", value)}
                value={settings.turnTimerSeconds}
              />
            </SettingPanel>
          </SettingsCategory>

          <SettingsCategory title="Bots">
            <SettingPanel>
              <BotDifficultyField
                disabled={disabled || botCount === 0}
                id={`${id}-bot-difficulty`}
                onChange={(value) => emit(settings, botCount, value)}
                tooltip={selectedDifficulty.description}
                value={botDifficulty}
              />
            </SettingPanel>
          </SettingsCategory>

          <SettingsCategory title="Table">
            <SettingPanel>
              <Field className="gap-1">
                <FieldLabel
                  htmlFor={`${id}-players`}
                  className="flex items-center gap-1.5 text-sm font-semibold"
                >
                  Players
                  <InfoTooltip content="How many seats the table has. 4 uses the standard island, 5–6 the wide island, and 7–8 the grand island." />
                </FieldLabel>
                <Select
                  disabled={disabled}
                  value={String(Math.max(settings.maxPlayers, 4))}
                  onValueChange={(value) => {
                    const nextSize = tableSizeForPlayerCount(Number(value));
                    if (!nextSize || nextSize.maxPlayers < humanCount) return;
                    const nextBotLimit = getBotCapacity(nextSize.maxPlayers, humanCount);
                    emit(
                      { ...settings, map: nextSize.map, maxPlayers: nextSize.maxPlayers },
                      toBotCount(Math.min(botCount, nextBotLimit)),
                    );
                  }}
                >
                  <SelectTrigger
                    id={`${id}-players`}
                    className="flex h-8 w-full items-center justify-between px-3 text-sm font-medium"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {PLAYER_COUNT_OPTIONS.map((playerCount) => (
                        <SelectItem
                          key={playerCount}
                          value={String(playerCount)}
                          disabled={playerCount < humanCount}
                        >
                          {playerCount} players
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </SettingPanel>
            <RuleToggle
              checked={settings.friendlyRobber}
              description="Robber cannot target a player with 2 VP or fewer."
              disabled={disabled}
              id={`${id}-friendly-robber`}
              label="Friendly Robber"
              name="friendlyRobber"
              onChange={(checked) => updateSetting("friendlyRobber", checked)}
              variant="card"
            />
            <RuleToggle
              checked={settings.balancedDice}
              description="Reduces short streaks while keeping rolls fair."
              disabled={disabled}
              id={`${id}-balanced-dice`}
              label="Balanced Dice"
              name="balancedDice"
              onChange={(checked) => updateSetting("balancedDice", checked)}
              variant="card"
            />
            <RuleToggle
              checked={settings.hideBankCards}
              description="Hides exact remaining bank counts."
              disabled={disabled}
              id={`${id}-hide-bank-counts`}
              label="Hide Bank Cards"
              name="hideBankCards"
              onChange={(checked) => updateSetting("hideBankCards", checked)}
              variant="card"
            />
          </SettingsCategory>
        </div>
      </fieldset>
    );
  }

  return (
    <fieldset className="m-0 flex flex-col gap-4 border-0 p-0" disabled={disabled}>
      <legend className="sr-only">Standard Game Settings</legend>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 md:divide-x md:divide-border">
        <section className="flex flex-col gap-3">
          <SliderSetting
            disabled={disabled}
            id={`${id}-victory-points`}
            label="Points to Win"
            max={13}
            min={3}
            onChange={(value) => updateSetting("victoryPoints", value)}
            value={settings.victoryPoints}
          />

          <SliderSetting
            disabled={disabled}
            id={`${id}-discard-limit`}
            label="Card Discard Limit"
            max={20}
            min={5}
            onChange={(value) => updateSetting("discardLimit", value)}
            value={settings.discardLimit}
          />

          <Field className="gap-1">
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
                className="size-8 shrink-0 font-bold"
                disabled={disabled || botCount <= botFloor}
                onClick={() => emit(settings, toBotCount(botCount - 1))}
                size="icon-sm"
                variant="outline"
              >
                −
              </Button>
              <Input
                id={`${id}-bot-count`}
                className="h-8 w-14 shrink-0 px-0 text-center font-mono text-sm font-bold"
                disabled={disabled}
                readOnly
                value={String(botCount)}
              />
              <Button
                type="button"
                aria-label="Add one bot seat"
                className="size-8 shrink-0 font-bold"
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

        <section className="flex flex-col gap-3 md:pl-6">
          <TurnTimerField
            disabled={disabled}
            id={`${id}-turn-timer`}
            onChange={(value) => updateSetting("turnTimerSeconds", value)}
            value={settings.turnTimerSeconds}
          />

          <Field className="gap-1">
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
                className="flex h-8 w-full items-center justify-between px-3 text-sm font-medium"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {selectedMap.playerCounts.map((playerCount) => (
                    <SelectItem
                      key={playerCount}
                      value={String(playerCount)}
                      disabled={playerCount < minPlayerCount}
                    >
                      {playerCount} players
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <BotDifficultyField
            disabled={disabled || botCount === 0}
            id={`${id}-bot-difficulty`}
            onChange={(value) => emit(settings, botCount, value)}
            tooltip={selectedDifficulty.description}
            value={botDifficulty}
          />

          <Field className="gap-1">
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
              onValueChange={(value) => applyMap(value as GameMapId)}
            >
              <SelectTrigger
                id={`${id}-map`}
                className="flex h-8 w-full items-center justify-between px-3 text-sm font-medium"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
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
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </section>
      </div>

      <section>
        <div className="grid sm:grid-cols-3 sm:gap-5">
          <RuleToggle
            checked={settings.friendlyRobber}
            description="Robber cannot target players with 2 VP or fewer."
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
            description="Hides exact card counts in the bank."
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

function TurnTimerField({
  disabled,
  id,
  onChange,
  value,
}: {
  readonly disabled: boolean;
  readonly id: string;
  readonly onChange: (value: BaseGameSettings["turnTimerSeconds"]) => void;
  readonly value: BaseGameSettings["turnTimerSeconds"];
}) {
  return (
    <Field className="gap-1">
      <FieldLabel htmlFor={id} className="flex items-center gap-1.5 text-sm font-semibold">
        Turn Timer
        <InfoTooltip content="Timed turns display a shared turn countdown." />
      </FieldLabel>
      <Select
        disabled={disabled}
        value={String(value)}
        onValueChange={(next) => onChange(Number(next) as BaseGameSettings["turnTimerSeconds"])}
      >
        <SelectTrigger
          id={id}
          className="flex h-8 w-full items-center justify-between px-3 text-sm font-medium"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {TURN_TIMER_OPTIONS.map((seconds) => (
              <SelectItem key={seconds} value={String(seconds)}>
                {seconds === 0 ? "Off (Untimed)" : `${seconds} seconds`}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function BotDifficultyField({
  disabled,
  id,
  onChange,
  tooltip,
  value,
}: {
  readonly disabled: boolean;
  readonly id: string;
  readonly onChange: (value: BotDifficulty) => void;
  readonly tooltip: string;
  readonly value: BotDifficulty;
}) {
  return (
    <Field className="gap-1">
      <FieldLabel htmlFor={id} className="flex items-center gap-1.5 text-sm font-semibold">
        Bot Difficulty
        <InfoTooltip content={tooltip} />
      </FieldLabel>
      <Select
        disabled={disabled}
        value={value}
        onValueChange={(next) => onChange(next as BotDifficulty)}
      >
        <SelectTrigger
          id={id}
          className="flex h-8 w-full items-center justify-between px-3 text-sm font-medium"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {BOT_DIFFICULTY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function SettingsCategory({
  children,
  title,
}: {
  readonly children: ReactNode;
  readonly title: string;
}) {
  return (
    <section className="flex min-h-0 flex-col gap-2 rounded-2xl bg-muted/30 p-3">
      <h3 className="px-1 text-sm font-semibold">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function SettingPanel({ children }: { readonly children: ReactNode }) {
  return <div className="rounded-2xl bg-muted/40 px-4 py-3">{children}</div>;
}

function SliderSetting({
  disabled,
  id,
  label,
  max,
  min,
  onChange,
  step = 1,
  value,
}: {
  readonly disabled: boolean;
  readonly id: string;
  readonly label: string;
  readonly max: number;
  readonly min: number;
  readonly onChange: (value: number) => void;
  readonly step?: number;
  readonly value: number;
}) {
  return (
    <Field className="gap-2">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel htmlFor={id} className="text-sm font-semibold">
          {label}
        </FieldLabel>
        <span className="font-mono text-sm font-bold">{value}</span>
      </div>
      <Slider
        disabled={disabled}
        id={id}
        max={max}
        min={min}
        onValueChange={(next) => {
          const nextValue = Array.isArray(next) ? next[0] : next;
          if (typeof nextValue === "number") {
            onChange(clampInteger(nextValue, min, max));
          }
        }}
        step={step}
        value={[value]}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
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
  variant = "inline",
}: {
  readonly checked: boolean;
  readonly description: string;
  readonly disabled: boolean;
  readonly id: string;
  readonly label: string;
  readonly name: string;
  readonly onChange: (checked: boolean) => void;
  readonly variant?: "card" | "inline";
}) {
  return (
    <div
      className={
        variant === "card"
          ? "flex items-center justify-between gap-3 rounded-2xl bg-muted/40 px-4 py-3"
          : "flex items-center justify-between gap-3 py-3 sm:py-1"
      }
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Label
          htmlFor={id}
          className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-foreground"
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
