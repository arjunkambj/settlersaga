import { createBoard } from "./board";
import {
  BANK_RESOURCE_COUNT,
  BOT_DIFFICULTIES,
  DEFAULT_BASE_GAME_SETTINGS,
  DEVELOPMENT_CARD_DECK,
  INITIAL_PIECES,
  TURN_TIMER_OPTIONS,
} from "./constants";
import { mapSupportsPlayerCount } from "./maps";
import { deterministicShuffle } from "./random";
import { emptyInventory, filledInventory } from "./resources";
import { GameRuleError } from "./types";
import type {
  BaseGameSettings,
  BotDifficulty,
  GamePlayerInput,
  GameState,
  PlayerCount,
} from "./types";

const MINIMUM_VICTORY_POINTS = 3;
const MAXIMUM_BUILDING_VICTORY_POINTS = 13;
const MINIMUM_DISCARD_LIMIT = 5;
const MAXIMUM_DISCARD_LIMIT = 20;

function createSettings(
  playerCount: PlayerCount,
  input: Partial<BaseGameSettings> | undefined,
): BaseGameSettings {
  const overrides = input ?? {};
  const settings: BaseGameSettings = {
    balancedDice: overrides.balancedDice ?? DEFAULT_BASE_GAME_SETTINGS.balancedDice,
    discardLimit: overrides.discardLimit ?? DEFAULT_BASE_GAME_SETTINGS.discardLimit,
    friendlyRobber: overrides.friendlyRobber ?? DEFAULT_BASE_GAME_SETTINGS.friendlyRobber,
    hideBankCards: overrides.hideBankCards ?? DEFAULT_BASE_GAME_SETTINGS.hideBankCards,
    map: overrides.map ?? DEFAULT_BASE_GAME_SETTINGS.map,
    maxPlayers: overrides.maxPlayers ?? playerCount,
    turnTimerSeconds: overrides.turnTimerSeconds ?? DEFAULT_BASE_GAME_SETTINGS.turnTimerSeconds,
    victoryPoints: overrides.victoryPoints ?? DEFAULT_BASE_GAME_SETTINGS.victoryPoints,
  };

  if (
    !Number.isInteger(settings.victoryPoints) ||
    settings.victoryPoints < MINIMUM_VICTORY_POINTS ||
    settings.victoryPoints > MAXIMUM_BUILDING_VICTORY_POINTS
  ) {
    throw new GameRuleError(
      "INVALID_COMMAND",
      `Victory points must be an integer from ${MINIMUM_VICTORY_POINTS} to ${MAXIMUM_BUILDING_VICTORY_POINTS}`,
    );
  }

  if (
    !Number.isInteger(settings.discardLimit) ||
    settings.discardLimit < MINIMUM_DISCARD_LIMIT ||
    settings.discardLimit > MAXIMUM_DISCARD_LIMIT
  ) {
    throw new GameRuleError(
      "INVALID_COMMAND",
      `Discard limit must be an integer from ${MINIMUM_DISCARD_LIMIT} to ${MAXIMUM_DISCARD_LIMIT}`,
    );
  }

  if (!(TURN_TIMER_OPTIONS as readonly number[]).includes(settings.turnTimerSeconds)) {
    throw new GameRuleError("INVALID_COMMAND", "Turn timer is not supported");
  }

  if (settings.maxPlayers !== playerCount) {
    throw new GameRuleError(
      "INVALID_COMMAND",
      `Expected ${settings.maxPlayers} players, received ${playerCount}`,
    );
  }

  if (!mapSupportsPlayerCount(settings.map, playerCount)) {
    throw new GameRuleError(
      "INVALID_COMMAND",
      `The ${settings.map} map does not support ${playerCount} players`,
    );
  }

  for (const field of ["balancedDice", "friendlyRobber", "hideBankCards"] as const) {
    if (typeof settings[field] !== "boolean") {
      throw new GameRuleError("INVALID_COMMAND", `${field} must be a boolean`);
    }
  }

  return settings;
}

function botDifficultyFor(player: GamePlayerInput): BotDifficulty | undefined {
  if (!player.isBot) {
    return undefined;
  }

  const difficulty = player.botDifficulty ?? "medium";
  if (!BOT_DIFFICULTIES.includes(difficulty)) {
    throw new GameRuleError("INVALID_COMMAND", `Unknown bot difficulty: ${difficulty}`);
  }

  return difficulty;
}

export function createDevelopmentDeck(seed: string) {
  return deterministicShuffle(DEVELOPMENT_CARD_DECK, `${seed}:development-deck`);
}

export function createDefaultGame(
  players: readonly GamePlayerInput[],
  seed: string,
  settingsInput?: Partial<BaseGameSettings>,
): GameState {
  if (players.length < 3 || players.length > 8) {
    throw new GameRuleError("INVALID_COMMAND", "A base game requires three to eight players");
  }

  const playerCount = players.length as PlayerCount;
  const settings = createSettings(playerCount, settingsInput);

  if (new Set(players.map((player) => player.id)).size !== players.length) {
    throw new GameRuleError("INVALID_COMMAND", "Player IDs must be unique");
  }

  if (!seed) {
    throw new GameRuleError("INVALID_COMMAND", "A game seed is required");
  }

  const [firstPlayer] = players;

  if (!firstPlayer) {
    throw new GameRuleError("INVALID_COMMAND", "A first player is required");
  }

  return {
    actionNumber: 0,
    activePlayerId: firstPlayer.id,
    balancedDiceBag: [],
    bank: filledInventory(BANK_RESOURCE_COUNT),
    board: createBoard(settings.map, seed),
    developmentCardPlayedThisTurn: false,
    developmentCardsBoughtThisTurn: 0,
    developmentDeck: createDevelopmentDeck(seed),
    lastDiceRoll: null,
    largestArmyPlayerId: null,
    longestRoadPlayerId: null,
    phase: { kind: "setup_settlement", setupIndex: 0 },
    players: players.map((player, seatIndex) => {
      const botDifficulty = botDifficultyFor(player);
      return {
        developmentCards: [],
        displayName: player.displayName,
        ...(botDifficulty ? { botDifficulty } : {}),
        id: player.id,
        isBot: player.isBot,
        piecesRemaining: { ...INITIAL_PIECES },
        playedDevelopmentCards: [],
        resources: emptyInventory(),
        seatIndex,
        victoryPoints: 0,
      };
    }),
    randomIndex: 0,
    seed,
    settings: { ...settings },
    status: "active",
    tradeOffer: null,
    turnNumber: 0,
    turnOrder: players.map((player) => player.id),
    version: 4,
    winnerPlayerId: null,
  };
}
