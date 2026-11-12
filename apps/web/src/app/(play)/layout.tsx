import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { AppProviders } from "@/components/app/app-providers";

// The sign-in SDK keeps a returning player's session in a cookie with one of these names.
const SESSION_COOKIE = /(hexclave|stack)-refresh/;

export default async function PlayLayout({ children }: { children: ReactNode }) {
  // Only a hint for the first paint: a visitor with no saved sign-in (a new player, a search
  // engine) gets the welcome screen in the page itself rather than a loading screen. The browser
  // still checks the account for real and corrects the screen if the hint was wrong.
  const cookieStore = await cookies();
  const signedOut = !cookieStore.getAll().some(({ name }) => SESSION_COOKIE.test(name));

  return <AppProviders signedOut={signedOut}>{children}</AppProviders>;
}
