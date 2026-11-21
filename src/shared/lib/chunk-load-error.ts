import { safeGetItem, safeSetItem } from "@/shared/lib/safe-storage";

// Messages browsers use when a lazy `import()` cannot be fetched — typically a
// tab opened before a deploy asking for a chunk hash that no longer exists.
const CHUNK_LOAD_ERROR_PATTERNS = [
    /failed to fetch dynamically imported module/i, // Chromium
    /error loading dynamically imported module/i, // Firefox
    /importing a module script failed/i, // Safari
    /unable to preload css/i, // Vite preload helper
];

export function isChunkLoadError(error: unknown): boolean {
    return (
        error instanceof Error &&
        CHUNK_LOAD_ERROR_PATTERNS.some((pattern) => pattern.test(error.message))
    );
}

const RELOAD_STORAGE_KEY = "plotops:chunk-reload-at";

/** A second chunk failure within this window means a reload did not help. */
export const CHUNK_RELOAD_COOLDOWN_MS = 30_000;

export type NewDeployReloader = {
    /** True when `reload()` would actually reload (or already has). */
    canReload: () => boolean;
    /**
     * Reload once to pick up the new deploy. Returns false when a reload
     * already happened within the cooldown — the caller should show an error
     * instead of looping. Idempotent within one page lifetime.
     */
    reload: () => boolean;
};

type NewDeployReloaderDependencies = {
    now: () => number;
    readLastReloadAt: () => null | string;
    reload: () => void;
    writeLastReloadAt: (value: string) => void;
};

export function createNewDeployReloader(
    dependencies: NewDeployReloaderDependencies
): NewDeployReloader {
    let scheduled = false;

    const cooledDown = () => {
        const last = Number(dependencies.readLastReloadAt());
        return (
            !Number.isFinite(last) ||
            dependencies.now() - last >= CHUNK_RELOAD_COOLDOWN_MS
        );
    };

    return {
        canReload: () => scheduled || cooledDown(),
        reload: () => {
            if (scheduled) return true;
            if (!cooledDown()) return false;
            scheduled = true;
            dependencies.writeLastReloadAt(String(dependencies.now()));
            dependencies.reload();
            return true;
        },
    };
}

export const newDeployReloader = createNewDeployReloader({
    now: () => Date.now(),
    readLastReloadAt: () => safeGetItem("sessionStorage", RELOAD_STORAGE_KEY),
    reload: () => globalThis.location.reload(),
    writeLastReloadAt: (value) =>
        safeSetItem("sessionStorage", RELOAD_STORAGE_KEY, value),
});
