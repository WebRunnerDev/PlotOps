export type SprintVisibilitySnapshot = {
    id: string;
    intersecting: boolean;
    ratio: number;
    /** Top of the section relative to the scrollport (px). */
    top: number;
};

/**
 * Scroll-spy: which Active Sprint section is “here” in the backlog.
 * Prefers the intersecting section closest to the top of the scrollport.
 * If nothing intersects, keeps `fallbackId` so the chip does not flicker
 * between sections.
 */
export function resolveVisibleSprintId(
    snapshots: readonly SprintVisibilitySnapshot[],
    fallbackId: null | string
): null | string {
    const visible = snapshots.filter(
        (snapshot) => snapshot.intersecting && snapshot.ratio > 0
    );
    if (visible.length === 0) return fallbackId;

    const ranked = visible.toSorted((left, right) => {
        const leftDistance = Math.abs(left.top);
        const rightDistance = Math.abs(right.top);
        if (leftDistance !== rightDistance) return leftDistance - rightDistance;
        return right.ratio - left.ratio;
    });
    return ranked[0]?.id ?? fallbackId;
}
