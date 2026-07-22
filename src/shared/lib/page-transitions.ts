import type { ParsedLocation } from "@tanstack/react-router";

type TransitionLocation = Pick<ParsedLocation, "pathname" | "state">;

/**
 * Directional full-page view-transition types for TanStack Router.
 * Cross board/non-board layout → fade only (shell width differs).
 * Deeper routes → slide-left; shallower → slide-right; same depth → fade.
 */
export function getPageTransitionTypes({
    fromLocation,
    toLocation,
}: {
    fromLocation?: TransitionLocation;
    toLocation: TransitionLocation;
}): string[] {
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

function historyIndex(location: TransitionLocation): number | undefined {
    const index = (location.state as undefined | { __TSR_index?: unknown })
        ?.__TSR_index;
    return typeof index === "number" ? index : undefined;
}

function routeDepth(pathname: string): number {
    return pathname.split("/").filter(Boolean).length;
}
