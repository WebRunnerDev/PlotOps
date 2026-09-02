import type { ReactNode } from "react";

import type { AuthContextValue } from "@/features/auth/model/types";

import { AuthContext } from "@/features/auth/model/auth-context";

const SSG_AUTH_CONTEXT: AuthContextValue = {
    bootError: false,
    bootErrorReason: null,
    githubAccessToken: null,
    isLoading: false,
    profile: null,
    profileNamesComplete: false,
    refreshAuthUser: async () => {},
    refreshProfile: async () => {},
    retryBoot: () => {},
    session: null,
    signOut: async () => {},
    user: null,
};

/** Static auth slice for public-route SSG — no Supabase boot. */
export function SsgAuthProvider({ children }: { children: ReactNode }) {
    return <AuthContext value={SSG_AUTH_CONTEXT}>{children}</AuthContext>;
}
