import type { Session, User } from "@supabase/supabase-js";

import type { UserProfile } from "@/features/auth/api/profile-api";

export type AuthBootErrorReason = "oauth" | "session" | null;

export type AuthContextValue = {
    bootError: boolean;
    bootErrorReason: AuthBootErrorReason;
    githubAccessToken: null | string;
    isLoading: boolean;
    profile: null | UserProfile;
    profileNamesComplete: boolean;
    refreshProfile: () => Promise<void>;
    retryBoot: () => void;
    session: null | Session;
    signOut: () => Promise<void>;
    user: null | User;
};
