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
  user: CurrentUser;
  userId: string;
}

const AppSessionContext = createContext<AppSessionContextValue | null>(null);

export function AppSessionProvider({ children }: { children: ReactNode }) {
  const hexclave = useHexclaveApp();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>();
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
      try {
        const currentUser = await hexclave.getUser({ includeRestricted: true });
        if (!cancelled) {
          setUser(currentUser);
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

  const accountLabel = user ? (user.displayName ?? user.primaryEmail ?? "Signed-in player") : "";
  const defaultDisplayName = user
    ? cleanDisplayName(user.displayName ?? user.primaryEmail?.split("@")[0] ?? "Explorer")
    : "Explorer";

  useEffect(() => {
    if (!user || user.isAnonymous || user.isRestricted) {
      return;
    }
    const stored = readPlayerSession(window.localStorage, user.id, defaultDisplayName);
    setSession(stored);
  }, [defaultDisplayName, user]);

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
    if (user) {
      await user.signOut({ redirectUrl: "/" });
    }
  };

  if (userLoadFailed) {
    return (
      <NoticeScreen
        actionLabel="Try Again"
        message="Your account could not be checked. Check your connection and try again."
        onAction={() => window.location.reload()}
        title="Account Unavailable"
      />
    );
  }

  if (user === undefined) {
    return <FullPageStatus label="Checking Your Account…" />;
  }

  if (user === null || user.isAnonymous || user.isRestricted) {
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
    profileImageUrl: user.profileImageUrl,
    session,
    setError,
    setPendingAction,
    signOut: handleSignOut,
    updateSession,
    user,
    userId: user.id,
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
