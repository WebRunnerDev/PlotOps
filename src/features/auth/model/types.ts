import type { Session, User } from "@supabase/supabase-js";

export type AuthContextValue = {
    githubAccessToken: null | string;
    isLoading: boolean;
    session: null | Session;
    signOut: () => Promise<void>;
    user: null | User;
};
