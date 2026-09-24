import type { GameCommand, PlayerGameView } from "@settersaga/game";
import Image from "next/image";

import { UNKNOWN_RESOURCE_CARD_ASSET_PATH } from "@/constants/game/card-assets";
import { getPlayerColor } from "@/lib/game/view";

import { DockPortrait } from "./dock-portrait";

/** Each player the robber can rob, as a portrait plaque with how many cards they hold. */
export function StealChooser({
  game,
  onCommand,
  pending,
}: {
  game: PlayerGameView;
  onCommand(command: GameCommand, message: string): void;
  pending: boolean;
}) {
  return (
    <section aria-label="Pick a player to steal from" className="game-steal-chooser">
      {game.legalActions.victimPlayerIds.map((playerId) => {
        const player = game.players.find((candidate) => candidate.id === playerId);
        if (!player) {
          return null;
        }
        const cards = `${player.resourceCount} ${player.resourceCount === 1 ? "card" : "cards"}`;
        return (
          <button
            aria-label={`Steal from ${player.displayName}, ${cards}`}
            className={`game-steal-plaque player-${getPlayerColor(player)}`}
            disabled={pending}
            key={playerId}
            onClick={() =>
              onCommand(
                { kind: "steal", victimPlayerId: playerId },
                `You stole a card from ${player.displayName}.`,
              )
            }
            type="button"
          >
            <span className="game-steal-portrait">
              <DockPortrait player={player} />
              <span aria-hidden="true" className="game-steal-cards">
                <Image
                  alt=""
                  className="game-steal-cards-art"
                  draggable={false}
                  height={768}
                  sizes="1.5rem"
                  src={UNKNOWN_RESOURCE_CARD_ASSET_PATH}
                  width={512}
                />
                {player.resourceCount}
              </span>
            </span>
            <span aria-hidden="true" className="game-steal-name">
              {player.displayName}
            </span>
          </button>
        );
      })}
    </section>
  );
}
