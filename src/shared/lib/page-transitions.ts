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

type ProjectSection = "backlog" | "board" | "cicd" | "settings";

type TransitionLocation = Pick<ParsedLocation, "pathname" | "state">;

/** Nav order in `ProjectSectionNav` — drives slide direction. */
const PROJECT_SECTION_ORDER: readonly ProjectSection[] = [
    "board",
    "backlog",
    "cicd",
    "settings",
];

/**
 * Directional full-page view-transition types for TanStack Router.
 * Same-project section switches (board / backlog / CI/CD / settings) follow
 * nav order with a subtler `section-slide-*` motion.
 * Cross project/non-project layout → fade only (shell width differs).
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

    const fromProject = fromLocation.pathname.startsWith("/projects/");
    const toProject = toLocation.pathname.startsWith("/projects/");
    if (fromProject !== toProject) {
        return ["fade"];
    }

    const sectionTransition = projectSectionTransition(
        fromLocation.pathname,
        toLocation.pathname
    );
    if (sectionTransition) {
        return sectionTransition;
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

/** @internal Exported for unit tests. */
export function resolveProjectSection(
    pathname: string
): null | { projectId: string; section: ProjectSection } {
    const parts = pathname.split("/").filter(Boolean);
    if (parts[0] !== "projects" || typeof parts[1] !== "string") {
        return null;
    }

    const projectId = parts[1];
    const rest = parts.slice(2);

    if (rest[0] === "ci-cd" && rest.length === 1) {
        return { projectId, section: "cicd" };
    }
    if (rest[0] === "settings" && rest.length === 1) {
        return { projectId, section: "settings" };
    }
    if (rest[0] === "boards" && typeof rest[1] === "string") {
        if (rest.length === 2) {
            return { projectId, section: "board" };
        }
        if (rest.length === 3 && rest[2] === "backlog") {
            return { projectId, section: "backlog" };
        }
    }

    return null;
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

function projectSectionTransition(
    fromPathname: string,
    toPathname: string
): null | string[] {
    const from = resolveProjectSection(fromPathname);
    const to = resolveProjectSection(toPathname);
    if (!from || !to) return null;
    if (from.projectId !== to.projectId) return null;
    if (from.section === to.section) return null;

    const fromOrder = PROJECT_SECTION_ORDER.indexOf(from.section);
    const toOrder = PROJECT_SECTION_ORDER.indexOf(to.section);
    if (fromOrder === -1 || toOrder === -1) return null;

    return toOrder > fromOrder
        ? ["section-slide-left"]
        : ["section-slide-right"];
}

function routeDepth(pathname: string): number {
    return pathname.split("/").filter(Boolean).length;
}
