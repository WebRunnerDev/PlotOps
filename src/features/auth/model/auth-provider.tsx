import type { Session, User } from "@supabase/supabase-js";

import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useState,
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
} from "@/features/auth/model/github-token";
import { supabase } from "@/shared/api/supabase";

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<null | Session>(null);
    const [user, setUser] = useState<null | User>(null);
    const [profile, setProfile] = useState<null | UserProfile>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [storedGitHubToken, setStoredGitHubToken] = useState<null | string>(
        () => getGitHubAccessToken()
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

        supabase.auth
            .getSession()
            .then(async ({ data: { session: nextSession } }) => {
                if (!mounted) return;

                if (nextSession?.provider_token) {
                    setGitHubAccessToken(nextSession.provider_token);
                    setStoredGitHubToken(nextSession.provider_token);
                }

                const nextUser = nextSession?.user ?? null;
                setSession(nextSession);
                setUser(nextUser);
                await loadProfile(nextUser);
                if (mounted) setIsLoading(false);
            });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            void (async () => {
                if (nextSession?.provider_token) {
                    setGitHubAccessToken(nextSession.provider_token);
                    setStoredGitHubToken(nextSession.provider_token);
                }

                if (_event === "SIGNED_OUT") {
                    clearGitHubAccessToken();
                    setStoredGitHubToken(null);
                }

                const nextUser = nextSession?.user ?? null;
                setSession(nextSession);
                setUser(nextUser);
                await loadProfile(nextUser);
                if (mounted) setIsLoading(false);
            })();
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [loadProfile]);

    const signOut = useCallback(async () => {
        const { error } = await signOutApi();
        if (error) throw error;
    }, []);

    const githubAccessToken =
        session?.provider_token ?? storedGitHubToken ?? null;

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
