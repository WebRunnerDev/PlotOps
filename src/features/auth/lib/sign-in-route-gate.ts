import type { QueryClient } from "@tanstack/react-query";

import { redirect } from "@tanstack/react-router";

import type { AuthContextValue } from "@/features/auth/model/types";

import {
    GUEST_DEMO_BOARD_ID,
    GUEST_DEMO_PROJECT_ID,
    isGuest,
    leaveGuestSession,
} from "@/features/guest-mode";
import { safeSetItem } from "@/shared/lib/safe-storage";

import {
    isOAuthConsentRedirect,
    parseSafeAppRedirect,
    PENDING_OAUTH_CONSENT_KEY,
} from "./safe-app-redirect";

export type SignInSearch = {
    redirect?: string;
};

type SignInGateContext = {
    auth: Pick<AuthContextValue, "user">;
    queryClient: QueryClient;
};

/** Shared beforeLoad for `/` and `/sign-in` — keeps auth gates identical. */
export async function signInRouteBeforeLoad({
    context,
    search,
}: {
    context: SignInGateContext;
    search?: SignInSearch;
}) {
    const redirectTo = parseSafeAppRedirect(search?.redirect);

    if (redirectTo) {
        rememberConsentRedirect(redirectTo);
    }

    // Sync redirect when React auth already has a user — avoids awaiting
    // getUser() while LoginForm can paint (local Vite session restore).
    if (context.auth.user) {
        if (redirectTo) {
            throw redirect({ href: redirectTo });
        }
        throw redirect({ to: "/home" });
    }

    if (isGuest() && isOAuthConsentRedirect(redirectTo)) {
        leaveGuestSession();
        return;
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

function rememberConsentRedirect(path: string) {
    if (isOAuthConsentRedirect(path)) {
        safeSetItem("sessionStorage", PENDING_OAUTH_CONSENT_KEY, path);
    }
}
