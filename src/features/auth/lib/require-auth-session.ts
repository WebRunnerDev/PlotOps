/**
 * Live Auth gate for protected app chrome.
 *
 * React `auth.user` can stay set after the JWT is gone/expired (db reset,
 * revoked refresh, wiped storage while memory lags). Route guards that only
 * check context then let navigation continue while queries return empty/401.
 *
 * Guest Session is Auth XOR (ADR 0018) — skip the network check.
 */
export async function requireAuthSession(input: {
    getUser: () => Promise<{
        error: null | { message?: string };
        user: null | { id: string };
    }>;
    isGuest: boolean;
    signOutLocal: () => Promise<void>;
}): Promise<"ok" | "redirect-sign-in"> {
    if (input.isGuest) {
        return "ok";
    }

    const { error, user } = await input.getUser();
    if (error || !user) {
        await input.signOutLocal();
        return "redirect-sign-in";
    }

    return "ok";
}
