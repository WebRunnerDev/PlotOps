import type { QueryClient } from "@tanstack/react-query";

import { redirect } from "@tanstack/react-router";

import type { AuthContextValue } from "@/features/auth/model/types";

import { requireAuthSession } from "@/features/auth";
import {
    GUEST_DEMO_BOARD_ID,
    GUEST_DEMO_PROJECT_ID,
    isGuest,
} from "@/features/guest-mode";
import { supabase } from "@/shared/api/supabase";

type SignInGateContext = {
    auth: Pick<AuthContextValue, "user">;
    queryClient: QueryClient;
};

/** Shared beforeLoad for `/` and `/sign-in` — keeps auth gates identical. */
export async function signInRouteBeforeLoad({
    context,
}: {
    context: SignInGateContext;
}) {
    if (context.auth.user) {
        const gate = await requireAuthSession({
            getUser: async () => {
                const { data, error } = await supabase.auth.getUser();
                return { error, user: data.user };
            },
            isGuest: false,
            signOutLocal: async () => {
                await supabase.auth.signOut({ scope: "local" });
            },
        });
        if (gate === "ok") {
            throw redirect({ to: "/home" });
        }
    }

    if (isGuest()) {
        throw redirect({
            params: {
                boardId: GUEST_DEMO_BOARD_ID,
                projectId: GUEST_DEMO_PROJECT_ID,
            },
            to: "/projects/$projectId/boards/$boardId",
        });
    }
}
