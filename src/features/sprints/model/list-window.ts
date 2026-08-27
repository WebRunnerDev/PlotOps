export const BACKLOG_LIST_PAGE_SIZE = 30;

export type ListWindow<T> = {
    hasMore: boolean;
    remaining: number;
    visible: T[];
};

export function initialListWindowCount(
    pageSize: number = BACKLOG_LIST_PAGE_SIZE
): number {
    return pageSize;
}

export function nextVisibleCount(input: {
    current: number;
    mode: "all" | "more";
    pageSize: number;
    total: number;
}): number {
    const total = Math.max(0, input.total);
    if (input.mode === "all") return total;
    return Math.min(input.current + input.pageSize, total);
}

export function shouldOfferSelectAllMatching(input: {
    selectedVisibleCount: number;
    totalCount: number;
    visibleCount: number;
}): boolean {
    const { selectedVisibleCount, totalCount, visibleCount } = input;
    if (totalCount <= 0 || visibleCount <= 0) return false;
    if (visibleCount >= totalCount) return false;
    return selectedVisibleCount === visibleCount;
}

export function windowListItems<T>(
    items: ReadonlyArray<T>,
    visibleCount: number
): ListWindow<T> {
    const count = Math.max(0, visibleCount);
    const visible = items.slice(0, count);
    const remaining = Math.max(0, items.length - visible.length);
    return {
        hasMore: remaining > 0,
        remaining,
        visible,
    };
}
