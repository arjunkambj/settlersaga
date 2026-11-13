import Image, { type StaticImageData } from "next/image";

import hostIslandArt from "../../../public/home-assets/menu/host-island.png";
import joinCrewArt from "../../../public/home-assets/menu/join-crew.png";
import quickMatchArt from "../../../public/home-assets/menu/quick-match.png";

const WAYS_TO_PLAY: readonly { art: StaticImageData; copy: string; title: string }[] = [
  { art: hostIslandArt, copy: "Invite your friends", title: "Host a game" },
  { art: quickMatchArt, copy: "Play against bots now", title: "Quick match" },
  { art: joinCrewArt, copy: "Got a code? Join in", title: "Join a game" },
];

/**
 * A first-time visitor's glimpse of the menu, right under the sign-in card: the three ways to
 * play, as small pictures. The rules and the usual questions live on the how-to-play page.
 */
export function HomeLanding() {
  return (
    <ul
      aria-label="Three ways to play"
      className="m-0 grid w-full list-none grid-cols-3 gap-3 self-start p-0"
    >
      {WAYS_TO_PLAY.map((way) => (
        <li
          className="game-menu-panel flex min-w-0 flex-col items-center gap-1 px-2 py-3 text-center"
          key={way.title}
        >
          <Image
            alt=""
            className="size-14 object-contain sm:size-20"
            placeholder="blur"
            sizes="(min-width: 640px) 80px, 56px"
            src={way.art}
          />
          <h2 className="game-title m-0 text-sm sm:text-base">{way.title}</h2>
          <p className="m-0 text-xs font-medium text-pretty text-ui-text-soft sm:text-sm">
            {way.copy}
          </p>
        </li>
      ))}
    </ul>
  );
}
