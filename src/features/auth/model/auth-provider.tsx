import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { signOut as signOutApi } from "@/features/auth/api/auth-api";
import { supabase } from "@/shared/api/supabase";
import { AuthContext } from "@/features/auth/model/auth-context";
import type { AuthContextValue } from "@/features/auth/model/types";

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
            if (!mounted) return;
            setSession(nextSession);
            setUser(nextSession?.user ?? null);
            setIsLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession);
            setUser(nextSession?.user ?? null);
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

    const value = useMemo<AuthContextValue>(
        () => ({
            session,
            user,
            isLoading,
            signOut,
        }),
        [session, user, isLoading, signOut],
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}
