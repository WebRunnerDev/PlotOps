import type { Session, User } from "@supabase/supabase-js";

import type { UserProfile } from "@/features/auth/api/profile-api";

export type AuthContextValue = {
    githubAccessToken: null | string;
    isLoading: boolean;
    profile: null | UserProfile;
    profileNamesComplete: boolean;
    refreshProfile: () => Promise<void>;
    session: null | Session;
    signOut: () => Promise<void>;
    user: null | User;
};
