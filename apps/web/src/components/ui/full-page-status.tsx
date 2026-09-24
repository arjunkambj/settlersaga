import Image from "next/image";

import { MenuScreen } from "@/components/app/menu-screen";

const LOADING_ART_PATH = "/game-assets/ui/loading-compass.png";

/** A full-screen "working on it" menu: the swaying compass above one status line. */
export function FullPageStatus({ label }: { label: string }) {
  return (
    <MenuScreen>
      <Image
        alt=""
        className="size-32 drop-shadow-lg motion-safe:animate-game-sway"
        height={512}
        preload
        sizes="128px"
        src={LOADING_ART_PATH}
        width={512}
      />
      <p aria-live="polite" className="game-title text-2xl" role="status">
        {label}
      </p>
    </MenuScreen>
  );
}
