"use client";
import { useHexclaveApp } from "@hexclave/next";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useState } from "react";
import { LiveMessage } from "@/components/ui/live-message";
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
    <main
      className="relative flex min-h-dvh items-center justify-center overflow-hidden p-6"
      id="main-content"
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <Image
          alt=""
          className="object-cover"
          fill
          priority
          sizes="100vw"
          src="/shared-assets/coastal-island-kingdom-supercell.png"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#012d5c]/85 via-[#012d5c]/45 to-[#01315f]/90" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="flex items-center gap-2.5 text-center">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-xl font-black leading-none tracking-tight backdrop-blur-md"
          >
            S
          </span>
          <div className="text-left">
            <p className="text-base font-bold leading-none">SetterSaga</p>
            <p className="text-xs text-white/70">Settlers Saga</p>
          </div>
        </div>

        <Card className="w-full max-w-md border-white/15 bg-card/55 text-center shadow-2xl shadow-black/40 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Welcome to SetterSaga!</CardTitle>
            <CardDescription>Play, build, and explore new worlds.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Button disabled={pending} onClick={() => void onSignIn()} size="lg" className="w-full">
              {pending ? (
                <>
                  <Spinner data-icon="inline-start" /> Opening Google...
                </>
              ) : (
                "Continue with Google"
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
