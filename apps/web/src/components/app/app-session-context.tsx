"use client";

import { type CurrentUser, useHexclaveApp } from "@hexclave/next";
import { api } from "@settersaga/backend/convex/_generated/api";
import { useMutation } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { useReauthenticateConvex } from "@/components/Providers";
import { AuthScreen, RestrictedAccountScreen } from "@/components/auth/auth-screen";
import { MusicHost } from "@/components/audio/background-music";
import { FullPageStatus } from "@/components/ui/full-page-status";
import { NoticeScreen } from "@/components/ui/notice-screen";
import { toActionableError } from "@/lib/app/action-errors";
import { cleanDisplayName } from "@/lib/app/display-name";
import type { PendingAction } from "@/lib/app/pending-action";
import {
  DEFAULT_AUDIO_SETTINGS,
  readAudioSettings,
  writeAudioSettings,
  type AudioSettings,
} from "@/lib/audio-settings";
import { type PlayerSession, readPlayerSession, writePlayerSession } from "@/lib/session";

type AuthClaims = Pick<
  CurrentUser,
  "displayName" | "id" | "isAnonymous" | "isRestricted" | "primaryEmail" | "restrictedReason"
>;

export interface AppSessionContextValue {
  accountLabel: string;
  audioSettings: AudioSettings;
  displayName: string;
  /** Remembers `code` as the room to rejoin and navigates to it. */
  enterRoom: (code: string) => void;
  error: string;
  exitRoomLocally: () => void;
  isGuest: boolean;
  onAudioSettingsChange: (settings: AudioSettings) => void;
  /** Renames the player locally and at every harbor they are waiting in; rejects on failure. */
  onDisplayNameChange: (value: string) => Promise<void>;
  pendingAction: PendingAction;
  profileImageUrl: string | null;
  /**
   * Runs a server action with `action` as the pending action, showing its failure in `error`.
   * Resolves to the work's result, or null when it failed.
   */
  runAction: <Result>(
    action: Exclude<PendingAction, null>,
    work: () => Promise<Result>,
  ) => Promise<Result | null>;
  session: PlayerSession | null;
  setError: (message: string) => void;
  setPendingAction: (action: PendingAction) => void;
  signOut: () => Promise<void>;
  updateSession: (update: (current: PlayerSession) => PlayerSession) => void;
}

const AppSessionContext = createContext<AppSessionContextValue | null>(null);

/** Supplies a fixed session to screens rendered outside the sign-in flow (the dev UI previews). */
export const PreviewAppSessionProvider = AppSessionContext.Provider;

const toClaims = ({
  displayName,
  id,
  isAnonymous,
  isRestricted,
  primaryEmail,
  restrictedReason,
}: AuthClaims): AuthClaims => ({
  displayName,
  id,
  isAnonymous,
  isRestricted,
  primaryEmail,
  restrictedReason,
});

// Guests (Hexclave anonymous users) are always flagged restricted, so "restricted" alone can't
// gate the app. Only non-guest restricted accounts (e.g. an unverified email) are turned away.
const canPlay = (claims: AuthClaims) => claims.isAnonymous || !claims.isRestricted;

// Guests have no name or email, so each gets a short tag from their id to tell them apart at a table.
const getDefaultDisplayName = (claims: AuthClaims) =>
  claims.isAnonymous
    ? `Guest ${claims.id.slice(-4).toUpperCase()}`
    : cleanDisplayName(claims.displayName ?? claims.primaryEmail?.split("@")[0] ?? "");

export function AppSessionProvider({ children }: { children: ReactNode }) {
  const hexclave = useHexclaveApp();
  const reauthenticateConvex = useReauthenticateConvex();
  const pathname = usePathname();
  const router = useRouter();
  const [claims, setClaims] = useState<AuthClaims | null>();
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [userLoadFailed, setUserLoadFailed] = useState(false);
  const [audioSettings, setAudioSettings] = useState(DEFAULT_AUDIO_SETTINGS);
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [error, setError] = useState("");
  const [errorPathname, setErrorPathname] = useState(pathname);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const renameSeats = useMutation(api.rooms.updateDisplayName);

  // This provider outlives navigation, so an error is dropped once the player leaves the screen
  // that raised it rather than following them to the next one.
  if (pathname !== errorPathname) {
    setErrorPathname(pathname);
    setError("");
  }

  useEffect(() => {
    setAudioSettings(readAudioSettings(window.localStorage));
  }, []);

  useEffect(() => {
    let cancelled = false;

    // `getUser()` hides guests unless called with `{ or: "anonymous" }`, but that option also
    // creates a brand-new guest for a signed-out visitor, who should see the sign-in screen
    // instead. The `getUser()` call before this one has already refreshed the access token, so
    // its claims now say whether a guest session exists; only then is it safe to ask for it.
    const loadExistingGuest = async () => {
      const partial = await hexclave.getPartialUser({ from: "token", or: "anonymous-if-exists" });
      return partial?.isAnonymous ? await hexclave.getUser({ or: "anonymous" }) : null;
    };

    const loadUser = async () => {
      // Fast path: `getPartialUser({ from: "token" })` decodes the stored access token
      // locally, so a signed-in visitor renders without waiting on the auth backend.
      // When it returns null the session is either absent (getUser resolves null without
      // a network call) or the access token expired and needs a refresh.
      try {
        const partial = await hexclave.getPartialUser({ from: "token", or: "anonymous-if-exists" });
        if (!cancelled && partial) {
          setClaims(toClaims(partial));
        }
      } catch {
        // Fall back to the network result below.
      }

      // Authoritative user load: fills in profileImageUrl and corrects the optimistic
      // claims (e.g. a changed display name or a revoked session).
      try {
        const currentUser =
          (await hexclave.getUser({ includeRestricted: true })) ?? (await loadExistingGuest());
        if (!cancelled) {
          setProfileImageUrl(currentUser?.profileImageUrl ?? null);
          setClaims(currentUser ? toClaims(currentUser) : null);
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

  useEffect(() => {
    if (!claims || !canPlay(claims)) {
      return;
    }
    setSession(readPlayerSession(window.localStorage, claims.id, getDefaultDisplayName(claims)));
  }, [claims]);

  useEffect(() => {
    if (session) {
      writePlayerSession(window.localStorage, session);
    }
  }, [session]);

  const updateAudioSettings = useCallback((settings: AudioSettings) => {
    setAudioSettings(settings);
    writeAudioSettings(window.localStorage, settings);
  }, []);

  const updateSession = useCallback((update: (current: PlayerSession) => PlayerSession) => {
    setSession((current) => current && update(current));
  }, []);

  const updateDisplayName = useCallback(
    async (value: string) => {
      const displayName = cleanDisplayName(value);
      await renameSeats({ displayName });
      updateSession((current) => ({ ...current, displayName }));
    },
    [renameSeats, updateSession],
  );

  const enterRoom = useCallback(
    (code: string) => {
      updateSession((current) => ({ ...current, activeCode: code }));
      router.push(`/room/${encodeURIComponent(code)}`);
    },
    [router, updateSession],
  );

  const exitRoomLocally = useCallback(() => {
    updateSession(({ activeCode: _activeCode, ...current }) => current);
    router.push("/");
  }, [router, updateSession]);

  const runAction = useCallback(
    async <Result,>(
      action: Exclude<PendingAction, null>,
      work: () => Promise<Result>,
    ): Promise<Result | null> => {
      setError("");
      setPendingAction(action);
      try {
        return await work();
      } catch (cause) {
        setError(toActionableError(cause));
        return null;
      } finally {
        // A later action may have taken over the pending slot; only clear this one.
        setPendingAction((current) => (current === action ? null : current));
      }
    },
    [],
  );

  const playAsGuest = async () => {
    // Reuses the current guest if this browser already has one, otherwise signs up a new one.
    const guest = await hexclave.getUser({ or: "anonymous" });
    reauthenticateConvex();
    setProfileImageUrl(guest.profileImageUrl);
    setClaims(toClaims(guest));
  };

  const signOut = useCallback(async () => {
    await hexclave.signOut({ redirectUrl: "/" });
  }, [hexclave]);

  if (userLoadFailed && claims === undefined) {
    return (
      <NoticeScreen
        actionLabel="Try again"
        message="We couldn't reach your account. Check your connection, then try again."
        onAction={() => window.location.reload()}
        title="Can't connect"
      />
    );
  }

  if (claims === undefined) {
    return <FullPageStatus label="Checking your account…" />;
  }

  if (claims === null) {
    return <AuthScreen onPlayAsGuest={playAsGuest} />;
  }

  if (!canPlay(claims)) {
    return <RestrictedAccountScreen onSignOut={signOut} reason={claims.restrictedReason} />;
  }

  const displayName = session?.displayName ?? getDefaultDisplayName(claims);

  const value: AppSessionContextValue = {
    accountLabel: claims.isAnonymous
      ? "Guest account"
      : (claims.primaryEmail ?? claims.displayName ?? "Signed-in player"),
    audioSettings,
    displayName,
    enterRoom,
    error,
    exitRoomLocally,
    isGuest: claims.isAnonymous,
    onAudioSettingsChange: updateAudioSettings,
    onDisplayNameChange: updateDisplayName,
    pendingAction,
    profileImageUrl,
    runAction,
    session,
    setError,
    setPendingAction,
    signOut,
    updateSession,
  };

  return (
    <AppSessionContext.Provider value={value}>
      <MusicHost>{children}</MusicHost>
    </AppSessionContext.Provider>
  );
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
