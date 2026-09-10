import {
    type FocusEvent,
    type ReactNode,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

import {
    DESCRIPTION_COLLAPSE_MAX_HEIGHT_REM,
    resolveDescriptionCollapseView,
} from "@/shared/lib/resolve-description-collapse";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";

type CollapsibleClampProperties = {
    children: ReactNode;
    collapseLabel: string;
    /** Remeasure overflow when content identity changes (e.g. HTML value). */
    contentKey: string;
    dirty: boolean;
    enabled: boolean;
    expandLabel: string;
    /** Resets expanded state when this identity changes (e.g. task id). */
    resetKey: string;
};

/**
 * Height-clamps long content with a fade and Show more / Show less.
 * Focus inside the content expands; Show less is withheld while dirty or focused.
 */
export function CollapsibleClamp({
    children,
    collapseLabel,
    contentKey,
    dirty,
    enabled,
    expandLabel,
    resetKey,
}: CollapsibleClampProperties) {
    const contentReference = useRef<HTMLDivElement>(null);
    const [expanded, setExpanded] = useState(false);
    const [focused, setFocused] = useState(false);
    const [overflows, setOverflows] = useState(false);

    useEffect(() => {
        setExpanded(false);
        setFocused(false);
    }, [resetKey]);

    useLayoutEffect(() => {
        const element = contentReference.current;
        if (!element || !enabled) {
            setOverflows(false);
            return;
        }

        const measure = () => {
            setOverflows(contentOverflowsMaxHeight(element));
        };

        measure();

        // Observe the unconstrained inner node so growth still fires while the
        // outer wrapper is height-clamped with overflow:hidden.
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => {
            observer.disconnect();
        };
    }, [contentKey, enabled, resetKey]);

    const view = resolveDescriptionCollapseView({
        dirty,
        expanded,
        focused,
        overflows,
        preferenceEnabled: enabled,
    });

    const handleFocusCapture = () => {
        setFocused(true);
        if (enabled) {
            setExpanded(true);
        }
    };

    const handleBlurCapture = (event: FocusEvent<HTMLDivElement>) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) {
            return;
        }
        setFocused(false);
    };

    if (!enabled) {
        return children;
    }

    return (
        <div className="flex min-w-0 flex-col gap-2">
            <div
                className="relative min-w-0"
                onBlurCapture={handleBlurCapture}
                onFocusCapture={handleFocusCapture}
            >
                <div
                    className={cn(
                        "min-w-0",
                        view.isClamped && "overflow-hidden"
                    )}
                    style={
                        view.isClamped
                            ? {
                                  maxHeight: `${DESCRIPTION_COLLAPSE_MAX_HEIGHT_REM}rem`,
                              }
                            : undefined
                    }
                >
                    <div className="min-w-0" ref={contentReference}>
                        {children}
                    </div>
                </div>
                {view.isClamped && view.showExpandControl ? (
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-background to-transparent"
                    />
                ) : null}
            </div>
            {view.showExpandControl ? (
                <Button
                    className="self-start"
                    onClick={() => {
                        setExpanded(true);
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                >
                    {expandLabel}
                </Button>
            ) : null}
            {view.showCollapseControl ? (
                <Button
                    className="self-start"
                    onClick={() => {
                        setExpanded(false);
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                >
                    {collapseLabel}
                </Button>
            ) : null}
        </div>
    );
}

function contentOverflowsMaxHeight(element: HTMLElement): boolean {
    const rootFontSize =
        Number.parseFloat(
            getComputedStyle(document.documentElement).fontSize
        ) || 16;
    const maxPx = DESCRIPTION_COLLAPSE_MAX_HEIGHT_REM * rootFontSize;
    return element.scrollHeight > maxPx + 1;
}
