import { getImageProps } from "next/image";

// The backdrop is the first thing a menu screen paints, so the browser fetches it right away.
const COMMON = {
  alt: "",
  fetchPriority: "high",
  fill: true,
  loading: "eager",
  quality: 90,
} as const;

/**
 * The island art behind the menus. Wide screens get the bay with the village at its sides. Screens
 * taller than 2:3 (phones held upright) would crop that to open water, so they get a tall picture
 * with the shore along the bottom; menu.css keeps that shore in view with the same media query.
 */
export function SceneBackdrop() {
  const tall = getImageProps({
    ...COMMON,
    // Drawn as wide as the screen, or wider on a screen taller than the 6:13 art.
    sizes: "max(100vw, 47vh)",
    src: "/shared-assets/coastal-lagoon-tall.webp",
  }).props;
  const { srcSet: wideSrcSet, ...wide } = getImageProps({
    ...COMMON,
    // On a screen taller than 16:9 the art is scaled by height, so it is drawn wider than the
    // screen and needs that many pixels.
    sizes: "(max-aspect-ratio: 16/9) 178vh, 100vw",
    src: "/shared-assets/coastal-lagoon.webp",
  }).props;

  return (
    <div aria-hidden="true" className="scene-backdrop">
      <picture>
        <source media="(max-aspect-ratio: 2/3)" sizes={tall.sizes} srcSet={tall.srcSet} />
        <source sizes={wide.sizes} srcSet={wideSrcSet} />
        <img {...wide} alt="" className="scene-backdrop-art" />
      </picture>
    </div>
  );
}
