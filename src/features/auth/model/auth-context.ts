import { createContext } from "react";
import type { AuthContextValue } from "@/features/auth/model/types";

export const AuthContext = createContext<AuthContextValue | null>(null);
