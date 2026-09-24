import { assertGameState, createBoard } from "@settersaga/game";
import type { GameState } from "@settersaga/game";

import { fail } from "./errors";

/** Tiles and ports follow from the map and seed, so only the pieces on the board are stored. */
type StoredGameState = Omit<GameState, "board"> & {
  board: Pick<GameState["board"], "buildings" | "roads" | "robberTileId">;
};

export function serializeGameState(state: GameState): string {
  try {
    assertGameState(state);
  } catch (error) {
    fail(
      "CORRUPT_GAME_STATE",
      error instanceof Error ? error.message : "Game state failed integrity validation.",
    );
  }
  const { buildings, roads, robberTileId } = state.board;
  const stored: StoredGameState = { ...state, board: { buildings, roads, robberTileId } };
  return JSON.stringify(stored);
}

/** Reads a state written by serializeGameState, which validated it before it was stored. */
export function parseGameState(stateJson: string): GameState {
  const stored: StoredGameState = JSON.parse(stateJson);
  return {
    ...stored,
    board: { ...createBoard(stored.settings.map, stored.seed), ...stored.board },
  };
}
