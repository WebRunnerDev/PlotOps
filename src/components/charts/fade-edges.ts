export type FadeEdges = "left" | "right" | boolean;

export interface FadeGradientStop {
    offset: string;
    opacity: number;
}

export interface FadeSides {
    /** True if either side fades — use to gate gradient/mask defs. */
    any: boolean;
    /** Whether the left edge should fade out. */
    left: boolean;
    /** Whether the right edge should fade out. */
    right: boolean;
}

/**
 * Stops for a horizontal fade gradient with opacity 0 at the faded side(s)
 * and opacity 1 in the middle. Matches the historic 0/15/85/100 pattern.
 */
export function fadeGradientStops(sides: FadeSides): FadeGradientStop[] {
    return [
        { offset: "0%", opacity: sides.left ? 0 : 1 },
        { offset: "15%", opacity: 1 },
        { offset: "85%", opacity: 1 },
        { offset: "100%", opacity: sides.right ? 0 : 1 },
    ];
}

export function resolveFadeSides(fade: FadeEdges): FadeSides {
    if (fade === false) {
        return { any: false, left: false, right: false };
    }
    if (fade === "left") {
        return { any: true, left: true, right: false };
    }
    if (fade === "right") {
        return { any: true, left: false, right: true };
    }
    return { any: true, left: true, right: true };
}

/** Horizontal fade gradient pinned to the chart viewport (not the series path bounds). */
export function viewportFadeGradientAttrs(innerWidth: number) {
    return {
        gradientUnits: "userSpaceOnUse" as const,
        x1: 0,
        x2: innerWidth,
        y1: 0,
        y2: 0,
    };
}
