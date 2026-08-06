"use client";

import {
  applyCommand,
  assertGameState,
  assertPlayerGameView,
  createDefaultGame,
  DEVELOPMENT_CARD_TYPES,
  emptyInventory,
  getLegalActions,
  RESOURCE_TYPES,
  toPlayerView,
  type GameCommand,
  type GamePlayerInput,
  type GameState,
  type ResourceInventory,
} from "@settersaga/game";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { AuthScreenView } from "@/components/auth/auth-screen";
import { ActionTile } from "@/components/game/action-tile";
import { GameScreen } from "@/components/game/game-screen";
import { HomeScreen } from "@/components/home/home-screen";
import { FullPageStatus } from "@/components/ui/full-page-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ACTION_CARD_ASSET_PATHS,
  DEVELOPMENT_CARD_BACK_ASSET_PATH,
} from "@/constants/game/card-assets";
import { END_TURN_ICON_ASSET_PATH } from "@/constants/game/ui-assets";
import { DEFAULT_AUDIO_SETTINGS } from "@/lib/audio-settings";
import type { RoomEventView } from "@/lib/game/types";

export type UiPreviewMode =
  | "action-preset"
  | "auth"
  | "game"
  | "game-actions"
  | "game-discard"
  | "game-results"
  | "game-setup"
  | "game-trade-offer"
  | "home";

type GamePreviewMode = Extract<UiPreviewMode, `game${string}`>;

const PREVIEW_MODES = new Set<UiPreviewMode>([
  "action-preset",
  "auth",
  "game",
  "game-actions",
  "game-discard",
  "game-results",
  "game-setup",
  "game-trade-offer",
  "home",
]);

const GAME_PREVIEW_MODES = new Set<UiPreviewMode>([
  "game",
  "game-actions",
  "game-discard",
  "game-results",
  "game-setup",
  "game-trade-offer",
]);

const PREVIEW_PLAYERS: GamePlayerInput[] = [
  { displayName: "Arjun Kamboj", id: "player-1", isBot: false },
  { displayName: "Kara Bot", id: "player-2", isBot: true },
  { displayName: "Clark Bot", id: "player-3", isBot: true },
  { displayName: "Peter Bot", id: "player-4", isBot: true },
];

export function isUiPreviewMode(value: string | null): value is UiPreviewMode {
  return value !== null && PREVIEW_MODES.has(value as UiPreviewMode);
}

export function isGamePreviewMode(mode: UiPreviewMode): mode is GamePreviewMode {
  return GAME_PREVIEW_MODES.has(mode);
}

export function UiPreview({ mode, seed }: { mode: UiPreviewMode; seed?: string }) {
  const [previewDeadline, setPreviewDeadline] = useState<number>();
  const [randomGameSeed, setRandomGameSeed] = useState<string>();

  useEffect(() => {
    if (!isGamePreviewMode(mode)) {
      setPreviewDeadline(undefined);
      return;
    }

    setPreviewDeadline(Date.now() + 45_000);
  }, [mode]);

  useEffect(() => {
    if (mode !== "game" || seed) {
      setRandomGameSeed(undefined);
      return;
    }

    setRandomGameSeed(window.crypto.randomUUID());
  }, [mode, seed]);

  if (mode === "auth") {
    return <AuthScreenView onSignIn={async () => undefined} />;
  }

  if (mode === "home") {
    return (
      <HomeScreen
        accountLabel="Level 24"
        audioSettings={DEFAULT_AUDIO_SETTINGS}
        displayName="Arjun Kamboj"
        error=""
        onAudioSettingsChange={() => undefined}
        onCreateRoom={async () => undefined}
        onDisplayNameChange={() => undefined}
        onJoinRoom={async () => undefined}
        onQuickPlay={async () => undefined}
        onSignOut={async () => undefined}
        pendingAction={null}
        profileImageUrl="/game-assets/players/red-navigator.png"
      />
    );
  }

  if (mode === "action-preset") {
    return <ActionPresetPreview />;
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
  const previewStateRef = useRef(previewState);
  const [isPaused, setIsPaused] = useState(false);

  const runCommand = async (command: GameCommand) => {
    const nextState = applyCommand(previewStateRef.current, "player-1", command);
    assertGameState(nextState);
    previewStateRef.current = nextState;
    setPreviewState(nextState);
  };

  return (
    <GameScreen
      audioSettings={DEFAULT_AUDIO_SETTINGS}
      botThinking={false}
      events={PREVIEW_EVENTS}
      game={createPreviewView(previewState)}
      isHost
      isPaused={isPaused}
      nextActionAt={previewDeadline}
      onCommand={runCommand}
      onLeave={async () => undefined}
      onPauseChange={async (shouldPause) => setIsPaused(shouldPause)}
      onReplacePlayer={async () => undefined}
      viewerProfileImageUrl="/game-assets/players/red-navigator.png"
    />
  );
}

function ActionPresetPreview() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6" id="main-content">
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
              disabled={tile.unavailable}
              key={tile.kind}
              kind={tile.kind}
              meta={tile.meta}
              onPress={() => undefined}
              size="poster"
              title={tile.title}
              unavailable={tile.unavailable}
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
  unavailable?: boolean;
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

function createGamePreviewState(mode: GamePreviewMode, seed?: string): GameState {
  switch (mode) {
    case "game-setup":
      return createSetupPreviewGame();
    case "game-results":
      return createResultsPreviewGame();
    case "game-trade-offer":
      return createTradeOfferPreviewGame();
    case "game-discard":
      return createDiscardPreviewGame();
    case "game-actions":
      return createPreviewGame(true);
    case "game":
      return createPreviewGame(false, seed);
  }
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

function createResultsPreviewGame() {
  const state = createPreviewState({ activePlayerId: "player-2", showActions: false });
  const victoryPointIndex = state.developmentDeck.indexOf("victory-point");
  if (victoryPointIndex < 0) throw new Error("Results preview needs a victory point card");
  const [victoryPointCard] = state.developmentDeck.splice(victoryPointIndex, 1);
  if (!victoryPointCard) throw new Error("Results preview could not draw a victory point card");
  state.players[1]!.developmentCards.push(victoryPointCard);

  return {
    ...state,
    phase: { kind: "finished" },
    settings: { ...state.settings, victoryPoints: 3 },
    status: "completed",
    winnerPlayerId: "player-2",
  } satisfies GameState;
}

function createTradeOfferPreviewGame() {
  const proposerResources: ResourceInventory = {
    ...emptyInventory(),
    sheep: 1,
  };
  let state = replacePreviewPlayerResources(
    createPreviewState({ activePlayerId: "player-2", showActions: true }),
    "player-2",
    proposerResources,
  );
  assertGameState(state);
  state = applyCommand(state, "player-2", {
    give: proposerResources,
    kind: "propose_trade",
    recipientPlayerIds: ["player-1"],
    want: {
      ...emptyInventory(),
      tree: 1,
    },
  });
  return state;
}

function createDiscardPreviewGame() {
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
) {
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

const PREVIEW_EVENT_ANCHOR = Date.UTC(2026, 6, 19, 22, 30);
const PREVIEW_EVENTS: RoomEventView[] = [
  ["Arjun placed a Settlement", "place_settlement"],
  ["Arjun received starting resources", "steal"],
  ["Arjun placed a Road", "place_road"],
  ["Kara Bot placed a Settlement", "place_settlement"],
  ["Kara Bot received starting resources", "steal"],
  ["Clark Bot placed a Road", "place_road"],
  ["Peter Bot placed a Settlement", "place_settlement"],
  ["Peter Bot received starting resources", "steal"],
].map(([text, kind], index) => ({
  actorPlayerId: index < 3 ? "player-1" : `player-${(index % 3) + 2}`,
  createdAt: PREVIEW_EVENT_ANCHOR - (8 - index) * 60_000,
  kind,
  sequence: index + 1,
  text,
}));
