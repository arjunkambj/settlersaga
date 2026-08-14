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

export type DieFaceTone = "ivory" | "ember";

export function DieFace({ tone = "ivory", value }: { tone?: DieFaceTone; value: number }) {
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
        <g className="die-face__pip" key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="2.42" />
          <circle className="die-face__pip-core" cx={x - 0.38} cy={y - 0.46} r="1.18" />
        </g>
      ))}
    </svg>
  );
}
