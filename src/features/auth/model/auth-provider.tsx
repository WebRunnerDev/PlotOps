import type { Session, User } from "@supabase/supabase-js";

import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import type { AuthContextValue } from "@/features/auth/model/types";

import { signOut as signOutApi } from "@/features/auth/api/auth-api";
import { ensureUserProfile } from "@/features/auth/api/profile-api";
import { AuthContext } from "@/features/auth/model/auth-context";
import {
    clearGitHubAccessToken,
    getGitHubAccessToken,
    setGitHubAccessToken,
} from "@/features/auth/model/github-token";
import { supabase } from "@/shared/api/supabase";

async function syncUserProfile(user: null | User) {
    if (!user) return;

    try {
        await ensureUserProfile(user);
    } catch {
        // Profile sync is best-effort on session load; createProject retries upsert.
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<null | Session>(null);
    const [user, setUser] = useState<null | User>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [storedGitHubToken, setStoredGitHubToken] = useState<null | string>(
        () => getGitHubAccessToken(),
    );

    useEffect(() => {
        let mounted = true;

        supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
            if (!mounted) return;

            if (nextSession?.provider_token) {
                setGitHubAccessToken(nextSession.provider_token);
                setStoredGitHubToken(nextSession.provider_token);
            }

            setSession(nextSession);
            setUser(nextSession?.user ?? null);
            void syncUserProfile(nextSession?.user ?? null);
            setIsLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            if (nextSession?.provider_token) {
                setGitHubAccessToken(nextSession.provider_token);
                setStoredGitHubToken(nextSession.provider_token);
            }

            if (_event === "SIGNED_OUT") {
                clearGitHubAccessToken();
                setStoredGitHubToken(null);
            }

            setSession(nextSession);
            setUser(nextSession?.user ?? null);
            void syncUserProfile(nextSession?.user ?? null);
            setIsLoading(false);
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const signOut = useCallback(async () => {
        const { error } = await signOutApi();
        if (error) throw error;
    }, []);

    const githubAccessToken =
        session?.provider_token ?? storedGitHubToken ?? null;

    const value = useMemo<AuthContextValue>(
        () => ({
            githubAccessToken,
            isLoading,
            session,
            signOut,
            user,
        }),
        [githubAccessToken, session, user, isLoading, signOut],
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}
