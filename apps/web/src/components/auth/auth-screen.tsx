"use client";

import { useHexclaveApp } from "@hexclave/next";
import { Button, Spinner } from "@heroui/react";
import { useState } from "react";

import { AppScenery } from "@/components/ui/app-scenery";
import { Brand } from "@/components/ui/brand";
import { LiveMessage } from "@/components/ui/live-message";

export function AuthScreen() {
  const hexclave = useHexclaveApp();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const signInWithGoogle = async () => {
    if (pending) {
      return;
    }

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
    <main className="auth-page auth-reference-page" id="main-content">
      <AppScenery />

      <section aria-labelledby="auth-title" className="auth-login auth-reference-panel">
        <div className="auth-reference-brand">
          <Brand />
        </div>

        <div className="auth-reference-copy">
          <h1 className="auth-reference-title" id="auth-title">
            Welcome to SetterSaga!
          </h1>
          <p className="auth-reference-subtitle">Play, build, and explore new worlds.</p>
        </div>

        <Button
          className="button google-auth-button auth-reference-google-button"
          fullWidth
          isPending={pending}
          onPress={() => void onSignIn()}
          size="lg"
        >
          {({ isPending }) => (
            <>
              <span className="google-auth-mark" aria-hidden="true">
                {isPending ? <Spinner color="current" size="sm" /> : <GoogleMark />}
              </span>
              <span>{isPending ? "Opening Google…" : "Continue with Google"}</span>
            </>
          )}
        </Button>

        <div className="auth-reference-status">
          <LiveMessage message={error} />
        </div>

        <p className="auth-reference-legal">
          By continuing, you agree to our <strong>Terms of Service</strong>
          <br />
          and acknowledge our <strong>Privacy Policy</strong>.
        </p>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" role="img">
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.909c1.702-1.567 2.684-3.874 2.684-6.614Z"
        fill="#4285f4"
      />
      <path
        d="M9 18c2.43 0 4.468-.806 5.956-2.181l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.584-5.037-3.711H.956v2.332A9 9 0 0 0 9 18Z"
        fill="#34a853"
      />
      <path
        d="M3.963 10.709A5.42 5.42 0 0 1 3.682 9c0-.593.102-1.169.281-1.709V4.959H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.041l3.007-2.332Z"
        fill="#fbbc05"
      />
      <path
        d="M9 3.58c1.321 0 2.507.454 3.441 1.346l2.581-2.581C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.959l3.007 2.332C4.672 5.164 6.656 3.58 9 3.58Z"
        fill="#ea4335"
      />
    </svg>
  );
}
