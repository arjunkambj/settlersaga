import type { GameCommand, GameState, ResourceInventory } from "@settersaga/game";

import { MAX_SEATS } from "./constants";
import { fail } from "./errors";
import { validateActionNumber } from "./normalize";

function serializableInventory(inventory: ResourceInventory) {
  return {
    brick: inventory.brick,
    sheep: inventory.sheep,
    stone: inventory.stone,
    tree: inventory.tree,
    wheat: inventory.wheat,
  };
}

function validInventory(inventory: ResourceInventory): boolean {
  return Object.values(inventory).every(
    (quantity) => Number.isSafeInteger(quantity) && quantity >= 0,
  );
}

export function serializeCommand(command: GameCommand): string {
  switch (command.kind) {
    case "place_settlement":
      return JSON.stringify({ kind: command.kind, vertexKey: command.vertexKey });
    case "place_road":
      return JSON.stringify({ edgeKey: command.edgeKey, kind: command.kind });
    case "discard":
      return JSON.stringify({
        kind: command.kind,
        resources: serializableInventory(command.resources),
      });
    case "move_robber":
      return JSON.stringify({ kind: command.kind, tileId: command.tileId });
    case "steal":
      return JSON.stringify({ kind: command.kind, victimPlayerId: command.victimPlayerId });
    case "build_city":
      return JSON.stringify({ kind: command.kind, vertexKey: command.vertexKey });
    case "play_monopoly":
      return JSON.stringify({ kind: command.kind, resource: command.resource });
    case "play_year_of_plenty":
      return JSON.stringify({
        kind: command.kind,
        resources: serializableInventory(command.resources),
      });
    case "trade_bank":
      return JSON.stringify({ give: command.give, kind: command.kind, receive: command.receive });
    case "propose_trade":
      return JSON.stringify({
        give: serializableInventory(command.give),
        kind: command.kind,
        recipientPlayerIds: [...command.recipientPlayerIds],
        want: serializableInventory(command.want),
      });
    case "respond_trade":
      return JSON.stringify({
        accept: command.accept,
        kind: command.kind,
        offerActionNumber: command.offerActionNumber,
      });
    case "cancel_trade":
      return JSON.stringify({
        kind: command.kind,
        offerActionNumber: command.offerActionNumber,
      });
    case "buy_development_card":
    case "play_knight":
    case "play_road_building":
    case "roll":
    case "end_turn":
      return JSON.stringify({ kind: command.kind });
  }
}

export function parseCommandKind(commandJson: string): string {
  try {
    const command: unknown = JSON.parse(commandJson);
    if (
      command &&
      typeof command === "object" &&
      "kind" in command &&
      typeof command.kind === "string"
    ) {
      return command.kind;
    }
  } catch {
    // Stored commands are validated when written; malformed historical data is displayed as unknown.
  }

  return "unknown";
}

export function commandEventKind(
  command: GameCommand,
  state: GameState,
  nextState: GameState,
): string {
  return command.kind === "move_robber" && nextState.randomIndex === state.randomIndex + 1
    ? "move_robber_and_steal"
    : command.kind;
}

export function commandText(
  command: GameCommand,
  displayName: string,
  state: GameState,
  nextState: GameState,
): string {
  switch (command.kind) {
    case "place_settlement":
      return `${displayName} placed a settlement.`;
    case "place_road":
      return `${displayName} placed a road.`;
    case "roll": {
      const roll = nextState.lastDiceRoll;
      return roll
        ? `${displayName} rolled ${roll.first} + ${roll.second} (${roll.sum}).`
        : `${displayName} rolled the dice.`;
    }
    case "discard":
      return `${displayName} discarded resources.`;
    case "move_robber":
      return commandEventKind(command, state, nextState) === "move_robber_and_steal"
        ? `${displayName} moved the robber and stole a resource.`
        : `${displayName} moved the robber.`;
    case "steal":
      return `${displayName} stole a resource.`;
    case "build_city":
      return `${displayName} upgraded a settlement to a city.`;
    case "buy_development_card":
      return `${displayName} bought a development card.`;
    case "play_knight":
      return `${displayName} played a Knight.`;
    case "play_monopoly":
      return `${displayName} played Monopoly on ${command.resource}.`;
    case "play_road_building":
      return `${displayName} played Road Building.`;
    case "play_year_of_plenty":
      return `${displayName} played Year of Plenty.`;
    case "trade_bank":
      return `${displayName} traded ${command.give} for ${command.receive}.`;
    case "propose_trade":
      return `${displayName} proposed a player trade.`;
    case "respond_trade":
      return command.accept
        ? `${displayName} accepted a player trade.`
        : `${displayName} declined a player trade.`;
    case "cancel_trade":
      return `${displayName} cancelled a player trade.`;
    case "end_turn":
      return `${displayName} ended the turn.`;
  }
}

export function validateCommandBounds(command: GameCommand): void {
  const boundedKey = (value: string) => value.length > 0 && value.length <= 128;
  switch (command.kind) {
    case "place_settlement":
    case "build_city":
      if (!boundedKey(command.vertexKey)) fail("INVALID_COMMAND", "Invalid vertex key.");
      return;
    case "place_road":
      if (!boundedKey(command.edgeKey)) fail("INVALID_COMMAND", "Invalid edge key.");
      return;
    case "move_robber":
      if (!boundedKey(command.tileId)) fail("INVALID_COMMAND", "Invalid tile ID.");
      return;
    case "steal":
      if (!boundedKey(command.victimPlayerId)) fail("INVALID_COMMAND", "Invalid victim ID.");
      return;
    case "discard":
      if (!validInventory(command.resources)) fail("INVALID_COMMAND", "Invalid discard inventory.");
      return;
    case "play_year_of_plenty":
      if (!validInventory(command.resources)) {
        fail("INVALID_COMMAND", "Invalid Year of Plenty inventory.");
      }
      return;
    case "propose_trade":
      if (!validInventory(command.give) || !validInventory(command.want)) {
        fail("INVALID_COMMAND", "Invalid player trade inventory.");
      }
      if (
        command.recipientPlayerIds.length < 1 ||
        command.recipientPlayerIds.length >= MAX_SEATS ||
        new Set(command.recipientPlayerIds).size !== command.recipientPlayerIds.length ||
        command.recipientPlayerIds.some((playerId) => !boundedKey(playerId))
      ) {
        fail("INVALID_COMMAND", "Invalid player trade recipients.");
      }
      return;
    case "respond_trade":
    case "cancel_trade":
      validateActionNumber(command.offerActionNumber);
      return;
    case "trade_bank":
    case "play_monopoly":
    case "buy_development_card":
    case "play_knight":
    case "play_road_building":
    case "roll":
    case "end_turn":
      return;
  }
}
