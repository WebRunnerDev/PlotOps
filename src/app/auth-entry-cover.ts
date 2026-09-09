export function isAuthEntryPath(pathname: string): boolean {
    return pathname === "/" || pathname === "/sign-in";
}

/**
 * Keep BootScreen covering the app until either boot UI is still required, or
 * a signed-in user is still on `/` / `/sign-in` (redirect in flight).
 *
 * AnimatePresence mode=wait previously swapped Boot → Router and painted
 * LoginForm for a frame before `/home` resolved.
 */
export function shouldCoverAuthEntry(input: {
    authEntryResolved: boolean;
    hasUser: boolean;
    showBoot: boolean;
}): boolean {
    if (input.showBoot) return true;
    if (input.hasUser && !input.authEntryResolved) return true;
    return false;
}
