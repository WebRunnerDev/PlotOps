/*
 * Pre-paint boot, loaded as a blocking classic script from <head>.
 * Lives outside index.html so CSP `script-src 'self'` needs no inline hashes.
 */

// Zod JIT off before any module defines a schema: its eval probe
// (`Function("")`) is a CSP script-src violation. Zod reads this global
// (zod/v4/core globalConfig); an entry-module `z.config()` runs too late
// because chunks holding schemas evaluate first.
globalThis.__zod_globalConfig = {
    ...globalThis.__zod_globalConfig,
    jitless: true,
};

// Block scope keeps `root` out of the shared global lexical scope.
{
    const root = document.documentElement;

    // Theme: dark by default, light only when explicitly persisted.
    try {
        root.classList.toggle(
            "dark",
            localStorage.getItem("plotops-theme") !== "light"
        );
    } catch {
        root.classList.add("dark");
    }

    // Hide prerendered LoginForm when a Supabase Auth token is still in
    // localStorage (SPA /* → index.html). Cleared when BootScreen mounts.
    try {
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (
                key &&
                /^sb-[a-z0-9]+-auth-token$/i.test(key) &&
                localStorage.getItem(key)
            ) {
                root.dataset.plotopsAuthSession = "";
                break;
            }
        }
    } catch {
        // Storage blocked (privacy mode) — no persisted session to mask.
    }
}
