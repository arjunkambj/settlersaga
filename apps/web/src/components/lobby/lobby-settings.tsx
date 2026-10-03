"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Switch } from "@base-ui/react/switch";
import {
  AVAILABLE_GAME_MAPS,
  GAME_SETTINGS_LIMITS,
  getGameMapDefinition,
  TURN_TIMER_OPTIONS,
  type BaseGameSettings,
  type BotDifficulty,
  type GameMapId,
  type PlayerCount,
} from "@settersaga/game";
import cardsIcon from "@iconify-icons/solar/card-2-bold";
import trophyIcon from "@iconify-icons/solar/cup-star-bold";
import usersIcon from "@iconify-icons/solar/users-group-rounded-bold";
import timerIcon from "@iconify-icons/solar/stopwatch-bold";
import { Icon, type IconifyIcon } from "@iconify/react/offline";
import Image from "next/image";
import { useId, type ReactNode } from "react";

import { MapPreview } from "@/components/lobby/map-preview";
import { Button } from "@/components/ui/button";
import { MinusIcon, PlusIcon } from "@/components/ui/step-icons";
import { BOT_DIFFICULTY_DETAILS, BOT_DIFFICULTY_OPTIONS } from "@/lib/lobby/bot-difficulty";
import { HOUSE_RULE_OPTIONS } from "@/lib/lobby/house-rules";
import {
  getCompatiblePlayerCount,
  withTableSize,
  type LobbySettingsValue,
} from "@/lib/lobby/lobby-settings-model";
import { GAME_MAP_NAMES } from "@/lib/lobby/map-names";

const TURN_TIMER_CHOICES = TURN_TIMER_OPTIONS.map((seconds) => ({
  label: seconds === 0 ? "Off" : `${seconds}s`,
  value: seconds,
}));

export interface LobbySettingsProps {
  /** Locks every control, e.g. while the game is starting. */
  readonly disabled: boolean;
  readonly humanCount: number;
  readonly onChange: (value: LobbySettingsValue) => void;
  /** Shows the settings without letting this viewer change them. */
  readonly readOnly: boolean;
  readonly value: LobbySettingsValue;
}

export function LobbySettings({
  disabled,
  humanCount,
  onChange,
  readOnly,
  value,
}: LobbySettingsProps) {
  const { settings } = value;
  const { playerCounts } = getGameMapDefinition(settings.map);
  const lock = { disabled, readOnly };

  const updateSetting = <Key extends keyof BaseGameSettings>(
    key: Key,
    next: BaseGameSettings[Key],
  ) => {
    onChange({ ...value, settings: { ...settings, [key]: next } });
  };

  const chooseMap = (map: GameMapId) => {
    const maxPlayers = getCompatiblePlayerCount(map, humanCount, settings.maxPlayers);
    if (maxPlayers !== null) {
      onChange(withTableSize(value, { map, maxPlayers }, humanCount));
    }
  };

  return (
    <div className="@container flex flex-col gap-6">
      <SettingsSection title="Island">
        <MapPicker
          {...lock}
          humanCount={humanCount}
          maxPlayers={settings.maxPlayers}
          onChange={chooseMap}
          value={settings.map}
        />
        <Setting icon={usersIcon} label="Seats">
          {(labelId) => (
            <ChoiceGroup
              {...lock}
              choices={playerCounts.map((playerCount) => ({
                disabled: playerCount < humanCount,
                label: `${playerCount} seats`,
                value: playerCount,
              }))}
              labelId={labelId}
              onChange={(maxPlayers: PlayerCount) =>
                onChange(withTableSize(value, { map: settings.map, maxPlayers }, humanCount))
              }
              value={settings.maxPlayers}
            />
          )}
        </Setting>
        {playerCounts.some((playerCount) => playerCount < humanCount) ? (
          <p className="lobby-hint">
            Your crew of {humanCount} needs at least {humanCount} seats.
          </p>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Match">
        <div className="grid gap-5 @min-[22rem]:grid-cols-2">
          <Setting icon={trophyIcon} label="Victory points">
            {(labelId) => (
              <Stepper
                {...lock}
                {...GAME_SETTINGS_LIMITS.victoryPoints}
                labelId={labelId}
                name="victory points"
                onChange={(next) => updateSetting("victoryPoints", next)}
                value={settings.victoryPoints}
              />
            )}
          </Setting>
          <Setting icon={cardsIcon} label="Discard limit">
            {(labelId) => (
              <Stepper
                {...lock}
                {...GAME_SETTINGS_LIMITS.discardLimit}
                labelId={labelId}
                name="discard limit"
                onChange={(next) => updateSetting("discardLimit", next)}
                value={settings.discardLimit}
              />
            )}
          </Setting>
        </div>
        <p className="lobby-hint">
          When a 7 is rolled, anyone with more than {settings.discardLimit} cards discards half.
        </p>
        <Setting icon={timerIcon} label="Turn timer">
          {(labelId) => (
            <ChoiceGroup
              {...lock}
              choices={TURN_TIMER_CHOICES}
              labelId={labelId}
              onChange={(seconds) => updateSetting("turnTimerSeconds", seconds)}
              value={settings.turnTimerSeconds}
            />
          )}
        </Setting>
      </SettingsSection>

      <SettingsSection title="Bots">
        <DifficultyPicker
          {...lock}
          onChange={(botDifficulty) => onChange({ ...value, botDifficulty })}
          value={value.botDifficulty}
        />
        <p className="lobby-hint">{BOT_DIFFICULTY_DETAILS[value.botDifficulty].description}</p>
      </SettingsSection>

      <SettingsSection title="House rules">
        <div className="grid auto-rows-fr gap-3 @min-[34rem]:grid-cols-3">
          {HOUSE_RULE_OPTIONS.map((rule) => (
            <RuleTile
              {...lock}
              artSrc={rule.artSrc}
              checked={settings[rule.value]}
              description={rule.description}
              key={rule.value}
              label={rule.label}
              onChange={(checked) => updateSetting(rule.value, checked)}
            />
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}

interface LockProps {
  readonly disabled: boolean;
  readonly readOnly: boolean;
}

function SettingsSection({ children, title }: { children: ReactNode; title: string }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <h3 className="game-eyebrow" id={titleId}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Setting({
  children,
  icon,
  label,
}: {
  children: (labelId: string) => ReactNode;
  icon: IconifyIcon;
  label: string;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-2 text-sm font-bold" id={labelId}>
        <Icon className="size-5 text-accent" icon={icon} />
        {label}
      </p>
      {children(labelId)}
    </div>
  );
}

function MapPicker({
  disabled,
  humanCount,
  maxPlayers,
  onChange,
  readOnly,
  value,
}: LockProps & {
  humanCount: number;
  maxPlayers: PlayerCount;
  onChange: (map: GameMapId) => void;
  value: GameMapId;
}) {
  return (
    <RadioGroup<GameMapId>
      aria-label="Island"
      className="grid grid-cols-3 gap-2 @md:gap-3"
      disabled={disabled}
      onValueChange={onChange}
      readOnly={readOnly}
      value={value}
    >
      {AVAILABLE_GAME_MAPS.map((map) => {
        const tooSmall = getCompatiblePlayerCount(map.id, humanCount, maxPlayers) === null;
        return (
          <Radio.Root
            className="game-choice-tile lobby-map-tile flex min-w-0 flex-col items-center gap-1 p-2 text-center"
            disabled={tooSmall}
            key={map.id}
            value={map.id}
          >
            <MapPreview className="h-20 w-full @xl:h-28" mapId={map.id} />
            <span className="w-full truncate text-[0.9375rem] leading-tight font-bold">
              {GAME_MAP_NAMES[map.id]}
            </span>
            <span className="w-full truncate text-xs font-bold text-muted-foreground in-data-checked:text-ui-text-soft">
              {tooSmall ? `Too small for ${humanCount}` : `${map.playerCounts.join("–")} players`}
            </span>
          </Radio.Root>
        );
      })}
    </RadioGroup>
  );
}

function DifficultyPicker({
  disabled,
  onChange,
  readOnly,
  value,
}: LockProps & {
  onChange: (value: BotDifficulty) => void;
  value: BotDifficulty;
}) {
  return (
    <RadioGroup<BotDifficulty>
      aria-label="Bot difficulty"
      className="grid grid-cols-3 gap-2 @md:gap-3"
      disabled={disabled}
      onValueChange={onChange}
      readOnly={readOnly}
      value={value}
    >
      {BOT_DIFFICULTY_OPTIONS.map((option) => (
        <Radio.Root
          className="game-choice-tile flex min-w-0 flex-col items-center gap-1 p-2 text-center"
          key={option.value}
          value={option.value}
        >
          <Image
            alt=""
            className="size-16 object-contain @xl:size-20"
            height={160}
            src={option.artSrc}
            width={160}
          />
          <span className="text-[0.9375rem] leading-tight font-bold">{option.label}</span>
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}

function ChoiceGroup<Value extends number | string>({
  choices,
  disabled,
  labelId,
  onChange,
  readOnly,
  value,
}: LockProps & {
  choices: readonly { disabled?: boolean; label: string; value: Value }[];
  labelId: string;
  onChange: (value: Value) => void;
  value: Value;
}) {
  return (
    <RadioGroup<Value>
      aria-labelledby={labelId}
      className="grid auto-cols-fr grid-flow-col gap-2"
      disabled={disabled}
      onValueChange={onChange}
      readOnly={readOnly}
      value={value}
    >
      {choices.map((choice) => (
        <Radio.Root
          className="game-choice-option data-readonly:pointer-events-none"
          disabled={choice.disabled}
          key={choice.value}
          value={choice.value}
        >
          {choice.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}

function Stepper({
  disabled,
  labelId,
  max,
  min,
  name,
  onChange,
  readOnly,
  value,
}: LockProps & {
  labelId: string;
  max: number;
  min: number;
  name: string;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <div aria-labelledby={labelId} className="game-well flex items-center gap-2 p-1.5" role="group">
      {readOnly ? null : (
        <Button
          aria-label={`Lower ${name}`}
          disabled={disabled || value <= min}
          onClick={() => onChange(value - 1)}
          size="game-md"
          variant="game-icon"
        >
          <MinusIcon />
        </Button>
      )}
      <output aria-live="polite" className="lobby-counter flex-1">
        {value}
      </output>
      {readOnly ? null : (
        <Button
          aria-label={`Raise ${name}`}
          disabled={disabled || value >= max}
          onClick={() => onChange(value + 1)}
          size="game-md"
          variant="game-icon"
        >
          <PlusIcon />
        </Button>
      )}
    </div>
  );
}

function RuleTile({
  artSrc,
  checked,
  description,
  disabled,
  label,
  onChange,
  readOnly,
}: LockProps & {
  artSrc: string;
  checked: boolean;
  description: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <Switch.Root
      aria-describedby={descriptionId}
      aria-labelledby={labelId}
      checked={checked}
      className="game-choice-tile grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 p-3 text-left @min-[34rem]:grid-cols-1 @min-[34rem]:justify-items-center @min-[34rem]:text-center"
      disabled={disabled}
      onCheckedChange={onChange}
      readOnly={readOnly}
    >
      <Image
        alt=""
        className="size-14 object-contain @min-[34rem]:size-16"
        height={128}
        src={artSrc}
        width={128}
      />
      <span className="flex min-w-0 flex-col gap-1 @min-[34rem]:items-center">
        <span className="flex items-center gap-2">
          <span className="text-[0.9375rem] leading-tight font-bold" id={labelId}>
            {label}
          </span>
          <span className="game-pill" data-tone={checked ? "ready" : "quiet"}>
            {checked ? "On" : "Off"}
          </span>
        </span>
        <span
          className="text-sm leading-snug text-muted-foreground in-data-checked:text-ui-text-soft"
          id={descriptionId}
        >
          {description}
        </span>
      </span>
    </Switch.Root>
  );
}
