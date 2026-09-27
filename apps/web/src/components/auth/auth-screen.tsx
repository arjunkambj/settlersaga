"use client";

import { type CurrentUser, useHexclaveApp } from "@hexclave/next";
import { useState } from "react";

import { MenuScreen, MenuScreenText } from "@/components/app/menu-screen";
import { Button } from "@/components/ui/button";
import { LiveMessage } from "@/components/ui/live-message";
import { Spinner } from "@/components/ui/spinner";

type PendingAuth = "google" | "guest" | null;

export function AuthScreen({ onPlayAsGuest }: { onPlayAsGuest(): Promise<void> }) {
  const hexclave = useHexclaveApp();
  const [pending, setPending] = useState<PendingAuth>(null);
  const [error, setError] = useState("");
  const signInWithGoogle = async () => {
    if (pending) return;
    setError("");
    setPending("google");
    try {
      // Come back to this exact page, so an invite link (/room/CODE) still lands in the room.
      await hexclave.signInWithOAuth("google", { returnTo: window.location.href });
    } catch (error) {
      console.error("Failed to start Google sign-in", error);
      setError("Google sign-in didn't open. Check your connection and try again.");
      setPending(null);
    }
  };
  // On success the session provider swaps this screen out, so `pending` is only reset on failure.
  const playAsGuest = async () => {
    if (pending) return;
    setError("");
    setPending("guest");
    try {
      await onPlayAsGuest();
    } catch (error) {
      console.error("Failed to start a guest session", error);
      setError("Your guest profile didn't start. Check your connection and try again.");
      setPending(null);
    }
  };
  return (
    <AuthScreenView
      error={error}
      onPlayAsGuest={playAsGuest}
      onSignIn={signInWithGoogle}
      pending={pending}
    />
  );
}

export function AuthScreenView({
  error = "",
  onPlayAsGuest,
  onSignIn,
  pending = null,
}: {
  error?: string;
  onPlayAsGuest(): Promise<void>;
  onSignIn(): Promise<void>;
  pending?: PendingAuth;
}) {
  return (
    <MenuScreen title="Welcome aboard">
      <MenuScreenText>
        Sign in with Google to play on any device, or play right away as a guest.
      </MenuScreenText>

      <div className="flex w-full flex-col gap-3">
        <Button
          className="w-full gap-3"
          disabled={pending !== null}
          onClick={() => void onSignIn()}
          size="game-lg"
          variant="game"
        >
          {pending === "google" ? (
            <>
              <Spinner className="size-5" data-icon="inline-start" /> Opening Google…
            </>
          ) : (
            <>
              <span className="grid size-6 place-items-center rounded-full bg-foreground">
                <GoogleMark />
              </span>
              Continue with Google
            </>
          )}
        </Button>
        <div
          aria-hidden="true"
          className="flex items-center gap-3 text-xs font-extrabold tracking-[0.08em] text-ui-text-soft uppercase"
        >
          <span className="h-px flex-1 bg-ui-divider" />
          or
          <span className="h-px flex-1 bg-ui-divider" />
        </div>
        <Button
          className="w-full gap-2"
          disabled={pending !== null}
          onClick={() => void onPlayAsGuest()}
          size="game-lg"
          variant="game-ghost"
        >
          {pending === "guest" ? (
            <>
              <Spinner className="size-5" data-icon="inline-start" /> Starting…
            </>
          ) : (
            "Play as guest"
          )}
        </Button>
        <LiveMessage message={error} />
      </div>
    </MenuScreen>
  );
}

/** Shown to a signed-in account the game can't seat yet, instead of the sign-in screen again. */
export function RestrictedAccountScreen({
  onSignOut,
  reason,
}: {
  onSignOut(): Promise<void>;
  reason: CurrentUser["restrictedReason"];
}) {
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const needsVerification = reason?.type === "email_not_verified";
  const signOut = () => {
    setError("");
    setSigningOut(true);
    onSignOut().catch(() => {
      setError("We couldn't sign you out. Check your connection and try again.");
      setSigningOut(false);
    });
  };

  return (
    <MenuScreen
      actions={
        <>
          {needsVerification ? (
            <Button onClick={() => window.location.reload()} size="game-md" variant="game-gold">
              I&apos;ve verified it
            </Button>
          ) : null}
          <Button
            disabled={signingOut}
            onClick={signOut}
            size="game-md"
            variant={needsVerification ? "game-secondary" : "game"}
          >
            {signingOut ? (
              <>
                <Spinner className="size-5" data-icon="inline-start" /> Signing out…
              </>
            ) : (
              "Sign out"
            )}
          </Button>
        </>
      }
      title={needsVerification ? "Verify your email" : "Account on hold"}
    >
      <MenuScreenText>
        {needsVerification
          ? "Open the link we emailed you, then come back here to play."
          : "This account can't join games right now. Sign out to use another account, or play as a guest."}
      </MenuScreenText>
      <LiveMessage className="w-full" message={error} />
    </MenuScreen>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
        fill="var(--brand-google-blue)"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
        fill="var(--brand-google-green)"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84Z"
        fill="var(--brand-google-yellow)"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
        fill="var(--brand-google-red)"
      />
    </svg>
  );
}
