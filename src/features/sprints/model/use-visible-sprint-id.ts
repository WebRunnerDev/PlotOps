import { useEffect, useState } from "react";

import { resolveVisibleSprintId } from "@/features/sprints/model/resolve-visible-sprint-id";
import { intersectionObserverRoot } from "@/features/sprints/model/scroll-sprint-section";
import { sprintSectionId } from "@/features/sprints/model/sprint-dom-ids";

export function useVisibleSprintId(input: {
    enabled: boolean;
    scrollRoot: HTMLElement | null;
    sprintIds: readonly string[];
}): {
    currentId: null | string;
    selectId: (id: string) => void;
} {
    const { enabled, scrollRoot, sprintIds } = input;
    const sprintIdsKey = sprintIds.join("\0");
    const [currentId, setCurrentId] = useState<null | string>(
        sprintIds[0] ?? null
    );

    useEffect(() => {
        const ids = sprintIdsKey.length === 0 ? [] : sprintIdsKey.split("\0");
        setCurrentId((previous) => {
            if (previous && ids.includes(previous)) return previous;
            return ids[0] ?? null;
        });
    }, [sprintIdsKey]);

    useEffect(() => {
        const ids = sprintIdsKey.length === 0 ? [] : sprintIdsKey.split("\0");
        if (!enabled || !scrollRoot || ids.length < 2) return;

        const nodes = ids
            .map((id) =>
                document.querySelector<HTMLElement>(
                    `#${CSS.escape(sprintSectionId(id))}`
                )
            )
            .filter((node): node is HTMLElement => node !== null);
        if (nodes.length === 0) return;

        const snapshots = new Map<
            string,
            { intersecting: boolean; ratio: number; top: number }
        >();
        const ioRoot = intersectionObserverRoot(scrollRoot);
        const originTop = () =>
            ioRoot === null ? 0 : scrollRoot.getBoundingClientRect().top;

        const observer = new IntersectionObserver(
            (entries) => {
                const origin = originTop();
                for (const entry of entries) {
                    const sprintId = ids.find(
                        (id) => sprintSectionId(id) === entry.target.id
                    );
                    if (!sprintId) continue;
                    snapshots.set(sprintId, {
                        intersecting: entry.isIntersecting,
                        ratio: entry.intersectionRatio,
                        top: entry.boundingClientRect.top - origin,
                    });
                }
                setCurrentId((previous) =>
                    resolveVisibleSprintId(
                        ids.map((id) => ({
                            id,
                            intersecting:
                                snapshots.get(id)?.intersecting ?? false,
                            ratio: snapshots.get(id)?.ratio ?? 0,
                            top:
                                snapshots.get(id)?.top ??
                                Number.POSITIVE_INFINITY,
                        })),
                        previous
                    )
                );
            },
            {
                root: ioRoot,
                rootMargin: "-12% 0px -55% 0px",
                threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
            }
        );

        for (const node of nodes) observer.observe(node);
        return () => {
            observer.disconnect();
        };
    }, [enabled, scrollRoot, sprintIdsKey]);

    return {
        currentId,
        selectId: setCurrentId,
    };
}
