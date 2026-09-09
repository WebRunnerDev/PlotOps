import type { QueryClient } from "@tanstack/react-query";

import { redirect } from "@tanstack/react-router";

import type { AuthContextValue } from "@/features/auth/model/types";

import {
    GUEST_DEMO_BOARD_ID,
    GUEST_DEMO_PROJECT_ID,
    isGuest,
} from "@/features/guest-mode";

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
    // Sync redirect when React auth already has a user — avoids awaiting
    // getUser() while LoginForm can paint (local Vite session restore).
    if (context.auth.user) {
        throw redirect({ to: "/home" });
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
