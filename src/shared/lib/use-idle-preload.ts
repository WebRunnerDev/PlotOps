import { useEffect } from "react";

/** Upper bound before the preload runs even if the main thread never idles. */
const IDLE_TIMEOUT_MS = 3000;
/** Fallback delay where `requestIdleCallback` is missing (older Safari). */
const FALLBACK_DELAY_MS = 1500;

type NetworkInformationLike = { saveData?: boolean };

/**
 * Run `preload` once the page has painted and the browser is idle — for lazy
 * chunks the page is likely to need soon (the editor on a Board). Skipped when
 * the person asked the browser to save data.
 */
export function useIdlePreload(preload: () => void): void {
    useEffect(() => {
        const connection = (
            navigator as Navigator & { connection?: NetworkInformationLike }
        ).connection;
        if (connection?.saveData) return;

        if (typeof globalThis.requestIdleCallback === "function") {
            const handle = globalThis.requestIdleCallback(preload, {
                timeout: IDLE_TIMEOUT_MS,
            });
            return () => globalThis.cancelIdleCallback(handle);
        }

        const handle = globalThis.setTimeout(preload, FALLBACK_DELAY_MS);
        return () => globalThis.clearTimeout(handle);
    }, [preload]);
}
