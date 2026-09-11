"use client";

import { type CurrentUser, useHexclaveApp } from "@hexclave/next";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { AuthScreen } from "@/components/auth/auth-screen";
import { FullPageStatus } from "@/components/ui/full-page-status";
import { NoticeScreen } from "@/components/ui/notice-screen";
import { cleanDisplayName } from "@/lib/app/display-name";
import type { PendingAction } from "@/lib/app/pending-action";
import {
  DEFAULT_AUDIO_SETTINGS,
  normalizeAudioSettings,
  readAudioSettings,
  writeAudioSettings,
  type AudioSettings,
} from "@/lib/audio-settings";
import { type PlayerSession, readPlayerSession, writePlayerSession } from "@/lib/session";

interface AuthClaims {
  displayName: string | null;
  id: string;
  isAnonymous: boolean;
  isRestricted: boolean;
  primaryEmail: string | null;
}

export interface SessionUser extends AuthClaims {
  profileImageUrl: string | null;
}

export interface AppSessionContextValue {
  accountLabel: string;
  audioSettings: AudioSettings;
  defaultDisplayName: string;
  displayName: string;
  error: string;
  exitRoomLocally: () => void;
  onAudioSettingsChange: (settings: AudioSettings) => void;
  onDisplayNameChange: (value: string) => void;
  pendingAction: PendingAction;
  profileImageUrl: string | null;
  session: PlayerSession | null;
  setError: (message: string) => void;
  setPendingAction: (action: PendingAction) => void;
  signOut: () => Promise<void>;
  updateSession: (update: (current: PlayerSession) => PlayerSession) => void;
  user: SessionUser;
  userId: string;
}

const AppSessionContext = createContext<AppSessionContextValue | null>(null);

const claimsFromUser = (user: CurrentUser): AuthClaims => ({
  displayName: user.displayName,
  id: user.id,
  isAnonymous: user.isAnonymous,
  isRestricted: user.isRestricted,
  primaryEmail: user.primaryEmail,
});

export function AppSessionProvider({ children }: { children: ReactNode }) {
  const hexclave = useHexclaveApp();
  const router = useRouter();
  const [claims, setClaims] = useState<AuthClaims | null>();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [userLoadFailed, setUserLoadFailed] = useState(false);
  const [audioSettings, setAudioSettings] = useState(DEFAULT_AUDIO_SETTINGS);
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  useEffect(() => {
    setAudioSettings(readAudioSettings(window.localStorage));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadUser = async () => {
      // Fast path: `getPartialUser({ from: "token" })` decodes the stored access token
      // locally, so a signed-in visitor renders without waiting on the auth backend.
      // When it returns null the session is either absent (getUser resolves null without
      // a network call) or the access token expired and needs a refresh.
      try {
        const partial = await hexclave.getPartialUser({ from: "token" });
        if (!cancelled && partial) {
          setClaims({
            displayName: partial.displayName,
            id: partial.id,
            isAnonymous: partial.isAnonymous,
            isRestricted: partial.isRestricted,
            primaryEmail: partial.primaryEmail,
          });
        }
      } catch {
        // Fall back to the network result below.
      }

      // Authoritative user load: fills in profileImageUrl/signOut and corrects the
      // optimistic claims (e.g. a changed display name or a revoked session).
      try {
        const currentUser = await hexclave.getUser({ includeRestricted: true });
        if (!cancelled) {
          setUser(currentUser);
          setClaims(currentUser ? claimsFromUser(currentUser) : null);
        }
      } catch {
        if (!cancelled) {
          setUserLoadFailed(true);
        }
      }
    };

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, [hexclave]);

  const accountLabel = claims
    ? (claims.displayName ?? claims.primaryEmail ?? "Signed-in player")
    : "";
  const defaultDisplayName = claims
    ? cleanDisplayName(claims.displayName ?? claims.primaryEmail?.split("@")[0] ?? "Explorer")
    : "Explorer";

  useEffect(() => {
    if (!claims || claims.isAnonymous || claims.isRestricted) {
      return;
    }
    const stored = readPlayerSession(window.localStorage, claims.id, defaultDisplayName);
    setSession(stored);
  }, [defaultDisplayName, claims]);

  const updateAudioSettings = (settings: AudioSettings) => {
    const nextSettings = normalizeAudioSettings(settings);
    setAudioSettings(nextSettings);
    writeAudioSettings(window.localStorage, nextSettings);
  };

  const updateSession = (update: (current: PlayerSession) => PlayerSession) => {
    setSession((current) => {
      if (!current) return current;
      const nextSession = update(current);
      writePlayerSession(window.localStorage, nextSession);
      return nextSession;
    });
  };

  const updateDisplayName = (displayName: string) => {
    updateSession((current) => ({ ...current, displayName: cleanDisplayName(displayName) }));
  };

  const exitRoomLocally = () => {
    updateSession((current) => {
      const { activeCode: _activeCode, ...nextSession } = current;
      return nextSession;
    });
    setError("");
    router.push("/");
  };

  const handleSignOut = async () => {
    await hexclave.signOut({ redirectUrl: "/" });
  };

  if (userLoadFailed && claims === undefined) {
    return (
      <NoticeScreen
        actionLabel="Try Again"
        message="Your account could not be checked. Check your connection and try again."
        onAction={() => window.location.reload()}
        title="Account Unavailable"
      />
    );
  }

  if (claims === undefined) {
    return <FullPageStatus label="Checking Your Account…" />;
  }

  if (claims === null || claims.isAnonymous || claims.isRestricted) {
    return <AuthScreen />;
  }

  const displayName = session?.displayName ?? defaultDisplayName;

  const value: AppSessionContextValue = {
    accountLabel,
    audioSettings,
    defaultDisplayName,
    displayName,
    error,
    exitRoomLocally,
    onAudioSettingsChange: updateAudioSettings,
    onDisplayNameChange: updateDisplayName,
    pendingAction,
    profileImageUrl: user?.profileImageUrl ?? null,
    session,
    setError,
    setPendingAction,
    signOut: handleSignOut,
    updateSession,
    user: { ...claims, profileImageUrl: user?.profileImageUrl ?? null },
    userId: claims.id,
  };

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

export function useAppSession() {
  const context = useContext(AppSessionContext);
  if (!context) {
    throw new Error("useAppSession must be used within an AppSessionProvider");
  }
  return context;
}

export function useOptionalAppSession() {
  return useContext(AppSessionContext);
}
