import type { Session, User } from "@supabase/supabase-js";

import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
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
import { isProfileNamesComplete } from "@/features/auth/lib/user-display";
import { AuthContext } from "@/features/auth/model/auth-context";
import {
    clearGitHubAccessToken,
    getGitHubAccessToken,
    setGitHubAccessToken,
    subscribeGitHubAccessToken,
    validateGitHubAccessToken,
} from "@/features/auth/model/github-token";
import { supabase } from "@/shared/api/supabase";

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<null | Session>(null);
    const [user, setUser] = useState<null | User>(null);
    const [profile, setProfile] = useState<null | UserProfile>(null);
    const [isLoading, setIsLoading] = useState(true);
    const githubAccessToken = useSyncExternalStore(
        subscribeGitHubAccessToken,
        getGitHubAccessToken,
        () => null
    );

    const loadProfile = useCallback(async (nextUser: null | User) => {
        if (!nextUser) {
            setProfile(null);
            return;
        }

        try {
            await syncUserProfile(nextUser);
            const nextProfile = await fetchOwnProfile(nextUser.id);
            setProfile(nextProfile);
        } catch {
            setProfile(null);
        }
    }, []);

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

    useEffect(() => {
        let mounted = true;
        const abortController = new AbortController();

        async function syncGitHubToken(
            nextSession: null | Session,
            event?: string
        ) {
            if (event === "SIGNED_OUT" || !nextSession) {
                clearGitHubAccessToken();
                return;
            }

            if (nextSession.provider_token) {
                setGitHubAccessToken(nextSession.provider_token);
                return;
            }

            const cached = getGitHubAccessToken();
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

        supabase.auth
            .getSession()
            .then(async ({ data: { session: nextSession } }) => {
                if (!mounted) return;

                const validated = await validatePersistedSession(nextSession);
                if (!mounted) return;

                await syncGitHubToken(validated);

                const nextUser = validated?.user ?? null;
                setSession(validated);
                setUser(nextUser);
                await loadProfile(nextUser);
                if (mounted) setIsLoading(false);
            })
            .catch(() => {
                if (!mounted) return;
                clearGitHubAccessToken();
                setSession(null);
                setUser(null);
                setProfile(null);
                setIsLoading(false);
            });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, nextSession) => {
            void (async () => {
                // INITIAL_SESSION already handled via getSession + validate.
                if (event === "INITIAL_SESSION") return;

                await syncGitHubToken(nextSession, event);

                const nextUser = nextSession?.user ?? null;
                setSession(nextSession);
                setUser(nextUser);
                await loadProfile(nextUser);
                if (mounted) setIsLoading(false);
            })();
        });

        return () => {
            mounted = false;
            abortController.abort();
            subscription.unsubscribe();
        };
    }, [loadProfile]);

    const signOut = useCallback(async () => {
        const { error } = await signOutApi();
        if (error) throw error;
    }, []);

    const profileNamesComplete = isProfileNamesComplete(profile);

    const value = useMemo<AuthContextValue>(
        () => ({
            githubAccessToken,
            isLoading,
            profile,
            profileNamesComplete,
            refreshProfile,
            session,
            signOut,
            user,
        }),
        [
            githubAccessToken,
            session,
            user,
            profile,
            profileNamesComplete,
            isLoading,
            refreshProfile,
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

/**
 * `getSession()` reads local storage and can return a JWT after `db reset`
 * (or any server-side auth wipe). Confirm with the Auth API before treating
 * the user as signed in.
 */
async function validatePersistedSession(
    session: null | Session
): Promise<null | Session> {
    if (!session) return null;

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
        await supabase.auth.signOut({ scope: "local" });
        clearGitHubAccessToken();
        return null;
    }

    return { ...session, user: data.user };
}
