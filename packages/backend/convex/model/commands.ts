import { RESOURCE_ORDER, totalResources } from "@settersaga/game";
import type { GameCommand, GameState, ResourceInventory, ResourceType } from "@settersaga/game";

import type { GameEventKind } from "./validators";

const RESOURCE_NAMES: Readonly<Record<ResourceType, string>> = {
  brick: "Brick",
  sheep: "Sheep",
  stone: "Stone",
  tree: "Wood",
  wheat: "Wheat",
};

/** JSON with sorted object keys, so a retried command compares equal whatever its key order. */
export function serializeCommand(command: GameCommand): string {
  return JSON.stringify(command, (_key, value: unknown) =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
        )
      : value,
  );
}

/**
 * The other player a logged move names in its text, so the room may know them: a confirmed
 * trade's partner. Nothing for any other move.
 */
export function commandTargetPlayerId(command: GameCommand): string | undefined {
  return command.kind === "confirm_trade" ? command.partnerPlayerId : undefined;
}

export function countOf(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function findPlayer(state: GameState, playerId: string) {
  return state.players.find((player) => player.id === playerId);
}

function playerName(state: GameState, playerId: string): string {
  return findPlayer(state, playerId)?.displayName ?? "another player";
}

function handSize(state: GameState, playerId: string): number {
  const player = findPlayer(state, playerId);
  return player ? totalResources(player.resources) : 0;
}

function resourceChange(
  state: GameState,
  nextState: GameState,
  playerId: string,
  resource: ResourceType,
): number {
  return (
    (findPlayer(nextState, playerId)?.resources[resource] ?? 0) -
    (findPlayer(state, playerId)?.resources[resource] ?? 0)
  );
}

function formatResources(resources: ResourceInventory): string {
  return RESOURCE_ORDER.filter((resource) => resources[resource] > 0)
    .map((resource) => `${resources[resource]} ${RESOURCE_NAMES[resource]}`)
    .join(", ");
}

function formatProduction(state: GameState, nextState: GameState): string {
  return state.players
    .flatMap((player) => {
      const gains = RESOURCE_ORDER.flatMap((resource) => {
        const gained = resourceChange(state, nextState, player.id, resource);
        return gained > 0 ? [`+${gained} ${RESOURCE_NAMES[resource]}`] : [];
      });
      return gains.length > 0 ? [`${player.displayName} ${gains.join(" ")}`] : [];
    })
    .join(", ");
}

/** The player who lost a card to the actor during this command, if any. */
function stolenFrom(state: GameState, nextState: GameState, actorPlayerId: string) {
  return state.players.find(
    (player) =>
      player.id !== actorPlayerId && handSize(nextState, player.id) < handSize(state, player.id),
  );
}

export function commandEventKind(
  command: GameCommand,
  actorPlayerId: string,
  state: GameState,
  nextState: GameState,
): GameEventKind {
  // Moving the robber next to a single opponent steals from them in the same command.
  return command.kind === "move_robber" &&
    handSize(nextState, actorPlayerId) > handSize(state, actorPlayerId)
    ? "move_robber_and_steal"
    : command.kind;
}

export function commandText(
  command: GameCommand,
  actorPlayerId: string,
  state: GameState,
  nextState: GameState,
): string {
  const name = playerName(state, actorPlayerId);
  switch (command.kind) {
    case "place_settlement":
      return `${name} placed a settlement.`;
    case "place_road":
      return `${name} placed a road.`;
    case "roll": {
      const roll = nextState.lastDiceRoll;
      const production = formatProduction(state, nextState);
      const rolled = roll
        ? `${name} rolled ${roll.first} + ${roll.second} (${roll.sum}).`
        : `${name} rolled the dice.`;
      return production ? `${rolled} ${production}.` : rolled;
    }
    case "discard":
      return `${name} discarded ${countOf(totalResources(command.resources), "resource")}.`;
    case "move_robber": {
      const victim = stolenFrom(state, nextState, actorPlayerId);
      return victim
        ? `${name} moved the robber and stole a resource from ${victim.displayName}.`
        : `${name} moved the robber.`;
    }
    case "steal":
      return `${name} stole a resource from ${playerName(state, command.victimPlayerId)}.`;
    case "build_city":
      return `${name} upgraded a settlement to a city.`;
    case "buy_development_card":
      return `${name} bought a development card.`;
    case "play_knight":
      return `${name} played a Knight.`;
    case "play_monopoly": {
      const collected = resourceChange(state, nextState, actorPlayerId, command.resource);
      return `${name} played Monopoly on ${RESOURCE_NAMES[command.resource]} and collected ${collected}.`;
    }
    case "play_road_building":
      return `${name} played Road Building.`;
    case "play_year_of_plenty":
      return `${name} played Year of Plenty for ${formatResources(command.resources)}.`;
    case "trade_bank": {
      const given = -resourceChange(state, nextState, actorPlayerId, command.give);
      return `${name} traded ${given} ${RESOURCE_NAMES[command.give]} for 1 ${RESOURCE_NAMES[command.receive]}.`;
    }
    case "propose_trade":
      return `${name} offered ${formatResources(command.give)} for ${formatResources(command.want)}.`;
    case "respond_trade":
      return command.accept
        ? `${name} accepted the trade offer.`
        : `${name} declined the trade offer.`;
    case "confirm_trade":
      return `${name} traded with ${playerName(state, command.partnerPlayerId)}.`;
    case "cancel_trade":
      return `${name} cancelled the trade offer.`;
    case "end_turn":
      return `${name} ended the turn.`;
  }
}
