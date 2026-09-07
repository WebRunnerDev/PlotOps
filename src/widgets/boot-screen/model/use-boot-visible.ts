import { useEffect, useRef, useState } from "react";

/** Hold boot long enough for the letter choreography to land (~1 beat). */
export const BOOT_MIN_VISIBLE_MS = 1100;

/**
 * Keeps the boot screen mounted until auth settles *and* the min display
 * window elapsed — so a fast session restore never skips the signature reveal.
 * Boot errors bypass the hold and show immediately.
 */
export function useBootVisible(isLoading: boolean, bootError: boolean): boolean {
    const [hold, setHold] = useState(true);
    const startedAtReference = useRef(
        typeof performance === "undefined" ? Date.now() : performance.now()
    );

    useEffect(() => {
        if (bootError) {
            setHold(true);
            return;
        }

        if (isLoading) {
            setHold(true);
            startedAtReference.current =
                typeof performance === "undefined"
                    ? Date.now()
                    : performance.now();
            return;
        }

        const now =
            typeof performance === "undefined" ? Date.now() : performance.now();
        const elapsed = now - startedAtReference.current;
        const remaining = Math.max(0, BOOT_MIN_VISIBLE_MS - elapsed);

        const timeoutId = window.setTimeout(() => {
            setHold(false);
        }, remaining);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [bootError, isLoading]);

    return bootError || isLoading || hold;
}
