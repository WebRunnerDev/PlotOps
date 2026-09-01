import { useEffect } from "react";

/** Signals Playwright prerender that route content is ready to capture. */
export function usePrerenderReady(active = true) {
    useEffect(() => {
        if (!active) {
            return;
        }

        document.documentElement.dataset.prerenderReady = "true";

        return () => {
            delete document.documentElement.dataset.prerenderReady;
        };
    }, [active]);
}
