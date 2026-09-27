import type { Metadata } from "next";
import Link from "next/link";

import { MenuScreen, MenuScreenText } from "@/components/app/menu-screen";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <MenuScreen
      actions={
        <Link className={buttonVariants({ size: "game-md", variant: "game-gold" })} href="/">
          Go home
        </Link>
      }
      title="Page not found"
    >
      <MenuScreenText>
        There&apos;s no game at this address. Check the link, or go home to start a new one.
      </MenuScreenText>
    </MenuScreen>
  );
}
