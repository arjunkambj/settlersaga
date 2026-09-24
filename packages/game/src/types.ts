export const RESOURCE_TYPES = ["brick", "sheep", "stone", "tree", "wheat"] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

export type ResourceInventory = Record<ResourceType, number>;

export const DEVELOPMENT_CARD_TYPES = [
  "knight",
  "monopoly",
  "road-building",
  "victory-point",
  "year-of-plenty",
] as const;

export type DevelopmentCardType = (typeof DEVELOPMENT_CARD_TYPES)[number];
export type PlayableDevelopmentCardType = Exclude<DevelopmentCardType, "victory-point">;

export function isPlayableDevelopmentCard(
  card: DevelopmentCardType,
): card is PlayableDevelopmentCardType {
  return card !== "victory-point";
}

export const TERRAIN_TYPES = [
  "desert",
  "fields",
  "forest",
  "hills",
  "mountains",
  "pasture",
] as const;

export type TerrainType = (typeof TERRAIN_TYPES)[number];

export const NUMBER_TOKENS = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12] as const;
export type NumberToken = (typeof NUMBER_TOKENS)[number];

export type PlayerId = string;
export type BuildingKind = "city" | "settlement";

export const BOT_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type BotDifficulty = (typeof BOT_DIFFICULTIES)[number];

export const GAME_MAP_IDS = ["base", "extended-6", "extended-8"] as const;
export type GameMapId = (typeof GAME_MAP_IDS)[number];

export const PLAYER_COUNTS = [3, 4, 5, 6, 7, 8] as const;
export type PlayerCount = (typeof PLAYER_COUNTS)[number];

export const TURN_TIMER_OPTIONS = [0, 30, 60, 90, 120] as const;
export type TurnTimerSeconds = (typeof TURN_TIMER_OPTIONS)[number];

export interface BaseGameSettings {
  balancedDice: boolean;
  discardLimit: number;
  friendlyRobber: boolean;
  hideBankCards: boolean;
  map: GameMapId;
  maxPlayers: PlayerCount;
  turnTimerSeconds: TurnTimerSeconds;
  victoryPoints: number;
}

export interface AxialCoordinate {
  q: number;
  r: number;
}

export interface PixelCoordinate {
  x: number;
  y: number;
}

interface PlayerIdentity {
  displayName: string;
  id: PlayerId;
}

export type GamePlayerInput = PlayerIdentity &
  ({ botDifficulty: BotDifficulty; isBot: true } | { isBot: false });

export interface PlayerPieces {
  cities: number;
  roads: number;
  settlements: number;
}

interface PlayerProgress {
  developmentCards: DevelopmentCardType[];
  piecesRemaining: PlayerPieces;
  playedDevelopmentCards: PlayableDevelopmentCardType[];
  resources: ResourceInventory;
  seatIndex: number;
  /** Public score: buildings and awards, excluding unrevealed victory-point cards. */
  victoryPoints: number;
}

export type PlayerState = GamePlayerInput & PlayerProgress;

export interface TileState extends AxialCoordinate {
  id: string;
  numberToken: NumberToken | null;
  terrain: TerrainType;
}

export type PortTrade = "any" | ResourceType;

export interface PortDescriptor {
  edgeKey: string;
  id: string;
  trade: PortTrade;
}

export interface BuildingState {
  kind: BuildingKind;
  playerId: PlayerId;
  vertexKey: string;
}

export interface RoadState {
  edgeKey: string;
  playerId: PlayerId;
}

export interface BoardState {
  buildings: BuildingState[];
  ports: PortDescriptor[];
  roads: RoadState[];
  robberTileId: string;
  tiles: TileState[];
}

interface SetupSettlementPhase {
  kind: "setup_settlement";
  setupIndex: number;
}

interface SetupRoadPhase {
  kind: "setup_road";
  settlementVertexKey: string;
  setupIndex: number;
}

interface RollPhase {
  kind: "roll";
}

interface DiscardRequirement {
  count: number;
  playerId: PlayerId;
}

interface DiscardPhase {
  kind: "discard";
  pending: DiscardRequirement[];
}

type ResumePhase = "build_and_trade" | "roll";

interface MoveRobberPhase {
  kind: "move_robber";
  resumePhase: ResumePhase;
}

interface StealPhase {
  eligibleVictimIds: PlayerId[];
  kind: "steal";
  resumePhase: ResumePhase;
}

interface RoadBuildingPhase {
  kind: "road_building";
  remainingRoads: number;
  resumePhase: ResumePhase;
}

interface BuildAndTradePhase {
  kind: "build_and_trade";
}

interface FinishedPhase {
  kind: "finished";
}

export type GamePhase =
  | SetupSettlementPhase
  | SetupRoadPhase
  | RollPhase
  | DiscardPhase
  | MoveRobberPhase
  | StealPhase
  | RoadBuildingPhase
  | BuildAndTradePhase
  | FinishedPhase;

export interface DiceRoll {
  first: number;
  second: number;
  sum: number;
}

export interface TradeOffer {
  acceptedPlayerIds: PlayerId[];
  give: ResourceInventory;
  offerActionNumber: number;
  proposerPlayerId: PlayerId;
  recipientPlayerIds: PlayerId[];
  rejectedPlayerIds: PlayerId[];
  want: ResourceInventory;
}

export interface GameState {
  actionNumber: number;
  activePlayerId: PlayerId;
  balancedDiceBag: DiceRoll[];
  bank: ResourceInventory;
  board: BoardState;
  developmentCardPlayedThisTurn: boolean;
  developmentCardsBoughtThisTurn: number;
  developmentDeck: DevelopmentCardType[];
  lastDiceRoll: DiceRoll | null;
  largestArmyPlayerId: PlayerId | null;
  longestRoadPlayerId: PlayerId | null;
  phase: GamePhase;
  players: PlayerState[];
  randomIndex: number;
  seed: string;
  settings: BaseGameSettings;
  tradeOffer: TradeOffer | null;
  turnNumber: number;
  turnOrder: PlayerId[];
  winnerPlayerId: PlayerId | null;
}

export type GameCommand =
  | { kind: "place_settlement"; vertexKey: string }
  | { edgeKey: string; kind: "place_road" }
  | { kind: "roll" }
  | { kind: "discard"; resources: ResourceInventory }
  | { kind: "move_robber"; tileId: string }
  | { kind: "steal"; victimPlayerId: PlayerId }
  | { kind: "build_city"; vertexKey: string }
  | { kind: "buy_development_card" }
  | { kind: "play_knight" }
  | { kind: "play_monopoly"; resource: ResourceType }
  | { kind: "play_road_building" }
  | { kind: "play_year_of_plenty"; resources: ResourceInventory }
  | {
      give: ResourceType;
      kind: "trade_bank";
      receive: ResourceType;
    }
  | {
      give: ResourceInventory;
      kind: "propose_trade";
      recipientPlayerIds: PlayerId[];
      want: ResourceInventory;
    }
  | {
      accept: boolean;
      kind: "respond_trade";
      offerActionNumber: number;
    }
  | {
      kind: "confirm_trade";
      offerActionNumber: number;
      partnerPlayerId: PlayerId;
    }
  | {
      kind: "cancel_trade";
      offerActionNumber: number;
    }
  | { kind: "end_turn" };

export interface BankTradeOption {
  give: ResourceType;
  ratio: number;
  receive: ResourceType;
}

export interface LegalActions {
  bankTrades: BankTradeOption[];
  canBuyDevelopmentCard: boolean;
  canCancelTrade: boolean;
  canEndTurn: boolean;
  canProposeTrade: boolean;
  canRespondToTrade: boolean;
  canRoll: boolean;
  cityVertexKeys: string[];
  discardCount: number | null;
  isRequiredActor: boolean;
  playableDevelopmentCards: PlayableDevelopmentCardType[];
  roadEdgeKeys: string[];
  robberTileIds: string[];
  settlementVertexKeys: string[];
  tradePartnerPlayerIds: PlayerId[];
  victimPlayerIds: PlayerId[];
}

interface PublicPlayerState extends Omit<PlayerState, "developmentCards" | "resources"> {
  developmentCardCount: number;
  isViewer: false;
  revealedVictoryPointCards: number | null;
  resourceCount: number;
}

export type PrivatePlayerState = PlayerState & {
  isViewer: true;
  resourceCount: number;
};

export type PlayerViewState = PublicPlayerState | PrivatePlayerState;

export interface PlayerGameView extends Omit<
  GameState,
  "balancedDiceBag" | "bank" | "developmentDeck" | "players" | "randomIndex" | "seed"
> {
  bank: ResourceInventory | null;
  developmentCardSupply: number;
  legalActions: LegalActions;
  players: PlayerViewState[];
  viewerPlayerId: PlayerId;
}

export type GameRuleErrorCode =
  | "BANK_OUT_OF_RESOURCE"
  | "DISTANCE_RULE"
  | "GAME_FINISHED"
  | "INSUFFICIENT_RESOURCES"
  | "INVALID_COMMAND"
  | "INVALID_DISCARD"
  | "INVALID_LOCATION"
  | "INVALID_PHASE"
  | "INVALID_ROBBER_TILE"
  | "INVALID_SETTINGS"
  | "INVALID_TRADE"
  | "INVALID_VICTIM"
  | "LOCATION_OCCUPIED"
  | "NO_DEVELOPMENT_CARD_AVAILABLE"
  | "DEVELOPMENT_CARD_NOT_PLAYABLE"
  | "NO_PIECE_AVAILABLE"
  | "NOT_REQUIRED_ACTOR"
  | "ROAD_NOT_CONNECTED"
  | "ROBBER_TILE_UNCHANGED"
  | "UNKNOWN_PLAYER";

export class GameRuleError extends Error {
  readonly code: GameRuleErrorCode;

  constructor(code: GameRuleErrorCode, message: string) {
    super(message);
    this.name = "GameRuleError";
    this.code = code;
  }
}
