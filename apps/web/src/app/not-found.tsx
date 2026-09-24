import type { Metadata } from "next";
import Link from "next/link";

import { MenuScreen, MenuScreenText } from "@/components/app/menu-screen";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Lost at sea",
};

export default function NotFound() {
  return (
    <MenuScreen
      actions={
        <Link className={buttonVariants({ size: "game-md", variant: "game-gold" })} href="/">
          Sail home
        </Link>
      }
      title="Lost at sea"
    >
      <MenuScreenText>
        There&apos;s no Island at this address. Check the link, or sail home to start a new voyage.
      </MenuScreenText>
    </MenuScreen>
  );
}
