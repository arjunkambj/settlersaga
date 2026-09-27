"use client";

import type { Id } from "@settersaga/backend/convex/_generated/dataModel";
import {
  commandEventKind,
  commandTargetPlayerId,
  commandText,
} from "@settersaga/backend/convex/model/commands";
import {
  applyCommand,
  assertGameState,
  assertPlayerGameView,
  chooseAutomatedCommand,
  createDefaultGame,
  DEFAULT_BASE_GAME_SETTINGS,
  DEVELOPMENT_CARD_TYPES,
  emptyInventory,
  getLegalActions,
  getRequiredPlayerIds,
  RESOURCE_TYPES,
  toPlayerView,
  type BaseGameSettings,
  type BotDifficulty,
  type GameCommand,
  type GamePlayerInput,
  type GameState,
  type PlayerColor,
  type ResourceInventory,
} from "@settersaga/game";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import {
  PreviewAppSessionProvider,
  type AppSessionContextValue,
} from "@/components/app/app-session-context";
import { SceneBackdrop } from "@/components/app/scene-backdrop";
import type { UiPreviewMode } from "@/components/app/ui-preview-modes";
import { AuthScreenView } from "@/components/auth/auth-screen";
import { ActionTile } from "@/components/game/action-tile";
import { GameHelpDialog } from "@/components/game/game-help-dialog";
import { GameScreen } from "@/components/game/game-screen";
import { HomeScreen } from "@/components/home/home-screen";
import { LobbyScreen } from "@/components/lobby/lobby-screen";
import type { ChatMessage, RoomChat } from "@/components/room/chat-panel";
import { Card } from "@/components/ui/card";
import { FullPageStatus } from "@/components/ui/full-page-status";
import {
  ACTION_CARD_ASSET_PATHS,
  DEVELOPMENT_CARD_BACK_ASSET_PATH,
} from "@/constants/game/card-assets";
import { END_TURN_ICON_ASSET_PATH } from "@/constants/game/ui-assets";
import { DEFAULT_AUDIO_SETTINGS } from "@/lib/audio-settings";
import type { RoomEventView, RoomView } from "@/lib/game/types";
import { getPlayerColor } from "@/lib/game/view";
import { createLobbySeatPreview, type LobbySettingsValue } from "@/lib/lobby/lobby-settings-model";

type GamePreviewMode = Extract<UiPreviewMode, `game${string}`>;
type LobbyPreviewMode = Extract<UiPreviewMode, `lobby${string}`>;

const VIEWER_NAME = "Captain Rowan";
/** Another player's message lands this long after a preview opens, so the unread badge shows. */
const INCOMING_CHAT_DELAY_MS = 4_000;

const PREVIEW_SESSION: AppSessionContextValue = {
  accountLabel: "Guest account",
  audioSettings: DEFAULT_AUDIO_SETTINGS,
  displayName: VIEWER_NAME,
  enterRoom: () => undefined,
  error: "",
  exitRoomLocally: () => undefined,
  isGuest: true,
  onAudioSettingsChange: () => undefined,
  onDisplayNameChange: async () => undefined,
  pendingAction: null,
  profileImageUrl: null,
  runAction: async () => null,
  session: null,
  setError: () => undefined,
  setPendingAction: () => undefined,
  signOut: async () => undefined,
  updateSession: () => undefined,
};

export function UiPreview({ mode, seed }: { mode: UiPreviewMode; seed?: string }) {
  const [previewDeadline, setPreviewDeadline] = useState<number>();
  const [randomGameSeed, setRandomGameSeed] = useState<string>();

  useEffect(() => {
    if (!mode.startsWith("game")) {
      // oxlint-disable-next-line react/set-state-in-effect -- the deadline reads the clock, so it is set after hydration
      setPreviewDeadline(undefined);
      return;
    }

    setPreviewDeadline(Date.now() + 45_000);
  }, [mode]);

  useEffect(() => {
    if (mode !== "game" || seed) {
      // oxlint-disable-next-line react/set-state-in-effect -- the seed is random, so it is set after hydration
      setRandomGameSeed(undefined);
      return;
    }

    setRandomGameSeed(window.crypto.randomUUID());
  }, [mode, seed]);

  switch (mode) {
    case "auth":
      return (
        <AuthScreenView onPlayAsGuest={async () => undefined} onSignIn={async () => undefined} />
      );
    case "home":
    case "home-fresh":
      return (
        <PreviewAppSessionProvider value={PREVIEW_SESSION}>
          <HomeScreen
            error=""
            onCreateRoom={async () => undefined}
            onDismissError={() => undefined}
            onJoinRoom={async () => undefined}
            onQuickPlay={async () => undefined}
            pendingAction={null}
            rejoinRoom={mode === "home" ? { code: "DGZ9J6", status: "active" } : null}
          />
        </PreviewAppSessionProvider>
      );
    case "help":
      return (
        <main className="min-h-dvh" id="main-content">
          <SceneBackdrop />
          <GameHelpDialog onClose={() => undefined} settings={DEFAULT_BASE_GAME_SETTINGS} />
        </main>
      );
    case "action-preset":
      return <ActionPresetPreview />;
    case "lobby":
    case "lobby-full":
    case "lobby-guest":
      return <LobbyPreview fixture={LOBBY_PREVIEWS[mode]} key={mode} />;
  }

  const gameSeed = mode === "game" ? (seed ?? randomGameSeed) : undefined;
  if (mode === "game" && !gameSeed) {
    return <FullPageStatus label="Shuffling a new island…" />;
  }

  return (
    <GamePreview
      key={`${mode}:${gameSeed ?? "reference"}`}
      mode={mode}
      previewDeadline={previewDeadline}
      seed={gameSeed}
    />
  );
}

/* ---------------------------------------------------------------------------------------------
   Chat
   ------------------------------------------------------------------------------------------ */

type PreviewChatLine = Omit<ChatMessage, "sentAt">;

/** Fixture chat that keeps what the viewer sends, plus one message from the crew after a beat. */
function usePreviewChat({
  incoming,
  messages: initialMessages,
  viewerColor,
}: {
  incoming?: PreviewChatLine;
  messages: readonly ChatMessage[];
  viewerColor: PlayerColor;
}): RoomChat {
  const [messages, setMessages] = useState(initialMessages);

  useEffect(() => {
    if (!incoming) {
      return;
    }
    const timer = window.setTimeout(
      () => setMessages((current) => [...current, { ...incoming, sentAt: Date.now() }]),
      INCOMING_CHAT_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [incoming]);

  return {
    messages,
    onSend: async (body) =>
      setMessages((current) => [
        ...current,
        {
          body,
          displayName: VIEWER_NAME,
          id: `preview-chat-sent-${current.length}`,
          isMine: true,
          playerColor: viewerColor,
          sentAt: Date.now(),
        },
      ]),
  };
}

// Fixed timestamps, so the server render and hydration agree.
const CHAT_ANCHOR = Date.UTC(2026, 6, 19, 22, 20);

function chatLine(
  id: string,
  displayName: string,
  playerColor: PlayerColor,
  body: string,
  minute: number,
): ChatMessage {
  return {
    body,
    displayName,
    id,
    isMine: displayName === VIEWER_NAME,
    playerColor,
    sentAt: CHAT_ANCHOR + minute * 60_000,
  };
}

/* ---------------------------------------------------------------------------------------------
   Harbor (lobby)
   ------------------------------------------------------------------------------------------ */

interface PreviewSeat {
  controller: "bot" | "player";
  displayName: string;
  isViewer?: boolean;
  role?: "host";
}

interface LobbyPreviewFixture {
  /** Away by member, as presence is, so the flag leaves with a removed player. */
  awayMemberIds: ReadonlySet<string>;
  chat: readonly ChatMessage[];
  incomingChat?: PreviewChatLine;
  room: RoomView;
}

const previewSeatId = (seatIndex: number) => `preview-seat-${seatIndex}`;

function createLobbyRoom({
  botDifficulty,
  seats,
  settings = DEFAULT_BASE_GAME_SETTINGS,
}: {
  botDifficulty: BotDifficulty;
  seats: readonly PreviewSeat[];
  settings?: BaseGameSettings;
}): RoomView {
  const members: RoomView["members"] = seats.map((seat, seatIndex) => ({
    controller: seat.controller,
    displayName: seat.displayName,
    id: previewSeatId(seatIndex),
    isViewer: seat.isViewer ?? false,
    playerColor: getPlayerColor({ seatIndex }),
    role: seat.role ?? "player",
    seatIndex,
  }));
  return {
    botDifficulty,
    botThinking: false,
    code: "SPUA6U",
    events: [],
    isHost: members.some((member) => member.isViewer && member.role === "host"),
    isPaused: false,
    members,
    settings: { ...settings },
    status: "waiting",
  };
}

const LOBBY_PREVIEWS: Record<LobbyPreviewMode, LobbyPreviewFixture> = {
  // The host's view: an away guest, a bot and one open seat.
  lobby: {
    awayMemberIds: new Set([previewSeatId(1)]),
    chat: [
      chatLine("lobby-chat-1", "Mira", "blue", "Ahoy! Ready when you are.", 0),
      chatLine("lobby-chat-2", VIEWER_NAME, "red", "Setting up the rules, one sec", 1),
    ],
    room: createLobbyRoom({
      botDifficulty: "medium",
      seats: [
        { controller: "player", displayName: VIEWER_NAME, isViewer: true, role: "host" },
        { controller: "player", displayName: "Mira" },
        { controller: "bot", displayName: "Clark Bot" },
      ],
    }),
  },
  // Everything set by someone else, under a long host name.
  "lobby-guest": {
    awayMemberIds: new Set(),
    chat: [
      chatLine("guest-chat-1", "Bartholomew Longbeard", "red", "Welcome aboard, crew!", 0),
      chatLine("guest-chat-2", VIEWER_NAME, "blue", "Glad to be here", 1),
    ],
    incomingChat: {
      body: "Starting once one more joins",
      displayName: "Bartholomew Longbeard",
      id: "guest-chat-incoming",
      isMine: false,
      playerColor: "red",
    },
    room: createLobbyRoom({
      botDifficulty: "hard",
      seats: [
        { controller: "player", displayName: "Bartholomew Longbeard", role: "host" },
        { controller: "player", displayName: VIEWER_NAME, isViewer: true },
        { controller: "bot", displayName: "Clark Bot" },
      ],
    }),
  },
  // A full six-seat table: three humans (one away) and three bots.
  "lobby-full": {
    awayMemberIds: new Set([previewSeatId(1)]),
    chat: [
      chatLine("full-chat-1", "Mira", "blue", "Six of us, nice!", 0),
      chatLine("full-chat-2", "Bartholomew Longbeard", "orange", "Hard bots? Bold.", 1),
      chatLine("full-chat-3", VIEWER_NAME, "red", "Let's see what they've got", 2),
    ],
    incomingChat: {
      body: "Ready to set sail!",
      displayName: "Bartholomew Longbeard",
      id: "full-chat-incoming",
      isMine: false,
      playerColor: "orange",
    },
    room: createLobbyRoom({
      botDifficulty: "hard",
      seats: [
        { controller: "player", displayName: VIEWER_NAME, isViewer: true, role: "host" },
        { controller: "player", displayName: "Mira" },
        { controller: "player", displayName: "Bartholomew Longbeard" },
        { controller: "bot", displayName: "Clark Bot" },
        { controller: "bot", displayName: "Diana Bot" },
        { controller: "bot", displayName: "Peter Bot" },
      ],
      settings: {
        ...DEFAULT_BASE_GAME_SETTINGS,
        friendlyRobber: true,
        hideBankCards: true,
        map: "extended-6",
        maxPlayers: 6,
      },
    }),
  },
};

function LobbyPreview({ fixture }: { fixture: LobbyPreviewFixture }) {
  const [room, setRoom] = useState(fixture.room);
  const chat = usePreviewChat({
    incoming: fixture.incomingChat,
    messages: fixture.chat,
    viewerColor: room.members.find((member) => member.isViewer)?.playerColor ?? "red",
  });
  const offlineSeatIndexes = new Set(
    room.members
      .filter((member) => fixture.awayMemberIds.has(member.id))
      .map((member) => member.seatIndex),
  );

  // Saves land the way the server applies them, so edits stick.
  const saveSettings = async ({ botCount, botDifficulty, settings }: LobbySettingsValue) =>
    setRoom((current) => ({
      ...current,
      botDifficulty,
      members: createLobbySeatPreview({
        botCount,
        maxPlayers: settings.maxPlayers,
        members: current.members,
        savedMaxPlayers: current.settings.maxPlayers,
      }).filter((member) => member !== undefined),
      settings,
    }));

  // A removed crew member's seat goes to a bot.
  const removeMember = async (memberId: string) =>
    setRoom((current) => {
      const members = current.members.filter((member) => member.id !== memberId);
      return {
        ...current,
        members: createLobbySeatPreview({
          botCount: members.filter((member) => member.controller === "bot").length + 1,
          maxPlayers: current.settings.maxPlayers,
          members,
          savedMaxPlayers: current.settings.maxPlayers,
        }).filter((member) => member !== undefined),
      };
    });

  return (
    <PreviewAppSessionProvider value={PREVIEW_SESSION}>
      <LobbyScreen
        chat={chat}
        error=""
        offlineSeatIndexes={offlineSeatIndexes}
        onLeave={async () => undefined}
        onReplacePlayer={removeMember}
        onSaveSettings={saveSettings}
        onStart={async () => undefined}
        pendingAction={null}
        room={room}
      />
    </PreviewAppSessionProvider>
  );
}

/* ---------------------------------------------------------------------------------------------
   Game
   ------------------------------------------------------------------------------------------ */

// Mira (seat 1) is away; Bartholomew is the crew member who chats.
const PREVIEW_PLAYERS: GamePlayerInput[] = [
  { displayName: VIEWER_NAME, id: "player-1", isBot: false },
  { displayName: "Mira", id: "player-2", isBot: false },
  { displayName: "Bartholomew Longbeard", id: "player-3", isBot: false },
  { botDifficulty: "medium", displayName: "Peter Bot", id: "player-4", isBot: true },
];

const PREVIEW_AWAY_SEATS: ReadonlySet<number> = new Set([1]);

const PREVIEW_GAME_CHAT: readonly ChatMessage[] = [
  chatLine("game-chat-1", "Bartholomew Longbeard", "orange", "Anyone trading wheat?", 0),
  chatLine("game-chat-2", VIEWER_NAME, "red", "I've got sheep to spare", 1),
];

const PREVIEW_INCOMING_GAME_CHAT: PreviewChatLine = {
  body: "Nice spot for that road",
  displayName: "Bartholomew Longbeard",
  id: "game-chat-incoming",
  isMine: false,
  playerColor: "orange",
};

/** In the live preview, the crew's moves come this far apart, so each one's cards can land. */
const LIVE_CREW_MOVE_MS = 1_600;

function GamePreview({
  mode,
  previewDeadline,
  seed,
}: {
  mode: GamePreviewMode;
  previewDeadline?: number;
  seed?: string;
}) {
  const [previewState, setPreviewState] = useState(() => createGamePreviewState(mode, seed));
  const [previewEvents, setPreviewEvents] = useState(() => createPreviewEvents(mode, previewState));
  const previewStateRef = useRef(previewState);
  const [isPaused, setIsPaused] = useState(mode === "game-paused");
  const chat = usePreviewChat({
    incoming: PREVIEW_INCOMING_GAME_CHAT,
    messages: PREVIEW_GAME_CHAT,
    viewerColor: "red",
  });

  // Every move is logged as the server would log it, so the screen reacts as in a real game.
  const applyPreviewCommand = (actorPlayerId: string, command: GameCommand) => {
    const state = previewStateRef.current;
    const nextState = applyCommand(state, actorPlayerId, command);
    assertGameState(nextState);
    previewStateRef.current = nextState;
    setPreviewState(nextState);
    setPreviewEvents((events) => [
      ...events,
      createPreviewEvent(
        events.length,
        actorPlayerId,
        commandText(command, actorPlayerId, state, nextState),
        commandEventKind(command, actorPlayerId, state, nextState),
        commandTargetPlayerId(command),
      ),
    ]);
  };

  const runCommand = async (command: GameCommand) => {
    applyPreviewCommand("player-1", command);
  };

  // The live table: whenever someone else is required, they move as a hard bot would.
  const crewPlayerId =
    mode === "game-live" && !isPaused
      ? getRequiredPlayerIds(previewState).find((playerId) => playerId !== "player-1")
      : undefined;
  useEffect(() => {
    if (!crewPlayerId) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      const state = previewStateRef.current;
      const asBot = {
        ...state,
        players: state.players.map((player) =>
          player.id === crewPlayerId
            ? { ...player, botDifficulty: "hard" as const, isBot: true as const }
            : player,
        ),
      };
      applyPreviewCommand(crewPlayerId, chooseAutomatedCommand(asBot, crewPlayerId));
    }, LIVE_CREW_MOVE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [crewPlayerId, previewState]);

  return (
    <GameScreen
      audioSettings={DEFAULT_AUDIO_SETTINGS}
      botDifficulty="medium"
      botThinking={crewPlayerId !== undefined}
      chat={chat}
      events={previewEvents}
      game={createPreviewView(previewState)}
      hostSeatIndex={0}
      isHost
      isPaused={isPaused}
      nextActionAt={previewDeadline}
      offlineSeatIndexes={PREVIEW_AWAY_SEATS}
      onCommand={runCommand}
      onLeave={async () => undefined}
      onPauseChange={async (shouldPause) => setIsPaused(shouldPause)}
      onRematch={async () => undefined}
      onReplacePlayer={async () => undefined}
      pausedRemainingMs={isPaused ? 42_000 : undefined}
      viewerProfileImageUrl="/game-assets/avatars/red-navigator.png"
    />
  );
}

function createGamePreviewState(mode: GamePreviewMode, seed?: string): GameState {
  switch (mode) {
    case "game":
      return createPreviewGame(false, seed);
    case "game-live":
      return createPreviewGame(false);
    case "game-actions":
    case "game-paused":
      return createPreviewGame(true);
    case "game-discard":
      return createDiscardPreviewGame();
    case "game-results":
      return createResultsPreviewGame("player-3");
    case "game-won":
      return createResultsPreviewGame("player-1");
    case "game-setup":
      return createSetupPreviewGame();
    case "game-trade-confirm":
      return createTradeConfirmPreviewGame();
    case "game-trade-offer":
      return createTradeOfferPreviewGame();
    case "game-trade-watch":
      return createTradeWatchPreviewGame();
    case "game-waiting":
      // Another player's turn after their roll: the viewer's hand and dock while they wait.
      return givePreviewPlayerEveryDevelopmentCard(
        createPreviewState({ activePlayerId: "player-3", showActions: true }),
      );
    case "game-cities":
      return createCitiesPreviewGame();
  }
}

function createPreviewState({
  activePlayerId = "player-1",
  balancedDice = false,
  seed = "reference-ui-preview",
  showActions,
}: {
  activePlayerId?: string;
  balancedDice?: boolean;
  seed?: string;
  showActions: boolean;
}) {
  let state = completePreviewSetup(
    createDefaultGame(PREVIEW_PLAYERS, seed, {
      balancedDice,
      friendlyRobber: false,
      victoryPoints: 10,
    }),
  );
  const resources: ResourceInventory = {
    ...emptyInventory(),
    brick: 1,
    sheep: 2,
    stone: 1,
    tree: showActions ? 4 : 3,
    wheat: 2,
  };

  state = replacePreviewPlayerResources(
    {
      ...state,
      activePlayerId,
      lastDiceRoll: showActions ? { first: 3, second: 5, sum: 8 } : null,
      phase: showActions ? { kind: "build_and_trade" } : { kind: "roll" },
      turnNumber: 5,
    },
    "player-1",
    resources,
  );

  assertGameState(state);
  return state;
}

function createPreviewGame(showActions: boolean, seed?: string): GameState {
  return givePreviewPlayerEveryDevelopmentCard(createPreviewState({ seed, showActions }));
}

function givePreviewPlayerEveryDevelopmentCard(state: GameState): GameState {
  const developmentDeck = [...state.developmentDeck];
  const developmentCards = DEVELOPMENT_CARD_TYPES.map((card) => {
    const cardIndex = developmentDeck.indexOf(card);
    if (cardIndex < 0) {
      throw new Error(`Preview game requires a ${card} development card`);
    }
    developmentDeck.splice(cardIndex, 1);
    return card;
  });

  return {
    ...state,
    developmentDeck,
    players: state.players.map((player) =>
      player.id === "player-1"
        ? {
            ...player,
            developmentCards: [...player.developmentCards, ...developmentCards],
          }
        : player,
    ),
  };
}

/** A short game to 3 points that the winner closed out with a victory point card. */
function createResultsPreviewGame(winnerPlayerId: string): GameState {
  const state = createPreviewState({ activePlayerId: winnerPlayerId, showActions: false });
  const victoryPointIndex = state.developmentDeck.indexOf("victory-point");
  if (victoryPointIndex < 0) {
    throw new Error("Results preview needs a victory point card");
  }

  return {
    ...state,
    developmentDeck: state.developmentDeck.filter((_, index) => index !== victoryPointIndex),
    phase: { kind: "finished" },
    players: state.players.map((player) =>
      player.id === winnerPlayerId
        ? { ...player, developmentCards: [...player.developmentCards, "victory-point"] }
        : player,
    ),
    settings: { ...state.settings, victoryPoints: 3 },
    turnNumber: 18,
    winnerPlayerId,
  };
}

const PREVIEW_TRADE_GIVE: ResourceInventory = { ...emptyInventory(), sheep: 1 };
const PREVIEW_TRADE_WANT: ResourceInventory = { ...emptyInventory(), tree: 1 };
const PREVIEW_TRADE_PARTNER_HAND: ResourceInventory = { ...emptyInventory(), tree: 2, wheat: 1 };

function proposePreviewTrade(
  state: GameState,
  proposerPlayerId: string,
  recipientPlayerIds: string[],
): GameState {
  return applyCommand(state, proposerPlayerId, {
    give: PREVIEW_TRADE_GIVE,
    kind: "propose_trade",
    recipientPlayerIds,
    want: PREVIEW_TRADE_WANT,
  });
}

function answerPreviewTrade(state: GameState, playerId: string, accept: boolean): GameState {
  if (!state.tradeOffer) {
    throw new Error("Trade preview needs an open offer");
  }
  return applyCommand(state, playerId, {
    accept,
    kind: "respond_trade",
    offerActionNumber: state.tradeOffer.offerActionNumber,
  });
}

/** The viewer is asked for a card by Bartholomew. */
function createTradeOfferPreviewGame(): GameState {
  const state = replacePreviewPlayerResources(
    createPreviewState({ activePlayerId: "player-3", showActions: true }),
    "player-3",
    PREVIEW_TRADE_GIVE,
  );
  return proposePreviewTrade(state, "player-3", ["player-1"]);
}

/** The viewer's own offer: Bartholomew accepted, Peter Bot declined and Mira hasn't answered. */
function createTradeConfirmPreviewGame(): GameState {
  let state = createPreviewState({ showActions: true });
  for (const playerId of ["player-2", "player-3", "player-4"]) {
    state = replacePreviewPlayerResources(state, playerId, PREVIEW_TRADE_PARTNER_HAND);
  }
  state = proposePreviewTrade(state, "player-1", ["player-2", "player-3", "player-4"]);
  state = answerPreviewTrade(state, "player-3", true);
  return answerPreviewTrade(state, "player-4", false);
}

/**
 * The viewer's build-and-trade turn with a city for Bartholomew and one for the viewer, built
 * through the rules so pieces and scores stay consistent; both hands end as they started.
 */
function createCitiesPreviewGame(): GameState {
  const state = upgradePreviewSettlement(
    createPreviewState({ activePlayerId: "player-3", showActions: true }),
    "player-3",
  );
  return givePreviewPlayerEveryDevelopmentCard(
    upgradePreviewSettlement({ ...state, activePlayerId: "player-1" }, "player-1"),
  );
}

function upgradePreviewSettlement(state: GameState, playerId: string): GameState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  const settlement = state.board.buildings.find(
    (building) => building.playerId === playerId && building.kind === "settlement",
  );
  if (!player || !settlement) throw new Error(`Preview game requires a settlement for ${playerId}`);
  const funded = replacePreviewPlayerResources(state, playerId, {
    ...player.resources,
    stone: player.resources.stone + 3,
    wheat: player.resources.wheat + 2,
  });
  return applyCommand(funded, playerId, { kind: "build_city", vertexKey: settlement.vertexKey });
}

/** Someone else's trade, which the viewer only watches. */
function createTradeWatchPreviewGame(): GameState {
  let state = createPreviewState({ activePlayerId: "player-3", showActions: true });
  state = replacePreviewPlayerResources(state, "player-3", PREVIEW_TRADE_GIVE);
  state = replacePreviewPlayerResources(state, "player-4", PREVIEW_TRADE_PARTNER_HAND);
  state = proposePreviewTrade(state, "player-3", ["player-2", "player-4"]);
  return answerPreviewTrade(state, "player-4", true);
}

function createDiscardPreviewGame(): GameState {
  const state = applyCommand(
    createPreviewState({
      balancedDice: true,
      seed: "reference-discard-preview",
      showActions: false,
    }),
    "player-1",
    { kind: "roll" },
  );
  if (getLegalActions(state, "player-1").discardCount === null) {
    throw new Error("Discard preview requires a viewer discard");
  }
  return state;
}

function replacePreviewPlayerResources(
  state: GameState,
  playerId: string,
  resources: ResourceInventory,
): GameState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new Error(`Preview game requires ${playerId}`);
  const bank = { ...state.bank };
  for (const resource of RESOURCE_TYPES) {
    bank[resource] -= resources[resource] - player.resources[resource];
  }

  return {
    ...state,
    bank,
    players: state.players.map((candidate) =>
      candidate.id === playerId ? { ...candidate, resources } : candidate,
    ),
  };
}

function createPreviewView(state: GameState) {
  assertGameState(state);
  const view = toPlayerView(state, "player-1");
  assertPlayerGameView(view);
  return view;
}

function createSetupPreviewGame() {
  return createDefaultGame(PREVIEW_PLAYERS, "reference-setup-preview", {
    balancedDice: false,
    friendlyRobber: false,
    victoryPoints: 10,
  });
}

function completePreviewSetup(initialState: GameState) {
  let state = initialState;

  while (state.phase.kind === "setup_settlement" || state.phase.kind === "setup_road") {
    const actorPlayerId = state.activePlayerId;
    const legal = getLegalActions(state, actorPlayerId);

    if (state.phase.kind === "setup_settlement") {
      const vertexKey = legal.settlementVertexKeys[0];
      if (!vertexKey) {
        break;
      }
      state = applyCommand(state, actorPlayerId, { kind: "place_settlement", vertexKey });
      continue;
    }

    const edgeKey = legal.roadEdgeKeys[0];
    if (!edgeKey) {
      break;
    }
    state = applyCommand(state, actorPlayerId, { edgeKey, kind: "place_road" });
  }

  return state;
}

type PreviewEventRow = readonly [actorPlayerId: string, text: string, kind: RoomEventView["kind"]];

const PREVIEW_GAME_STARTED: PreviewEventRow = [
  "player-1",
  "Game started with 3 human players and 1 bot.",
  "game_started",
];

// The table up to the viewer's fifth turn, in the backend's words: setup, then one round.
const PREVIEW_HISTORY: readonly PreviewEventRow[] = [
  PREVIEW_GAME_STARTED,
  ["player-1", `${VIEWER_NAME} placed a settlement.`, "place_settlement"],
  ["player-1", `${VIEWER_NAME} placed a road.`, "place_road"],
  ["player-2", "Mira placed a settlement.", "place_settlement"],
  ["player-2", "Mira placed a road.", "place_road"],
  ["player-3", "Bartholomew Longbeard placed a settlement.", "place_settlement"],
  ["player-3", "Bartholomew Longbeard placed a road.", "place_road"],
  ["player-4", "Peter Bot placed a settlement.", "place_settlement"],
  ["player-4", "Peter Bot placed a road.", "place_road"],
  ["player-4", "Peter Bot placed a settlement.", "place_settlement"],
  ["player-4", "Peter Bot placed a road.", "place_road"],
  ["player-3", "Bartholomew Longbeard placed a settlement.", "place_settlement"],
  ["player-3", "Bartholomew Longbeard placed a road.", "place_road"],
  ["player-2", "Mira placed a settlement.", "place_settlement"],
  ["player-2", "Mira placed a road.", "place_road"],
  ["player-1", `${VIEWER_NAME} placed a settlement.`, "place_settlement"],
  ["player-1", `${VIEWER_NAME} placed a road.`, "place_road"],
  ["player-1", `${VIEWER_NAME} rolled 4 + 3 (7).`, "roll"],
  [
    "player-1",
    `${VIEWER_NAME} moved the robber and stole a resource from Peter Bot.`,
    "move_robber_and_steal",
  ],
  ["player-1", `${VIEWER_NAME} ended the turn.`, "end_turn"],
  ["player-2", `Mira rolled 6 + 2 (8). ${VIEWER_NAME} +1 Wood, Mira +1 Wheat.`, "roll"],
  ["player-2", "Mira traded 4 Sheep for 1 Stone.", "trade_bank"],
  ["player-2", "Mira ended the turn.", "end_turn"],
  ["player-3", "Bartholomew Longbeard rolled 5 + 5 (10). Bartholomew Longbeard +2 Brick.", "roll"],
  ["player-3", "Bartholomew Longbeard bought a development card.", "buy_development_card"],
  ["player-3", "Bartholomew Longbeard ended the turn.", "end_turn"],
  ["player-4", "Peter Bot rolled 3 + 3 (6).", "roll"],
  ["player-4", "Peter Bot ended the turn.", "end_turn"],
];

const PREVIEW_OFFER_TEXT = "offered 1 Sheep for 1 Wood.";

/**
 * The log that goes with a preview state, so it never contradicts the table: nothing but the
 * start during the opening placements; otherwise the history, then this turn's roll (the dice on
 * the phase line) and the trade moves that led to the state.
 */
function createPreviewEvents(mode: GamePreviewMode, state: GameState): RoomEventView[] {
  const nameOf = (playerId: string) =>
    PREVIEW_PLAYERS.find((player) => player.id === playerId)?.displayName ?? "Crew";
  const rows: PreviewEventRow[] = [];
  if (mode === "game-setup") {
    rows.push(PREVIEW_GAME_STARTED);
  } else {
    rows.push(...PREVIEW_HISTORY);
    const roll = state.lastDiceRoll;
    if (roll && state.phase.kind !== "roll" && state.phase.kind !== "finished") {
      const actor = state.activePlayerId;
      // The fixture's hand holds one more Wood once the dice are in (createPreviewState).
      const production = roll.sum === 7 ? "" : ` ${VIEWER_NAME} +1 Wood.`;
      rows.push([
        actor,
        `${nameOf(actor)} rolled ${roll.first} + ${roll.second} (${roll.sum}).${production}`,
        "roll",
      ]);
    }
    const offer = state.tradeOffer;
    if (offer) {
      rows.push([
        offer.proposerPlayerId,
        `${nameOf(offer.proposerPlayerId)} ${PREVIEW_OFFER_TEXT}`,
        "propose_trade",
      ]);
      for (const playerId of offer.acceptedPlayerIds) {
        rows.push([playerId, `${nameOf(playerId)} accepted the trade offer.`, "respond_trade"]);
      }
      for (const playerId of offer.rejectedPlayerIds) {
        rows.push([playerId, `${nameOf(playerId)} declined the trade offer.`, "respond_trade"]);
      }
    }
    if (state.phase.kind === "finished" && state.winnerPlayerId) {
      rows.push([
        state.winnerPlayerId,
        `${nameOf(state.winnerPlayerId)} bought a development card.`,
        "buy_development_card",
      ]);
    }
  }

  return rows.map(([actorPlayerId, text, kind], index) =>
    createPreviewEvent(index, actorPlayerId, text, kind),
  );
}

function createPreviewEvent(
  index: number,
  actorPlayerId: string,
  text: string,
  kind: RoomEventView["kind"],
  targetPlayerId?: string,
): RoomEventView {
  return {
    actorPlayerId,
    createdAt: PREVIEW_EVENT_ANCHOR + index * 45_000,
    // Fixture ids never reach Convex.
    id: `preview-event-${index + 1}` as Id<"gameActions">,
    kind,
    ...(targetPlayerId ? { targetPlayerId } : {}),
    text,
  };
}

const PREVIEW_EVENT_ANCHOR = Date.UTC(2026, 6, 19, 22, 30);

/* ---------------------------------------------------------------------------------------------
   Action card poster
   ------------------------------------------------------------------------------------------ */

function ActionPresetPreview() {
  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-background p-6"
      id="main-content"
    >
      <Card>
        <header className="space-y-1 text-center">
          <p>Reusable UI preset</p>
          <h1 id="action-preset-title">Action cards</h1>
          <span>The same component scales from the live dock to this poster treatment.</span>
        </header>
        <div className="flex flex-wrap justify-center gap-3">
          {ACTION_PRESET_TILES.map((tile) => (
            <ActionTile
              ariaLabel={`${tile.title} action-card preset`}
              art={
                <Image
                  alt=""
                  className="h-16 w-16 object-contain"
                  draggable={false}
                  height={512}
                  loading="eager"
                  sizes="7.5rem"
                  src={tile.src}
                  width={512}
                />
              }
              caption={tile.caption}
              count={tile.count}
              key={tile.kind}
              kind={tile.kind}
              meta={tile.meta}
              onClick={() => undefined}
              size="poster"
              title={tile.title}
            />
          ))}
        </div>
      </Card>
    </main>
  );
}

interface ActionPresetPreviewTile {
  caption: string;
  count?: number | string;
  kind: string;
  meta: string;
  src: string;
  title: string;
}

const ACTION_PRESET_TILES: readonly ActionPresetPreviewTile[] = [
  {
    caption: "Bank or players",
    kind: "trade",
    meta: "Open market",
    src: ACTION_CARD_ASSET_PATHS.trade,
    title: "Trade",
  },
  {
    caption: "Draw the top card",
    count: 25,
    kind: "development-card",
    meta: "Sheep · wheat · stone",
    src: DEVELOPMENT_CARD_BACK_ASSET_PATH,
    title: "Dev Card",
  },
  {
    caption: "Place on a glowing edge",
    count: 13,
    kind: "road",
    meta: "1 wood · 1 brick",
    src: ACTION_CARD_ASSET_PATHS.road,
    title: "Road",
  },
  {
    caption: "Build on a legal corner",
    count: 3,
    kind: "settlement",
    meta: "Wood · brick · sheep · wheat",
    src: ACTION_CARD_ASSET_PATHS.settlement,
    title: "Settlement",
  },
  {
    caption: "Upgrade a settlement",
    count: 4,
    kind: "city",
    meta: "2 wheat · 3 stone",
    src: ACTION_CARD_ASSET_PATHS.city,
    title: "City",
  },
  {
    caption: "Pass play clockwise",
    kind: "end-turn",
    meta: "Turn complete",
    src: END_TURN_ICON_ASSET_PATH,
    title: "End Turn",
  },
];
