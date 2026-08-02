import Image from "next/image";

const APP_SCENERY_SRC = "/shared-assets/coastal-island-kingdom-supercell.png";

export function AppScenery() {
  return (
    <div className="app-scenery" aria-hidden="true">
      <Image
        alt=""
        className="app-scenery__image"
        fill
        priority
        sizes="100vw"
        src={APP_SCENERY_SRC}
      />
    </div>
  );
}
