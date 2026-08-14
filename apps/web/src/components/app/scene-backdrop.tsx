import Image from "next/image";

export function SceneBackdrop() {
  return (
    <div aria-hidden="true" className="scene-backdrop">
      <Image
        alt=""
        className="scene-backdrop-art"
        fill
        priority
        sizes="100vw"
        src="/shared-assets/coastal-island-kingdom-supercell.png"
      />
    </div>
  );
}
