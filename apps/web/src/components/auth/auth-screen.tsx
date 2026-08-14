"use client";

import { useHexclaveApp } from "@hexclave/next";
import { useState } from "react";

import { BrandWordmark } from "@/components/app/brand-logo";
import { SceneBackdrop } from "@/components/app/scene-backdrop";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveMessage } from "@/components/ui/live-message";
import { Spinner } from "@/components/ui/spinner";

export function AuthScreen() {
  const hexclave = useHexclaveApp();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const signInWithGoogle = async () => {
    if (pending) return;
    setError("");
    setPending(true);
    try {
      await hexclave.signInWithOAuth("google");
    } catch (error) {
      console.error("Failed to start Google sign-in", error);
      setError("Google sign-in could not be opened. Check your connection and try again.");
      setPending(false);
    }
  };
  return <AuthScreenView error={error} onSignIn={signInWithGoogle} pending={pending} />;
}

export function AuthScreenView({
  error = "",
  onSignIn,
  pending = false,
}: {
  error?: string;
  onSignIn(): Promise<void>;
  pending?: boolean;
}) {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden" id="main-content">
      <SceneBackdrop />

      <div className="relative z-10 flex min-h-dvh items-center justify-center px-4 py-10 sm:px-6">
        <Card className="w-full max-w-sm bg-gradient-to-b from-card/55 to-card/70 text-center shadow-sm shadow-background/40">
          <CardHeader className="items-center">
            <BrandWordmark className="mx-auto w-48 drop-shadow-md sm:w-56" priority />
            <CardTitle>Welcome aboard</CardTitle>
            <CardDescription>Sign in to host a table or join a crew.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Button className="w-full" disabled={pending} onClick={() => void onSignIn()} size="lg">
              {pending ? (
                <>
                  <Spinner data-icon="inline-start" /> Opening Google...
                </>
              ) : (
                <>
                  <GoogleMark />
                  Continue with Google
                </>
              )}
            </Button>
            <LiveMessage message={error} />
            <p className="text-xs text-muted-foreground">
              By continuing, you agree to our <strong>Terms of Service</strong> and acknowledge our{" "}
              <strong>Privacy Policy</strong>.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
        fill="#EA4335"
      />
    </svg>
  );
}
