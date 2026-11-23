import { isDeadSessionError } from "@/features/auth/lib/dead-session-error";

/**
 * Live Auth gate for protected app chrome.
 *
 * React `auth.user` can stay set after the JWT is gone/expired (db reset,
 * revoked refresh, wiped storage while memory lags). Route guards that only
 * check context then let navigation continue while queries return empty/401.
 *
 * Only a dead session signs out. A transient failure (offline after sleep,
 * 5xx, 429, another tab winning a token refresh) keeps the user in: local
 * sign-out clears the localStorage entry every open tab shares.
 *
 * Guest Session is Auth XOR (ADR 0018) — skip the network check.
 */
export async function requireAuthSession(input: {
    getUser: () => Promise<{
        error: unknown;
        user: null | { id: string };
    }>;
    isGuest: boolean;
    signOutLocal: () => Promise<void>;
}): Promise<"ok" | "redirect-sign-in"> {
    if (input.isGuest) {
        return "ok";
    }

    const { error, user } = await input.getUser();
    if (user) return "ok";

    if (error && !isDeadSessionError(error)) {
        return "ok";
    }

    await input.signOutLocal();
    return "redirect-sign-in";
}
