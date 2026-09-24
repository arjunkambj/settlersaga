import type { PlayerGameView } from "@settersaga/game";

const DIE_PIPS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[16, 14.65]],
  2: [
    [9.45, 8.85],
    [22.55, 20.45],
  ],
  3: [
    [9.45, 8.85],
    [16, 14.65],
    [22.55, 20.45],
  ],
  4: [
    [9.45, 8.85],
    [22.55, 8.85],
    [9.45, 20.45],
    [22.55, 20.45],
  ],
  5: [
    [9.45, 8.85],
    [22.55, 8.85],
    [16, 14.65],
    [9.45, 20.45],
    [22.55, 20.45],
  ],
  6: [
    [9.45, 8.85],
    [22.55, 8.85],
    [9.45, 14.65],
    [22.55, 14.65],
    [9.45, 20.45],
    [22.55, 20.45],
  ],
};

export function DieFace({ tone, value }: { tone: "ember" | "ivory"; value: number }) {
  const pips = DIE_PIPS[value] ?? [];

  return (
    <svg aria-hidden="true" className={`die-face die-face--${tone}`} viewBox="0 0 32 32">
      <ellipse className="die-face__shadow" cx="16" cy="30.55" rx="10.4" ry="1.25" />
      <rect className="die-face__base" height="26.2" rx="7.1" width="27.2" x="2.4" y="3.15" />
      <rect className="die-face__body" height="26.2" rx="7.1" width="27.2" x="2.4" y="1.55" />
      <rect className="die-face__well" height="22.4" rx="5.4" width="23.4" x="4.3" y="3.45" />
      <path
        className="die-face__shine"
        d="M8.1 5.15c4.7-1.45 12.8-1.35 16.4.85-.45 4.55-4.7 7.15-9.35 7.35C10.2 13.5 7.15 9.7 8.1 5.15Z"
      />
      {pips.map(([x, y]) => (
        <circle className="die-face__pip" cx={x} cy={y} key={`${x}-${y}`} r="2.42" />
      ))}
    </svg>
  );
}

/** The last roll as a pair of dice, optionally followed by its total. */
export function DiceRoll({
  className,
  roll,
  showTotal = false,
}: {
  className: string;
  roll: NonNullable<PlayerGameView["lastDiceRoll"]>;
  showTotal?: boolean;
}) {
  return (
    <div
      aria-label={`${roll.first} and ${roll.second}, total ${roll.sum}`}
      className={className}
      role="group"
    >
      <span aria-hidden="true" className="inline-flex items-center gap-1">
        <DieFace tone="ivory" value={roll.first} />
        <DieFace tone="ember" value={roll.second} />
      </span>
      {showTotal ? (
        <strong aria-hidden="true" className="game-dice-total">
          {roll.sum}
        </strong>
      ) : null}
    </div>
  );
}
