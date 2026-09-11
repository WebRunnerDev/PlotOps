export function closestScrollRoot(
    node: HTMLElement | null
): HTMLElement | null {
    let current = node?.parentElement ?? null;
    while (current) {
        const { overflowY } = getComputedStyle(current);
        if (
            isScrollableOverflow(
                overflowY,
                current.scrollHeight,
                current.clientHeight
            )
        ) {
            return current;
        }
        current = current.parentElement;
    }
    return document.scrollingElement instanceof HTMLElement
        ? document.scrollingElement
        : document.documentElement;
}

export function intersectionObserverRoot(
    scrollRoot: HTMLElement | null
): Element | null {
    if (!scrollRoot || isDocumentScrollRoot(scrollRoot)) return null;
    return scrollRoot;
}

/** html/body as an IntersectionObserver root uses the full document box, not the viewport. */
export function isDocumentScrollRoot(node: HTMLElement | null): boolean {
    if (!node || typeof document === "undefined") return false;
    return node === document.documentElement || node === document.body;
}

export function isScrollableOverflow(
    overflowY: string,
    scrollHeight: number,
    clientHeight: number
): boolean {
    return (
        (overflowY === "auto" || overflowY === "scroll") &&
        scrollHeight > clientHeight + 1
    );
}

export function offsetToBringSectionToTop(input: {
    rootTop: number;
    scrollTop: number;
    sectionTop: number;
    stickyOffset: number;
}): number {
    return Math.max(
        0,
        input.scrollTop +
            (input.sectionTop - input.rootTop) -
            input.stickyOffset
    );
}

export function scrollPortMetrics(root: HTMLElement): {
    rootTop: number;
    scrollTop: number;
} {
    if (isDocumentScrollRoot(root)) {
        return {
            rootTop: 0,
            scrollTop: window.scrollY,
        };
    }
    return {
        rootTop: root.getBoundingClientRect().top,
        scrollTop: root.scrollTop,
    };
}
