import { useContext } from "react";

import type { AuthContextValue } from "@/features/auth/model/types";

import { AuthContext } from "@/features/auth/model/auth-context";

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
}
