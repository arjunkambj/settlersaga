import type { SVGProps } from "react";

/**
 * Plain bold plus and minus glyphs for steppers. The round icon buttons already draw the circle,
 * so these are bare strokes rather than Solar's circled icons. They take the button's text color.
 */
export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth={3} />
    </svg>
  );
}

export function MinusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <path d="M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth={3} />
    </svg>
  );
}
