import type { ParsedLocation } from "@tanstack/react-router";

type DocumentWithViewTransition = Document & {
    activeViewTransition?: null | { finished: Promise<unknown> };
};

type PageTransitionChangeInfo = {
    fromLocation?: TransitionLocation;
    hashChanged?: boolean;
    hrefChanged?: boolean;
    pathChanged?: boolean;
    toLocation: TransitionLocation;
};

type TransitionLocation = Pick<ParsedLocation, "pathname" | "state">;

/**
 * Directional full-page view-transition types for TanStack Router.
 * Cross board/non-board layout → fade only (shell width differs).
 * Deeper routes → slide-left; shallower → slide-right; same depth → fade.
 * Search/hash-only updates (e.g. `?task=` while the task drawer opens) → none.
 */
export function getPageTransitionTypes({
    fromLocation,
    pathChanged,
    toLocation,
}: PageTransitionChangeInfo): false | string[] {
    if (fromLocation && pathChanged === false) {
        return false;
    }

    if (!fromLocation) {
        return ["fade"];
    }

    const fromBoard = fromLocation.pathname.startsWith("/projects/");
    const toBoard = toLocation.pathname.startsWith("/projects/");
    if (fromBoard !== toBoard) {
        return ["fade"];
    }

    const fromDepth = routeDepth(fromLocation.pathname);
    const toDepth = routeDepth(toLocation.pathname);

    if (toDepth > fromDepth) {
        return ["slide-left"];
    }
    if (toDepth < fromDepth) {
        return ["slide-right"];
    }

    const fromIndex = historyIndex(fromLocation);
    const toIndex = historyIndex(toLocation);
    if (
        fromIndex !== undefined &&
        toIndex !== undefined &&
        toIndex < fromIndex
    ) {
        return ["slide-right"];
    }

    return ["fade"];
}

/**
 * TanStack Router starts a document View Transition but resolves `navigate()`
 * when the DOM update callback finishes — not when the CSS fade/slide ends.
 * Await this after `navigate` before opening overlays (e.g. task drawer).
 */
export async function waitForActiveViewTransition(): Promise<void> {
    if (typeof document === "undefined" || document === null) return;

    // Let `document.startViewTransition` assign `activeViewTransition` first.
    await Promise.resolve();

    const transition = (document as DocumentWithViewTransition)
        .activeViewTransition;
    if (transition) {
        try {
            await transition.finished;
        } catch {
            // Skipped / aborted — safe to continue.
        }
        return;
    }

    const animations = document.getAnimations?.() ?? [];
    const viewTransitionAnimations = animations.filter((animation) => {
        const effect = animation.effect;
        return (
            effect instanceof KeyframeEffect &&
            Boolean(effect.pseudoElement?.startsWith("::view-transition"))
        );
    });
    if (viewTransitionAnimations.length === 0) return;

    await Promise.all(
        viewTransitionAnimations.map((animation) =>
            animation.finished.catch(() => {})
        )
    );
}

function historyIndex(location: TransitionLocation): number | undefined {
    const index = (location.state as undefined | { __TSR_index?: unknown })
        ?.__TSR_index;
    return typeof index === "number" ? index : undefined;
}

function routeDepth(pathname: string): number {
    return pathname.split("/").filter(Boolean).length;
}
