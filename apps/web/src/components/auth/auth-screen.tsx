"use client";
import { useHexclaveApp } from "@hexclave/next";
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
    setError(""); setPending(true);
    try { await hexclave.signInWithOAuth("google"); } catch (error) { console.error("Failed to start Google sign-in", error); setError("Google sign-in could not be opened. Check your connection and try again."); setPending(false); }
  };
  return <AuthScreenView error={error} onSignIn={signInWithGoogle} pending={pending} />;
}
export function AuthScreenView({ error = "", onSignIn, pending = false }: { error?: string; onSignIn(): Promise<void>; pending?: boolean; }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6" id="main-content">
      <Card className="w-full max-w-md text-center">
        <CardHeader><CardTitle>Welcome to SetterSaga!</CardTitle><CardDescription>Play, build, and explore new worlds.</CardDescription></CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Button disabled={pending} onClick={() => void onSignIn()} size="lg" className="w-full">{pending ? (<><Spinner data-icon="inline-start" /> Opening Google...</>) : ("Continue with Google")}</Button>
          <LiveMessage message={error} />
          <p className="text-xs text-muted-foreground">By continuing, you agree to our <strong>Terms of Service</strong> and acknowledge our <strong>Privacy Policy</strong>.</p>
        </CardContent>
      </Card>
    </main>
  );
}
