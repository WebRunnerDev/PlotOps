import type { Session, User } from "@supabase/supabase-js";

import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";

import type { AuthContextValue } from "@/features/auth/model/types";

import { signOut as signOutApi } from "@/features/auth/api/auth-api";
import {
    ensureUserProfile,
    fetchOwnProfile,
    type UserProfile,
} from "@/features/auth/api/profile-api";
import { githubProviderTokenFromSession } from "@/features/auth/lib/github-provider-token";
import {
    isOAuthCallbackLocation,
    shouldFinishAuthBoot,
} from "@/features/auth/lib/oauth-callback-url";
import { isProfileNamesComplete } from "@/features/auth/lib/user-display";
import { createAsyncGenerationGate } from "@/features/auth/model/async-generation-gate";
import { AuthContext } from "@/features/auth/model/auth-context";
import {
    clearGitHubAccessToken,
    getGitHubAccessToken,
    retainGitHubAccessTokenForUser,
    setGitHubAccessToken,
    subscribeGitHubAccessToken,
    validateGitHubAccessToken,
} from "@/features/auth/model/github-token";
import { validatePersistedSession } from "@/features/auth/model/validate-persisted-session";
import { leaveGuestSession } from "@/features/guest-mode";
import { supabase } from "@/shared/api/supabase";

const OAUTH_CALLBACK_BOOT_TIMEOUT_MS = 15_000;

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<null | Session>(null);
    const [user, setUser] = useState<null | User>(null);
    const [profile, setProfile] = useState<null | UserProfile>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [bootError, setBootError] = useState(false);
    const [bootAttempt, setBootAttempt] = useState(0);
    const sessionUserIdReference = useRef<null | string>(null);
    const githubAccessToken = useSyncExternalStore(
        subscribeGitHubAccessToken,
        getGitHubAccessToken,
        () => null
    );
    const profileLoadGate = useMemo(() => createAsyncGenerationGate(), []);
    const authEventGate = useMemo(() => createAsyncGenerationGate(), []);

    const applySessionUser = useCallback((nextUser: null | User) => {
        sessionUserIdReference.current = nextUser?.id ?? null;
        // Real Auth and Guest Session are mutually exclusive (ADR 0018).
        if (nextUser) {
            leaveGuestSession();
        }
        setUser(nextUser);
    }, []);

    const loadProfile = useCallback(
        async (nextUser: null | User) => {
            const generation = profileLoadGate.begin();
            const requestedUserId = nextUser?.id ?? null;

            if (!nextUser) {
                if (
                    profileLoadGate.isCurrent(generation) &&
                    sessionUserIdReference.current === null
                ) {
                    setProfile(null);
                }
                return;
            }

            try {
                await syncUserProfile(nextUser);
                const nextProfile = await fetchOwnProfile(nextUser.id);
                if (!profileLoadGate.isCurrent(generation)) return;
                if (sessionUserIdReference.current !== requestedUserId) return;
                setProfile(nextProfile);
            } catch {
                if (!profileLoadGate.isCurrent(generation)) return;
                if (sessionUserIdReference.current !== requestedUserId) return;
                setProfile(null);
            }
        },
        [profileLoadGate]
    );

    const refreshProfile = useCallback(async () => {
        if (!user) {
            setProfile(null);
            return;
        }
        const nextProfile = await fetchOwnProfile(user.id);
        flushSync(() => {
            setProfile(nextProfile);
        });
    }, [user]);

    const retryBoot = useCallback(() => {
        setBootError(false);
        setIsLoading(true);
        setBootAttempt((n) => n + 1);
    }, []);

    useEffect(() => {
        let mounted = true;
        const abortController = new AbortController();
        const isOAuthCallback = isOAuthCallbackLocation(globalThis.location);
        let bootFinished = false;

        function finishBoot(options?: { error?: boolean }) {
            if (!mounted || bootFinished) return;
            bootFinished = true;
            setBootError(Boolean(options?.error));
            setIsLoading(false);
        }

        async function syncGitHubToken(
            nextSession: null | Session,
            event?: string
        ) {
            if (event === "SIGNED_OUT" || !nextSession?.user?.id) {
                clearGitHubAccessToken();
                return;
            }

            const userId = nextSession.user.id;
            const githubToken = githubProviderTokenFromSession(nextSession);

            if (githubToken) {
                setGitHubAccessToken(githubToken, userId);
                return;
            }

            const cached = retainGitHubAccessTokenForUser(userId);
            if (!cached) return;

            const valid = await validateGitHubAccessToken(
                cached,
                abortController.signal
            );
            if (!mounted) return;
            if (!valid) {
                clearGitHubAccessToken();
            }
        }

        setBootError(false);

        const oauthWaitTimeout = isOAuthCallback
            ? globalThis.setTimeout(() => {
                  finishBoot({ error: true });
              }, OAUTH_CALLBACK_BOOT_TIMEOUT_MS)
            : undefined;

        // Subscribe before any await so PKCE SIGNED_IN is not missed while
        // getSession() still returns null during the code exchange.
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, nextSession) => {
            void (async () => {
                const eventGeneration = authEventGate.begin();

                if (event === "INITIAL_SESSION") {
                    if (
                        !shouldFinishAuthBoot({
                            isOAuthCallback,
                            session: nextSession,
                        })
                    ) {
                        return;
                    }

                    try {
                        const validated = await validatePersistedSession(
                            nextSession,
                            { signal: abortController.signal }
                        );
                        if (!mounted || abortController.signal.aborted) return;
                        if (!authEventGate.isCurrent(eventGeneration)) return;

                        await syncGitHubToken(validated);

                        const nextUser = validated?.user ?? null;
                        setSession(validated);
                        applySessionUser(nextUser);
                        await loadProfile(nextUser);
                        if (
                            mounted &&
                            authEventGate.isCurrent(eventGeneration)
                        ) {
                            finishBoot();
                        }
                    } catch {
                        if (!mounted) return;
                        if (!authEventGate.isCurrent(eventGeneration)) return;
                        clearGitHubAccessToken();
                        setSession(null);
                        applySessionUser(null);
                        setProfile(null);
                        finishBoot({ error: true });
                    }
                    return;
                }

                await syncGitHubToken(nextSession, event);
                if (!mounted || !authEventGate.isCurrent(eventGeneration)) {
                    return;
                }

                const nextUser = nextSession?.user ?? null;
                setSession(nextSession);
                applySessionUser(nextUser);
                await loadProfile(nextUser);
                if (mounted && authEventGate.isCurrent(eventGeneration)) {
                    finishBoot();
                }
            })();
        });

        return () => {
            mounted = false;
            abortController.abort();
            if (oauthWaitTimeout !== undefined) {
                globalThis.clearTimeout(oauthWaitTimeout);
            }
            subscription.unsubscribe();
        };
    }, [applySessionUser, authEventGate, bootAttempt, loadProfile]);

    const signOut = useCallback(async () => {
        const { error } = await signOutApi();
        if (error) throw error;
    }, []);

    const profileNamesComplete = isProfileNamesComplete(profile);

    const value = useMemo<AuthContextValue>(
        () => ({
            bootError,
            githubAccessToken,
            isLoading,
            profile,
            profileNamesComplete,
            refreshProfile,
            retryBoot,
            session,
            signOut,
            user,
        }),
        [
            bootError,
            githubAccessToken,
            session,
            user,
            profile,
            profileNamesComplete,
            isLoading,
            refreshProfile,
            retryBoot,
            signOut,
        ]
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

async function syncUserProfile(user: null | User) {
    if (!user) return;

    try {
        await ensureUserProfile(user);
    } catch {
        // Profile sync is best-effort on session load; createProject retries upsert.
    }
}
