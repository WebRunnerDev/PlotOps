import { useEffect, useRef } from "react";

type BuildsLoadMoreSentinelProperties = {
    enabled: boolean;
    onVisible: () => void;
};

/**
 * Fires `onVisible` when the sentinel enters (or is near) the viewport.
 * Used to page GitHub Actions runs while scrolling the CI/CD list.
 */
export function BuildsLoadMoreSentinel({
    enabled,
    onVisible,
}: BuildsLoadMoreSentinelProperties) {
    const nodeReference = useRef<HTMLDivElement>(null);
    const onVisibleReference = useRef(onVisible);
    onVisibleReference.current = onVisible;

    useEffect(() => {
        const node = nodeReference.current;
        if (!node || !enabled) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    onVisibleReference.current();
                }
            },
            { root: null, rootMargin: "240px 0px", threshold: 0 }
        );

        observer.observe(node);
        return () => {
            observer.disconnect();
        };
    }, [enabled]);

    return <div aria-hidden className="h-px w-full" ref={nodeReference} />;
}
