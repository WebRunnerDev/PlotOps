"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ScheduledTooltipControls<T> {
    clearTooltip: () => void;
    resetTooltipDedupe: () => void;
    scheduleTooltip: (tooltip: T, dedupeKey?: string) => void;
    setTooltipData: React.Dispatch<React.SetStateAction<null | T>>;
    tooltipData: null | T;
}

export function useScheduledTooltip<T>(): ScheduledTooltipControls<T> {
    const [tooltipData, setTooltipData] = useState<null | T>(null);
    const lastKeyReference = useRef<null | string>(null);
    const pendingReference = useRef<null | T>(null);
    const rafReference = useRef<null | number>(null);
    const pendingKeyReference = useRef<null | string>(null);

    useEffect(() => {
        return () => {
            if (rafReference.current !== null) {
                cancelAnimationFrame(rafReference.current);
            }
        };
    }, []);

    const commitTooltip = useCallback((tooltip: T, dedupeKey: string) => {
        if (dedupeKey === lastKeyReference.current) {
            return;
        }
        lastKeyReference.current = dedupeKey;
        setTooltipData(tooltip);
    }, []);

    const scheduleTooltip = useCallback(
        (tooltip: T, dedupeKey?: string) => {
            const key = dedupeKey ?? defaultDedupeKey(tooltip);
            pendingReference.current = tooltip;
            pendingKeyReference.current = key;
            if (key === lastKeyReference.current) {
                return;
            }
            if (rafReference.current !== null) {
                return;
            }
            rafReference.current = requestAnimationFrame(() => {
                rafReference.current = null;
                const next = pendingReference.current;
                const nextKey = pendingKeyReference.current;
                if (next && nextKey) {
                    commitTooltip(next, nextKey);
                }
            });
        },
        [commitTooltip]
    );

    const clearTooltip = useCallback(() => {
        if (rafReference.current !== null) {
            cancelAnimationFrame(rafReference.current);
            rafReference.current = null;
        }
        pendingReference.current = null;
        pendingKeyReference.current = null;
        lastKeyReference.current = null;
        setTooltipData(null);
    }, []);

    const resetTooltipDedupe = useCallback(() => {
        lastKeyReference.current = null;
    }, []);

    return {
        clearTooltip,
        resetTooltipDedupe,
        scheduleTooltip,
        setTooltipData,
        tooltipData,
    };
}

function defaultDedupeKey<T>(tooltip: T): string {
    if (
        typeof tooltip === "object" &&
        tooltip !== null &&
        "index" in tooltip &&
        typeof (tooltip as { index: unknown }).index === "number"
    ) {
        const { index, x } = tooltip as { index: number; x?: number };
        if (typeof x === "number") {
            return `${index}:${Math.round(x)}`;
        }
        return String(index);
    }
    return JSON.stringify(tooltip);
}
