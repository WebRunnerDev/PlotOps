import { useEffect, useState } from "react";

/**
 * Stay false for one paint cycle after `active` becomes true (double rAF),
 * then flip true. Resets when `active` goes false or `resetKey` changes.
 *
 * Use to keep the first open frame of a drawer/dialog light (shell + CSS
 * transition) before mounting TipTap / other heavy trees.
 */
export function useDeferredMount(active: boolean, resetKey?: string): boolean {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!active) {
            setReady(false);
            return;
        }

        setReady(false);
        let cancelled = false;
        let innerId = 0;
        const outerId = globalThis.requestAnimationFrame(() => {
            innerId = globalThis.requestAnimationFrame(() => {
                if (!cancelled) setReady(true);
            });
        });

        return () => {
            cancelled = true;
            globalThis.cancelAnimationFrame(outerId);
            if (innerId) globalThis.cancelAnimationFrame(innerId);
        };
    }, [active, resetKey]);

    return ready;
}
