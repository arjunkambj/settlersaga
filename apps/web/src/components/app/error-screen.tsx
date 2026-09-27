"use client";

import Link from "next/link";

import { MenuScreen, MenuScreenText } from "@/components/app/menu-screen";
import { Button, buttonVariants } from "@/components/ui/button";
import { getErrorCode } from "@/lib/app/action-errors";

type Recovery = "home" | "retry" | "sign-in";

// Players see a short explanation for the server codes that can reach an error boundary, never the
// raw message (a Convex query error carries the function name, request id and JSON payload).
function describeError(error: Error): { message: string; recovery: Recovery } {
  switch (getErrorCode(error)) {
    case "UNAUTHENTICATED":
      return {
        message: "You've been signed out. Sign back in to keep playing.",
        recovery: "sign-in",
      };
    case "NOT_ROOM_MEMBER":
      return {
        message: "You don't have a seat in that game any more. Go home to find a new one.",
        recovery: "home",
      };
    case "CORRUPT_GAME_STATE":
      return {
        message: "We couldn't load that game. Go home and start a new one.",
        recovery: "home",
      };
    default:
      return {
        message: "Something broke on our end. Try again, or go home.",
        recovery: "retry",
      };
  }
}

export function ErrorScreen({ error, retry }: { error: Error; retry(): void }) {
  const { message, recovery } = describeError(error);

  return (
    <MenuScreen
      actions={
        <>
          {recovery === "retry" ? (
            <Button onClick={retry} size="game-md" variant="game-gold">
              Try again
            </Button>
          ) : null}
          {recovery === "sign-in" ? (
            <Button onClick={() => window.location.reload()} size="game-md" variant="game-gold">
              Sign back in
            </Button>
          ) : (
            <Link
              className={buttonVariants({
                size: "game-md",
                variant: recovery === "home" ? "game-gold" : "game-secondary",
              })}
              href="/"
            >
              Go home
            </Link>
          )}
        </>
      }
      title="Something went wrong"
    >
      <MenuScreenText>{message}</MenuScreenText>
    </MenuScreen>
  );
}
