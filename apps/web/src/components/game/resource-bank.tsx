import { RESOURCE_ORDER, type ResourceInventory, type ResourceType } from "@settersaga/game";
import Image from "next/image";

import {
  DEVELOPMENT_CARD_BACK_ASSET_PATH,
  RESOURCE_CARD_ASSET_PATHS,
} from "@/constants/game/card-assets";
import { RESOURCE_LABELS } from "@/constants/game/labels";
import { getFlightEndpointKey } from "@/lib/game/card-flights";
import { HOUSE_RULE_OPTIONS } from "@/lib/lobby/house-rules";

import { useShownCount } from "./card-flight-context";

const [HIDDEN_BANK_RULE] = HOUSE_RULE_OPTIONS.filter((rule) => rule.value === "hideBankCards");

/** What the shared supply has left: one card per resource plus the development deck. */
export function ResourceBank({
  bank,
  developmentCardSupply,
}: {
  /** Null when the host hides bank counts. */
  bank: ResourceInventory | null;
  developmentCardSupply: number;
}) {
  const developmentCards = (
    <BankCard
      count={developmentCardSupply}
      flightPile="development"
      image={DEVELOPMENT_CARD_BACK_ASSET_PATH}
      label="Development cards"
    />
  );

  return (
    <section aria-labelledby="game-bank-title" className="game-bank game-panel" data-bank>
      <h3 className="game-panel-heading game-bank-title" id="game-bank-title">
        Bank
      </h3>
      {bank ? (
        <ul className="game-bank-cards">
          {RESOURCE_ORDER.map((resource) => (
            <BankCard
              count={bank[resource]}
              flightPile={resource}
              image={RESOURCE_CARD_ASSET_PATHS[resource]}
              key={resource}
              label={RESOURCE_LABELS[resource]}
            />
          ))}
          {developmentCards}
        </ul>
      ) : (
        <ul className="game-bank-cards">
          <li className="game-bank-hidden">
            <Image
              alt=""
              draggable={false}
              height={128}
              src={HIDDEN_BANK_RULE.artSrc}
              width={128}
            />
            <p className="m-0">Resource counts are hidden this game</p>
          </li>
          {developmentCards}
        </ul>
      )}
    </section>
  );
}

/**
 * One pile of the bank. Cards that fly to or from the bank land on their `flightPile`, whose number
 * changes as they land or leave; the sr-only line always gives the real count.
 */
function BankCard({
  count,
  flightPile,
  image,
  label,
}: {
  count: number;
  flightPile: ResourceType | "development";
  image: string;
  label: string;
}) {
  const shownCount = useShownCount(
    getFlightEndpointKey(
      flightPile === "development"
        ? { kind: "bank-development" }
        : { kind: "bank", resource: flightPile },
    ),
    count,
  );
  return (
    <li
      className="game-bank-card"
      data-bank-dev={flightPile === "development" || undefined}
      data-bank-resource={flightPile === "development" ? undefined : flightPile}
      data-empty={shownCount === 0 || undefined}
    >
      <Image alt="" draggable={false} height={96} src={image} width={64} />
      <span aria-hidden="true" className="game-bank-count">
        {shownCount}
      </span>
      <span className="sr-only">
        {label}: {count} left
      </span>
    </li>
  );
}
