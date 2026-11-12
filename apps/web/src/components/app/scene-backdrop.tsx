import Image from "next/image";

export function SceneBackdrop() {
  return (
    <div aria-hidden="true" className="scene-backdrop">
      <Image
        alt=""
        className="scene-backdrop-art"
        fill
        preload
        quality={90}
        // The art covers the screen. On a screen taller than 16:9 it is scaled by height, so it
        // is drawn wider than the screen and needs that many pixels.
        sizes="(max-aspect-ratio: 16/9) 178vh, 100vw"
        src="/shared-assets/coastal-island-kingdom.webp"
      />
    </div>
  );
}
