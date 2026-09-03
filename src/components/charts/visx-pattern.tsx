"use client";

import type { ComponentProps } from "react";

import {
    PatternCircles as VisxPatternCircles,
    PatternHexagons as VisxPatternHexagons,
    PatternLines as VisxPatternLines,
    PatternWaves as VisxPatternWaves,
} from "@visx/pattern";

export function PatternLines(
    properties: ComponentProps<typeof VisxPatternLines>
) {
    return <VisxPatternLines {...properties} />;
}
PatternLines.displayName = "PatternLines";

export function PatternCircles(
    properties: ComponentProps<typeof VisxPatternCircles>
) {
    return <VisxPatternCircles {...properties} />;
}
PatternCircles.displayName = "PatternCircles";

export function PatternWaves(
    properties: ComponentProps<typeof VisxPatternWaves>
) {
    return <VisxPatternWaves {...properties} />;
}
PatternWaves.displayName = "PatternWaves";

export function PatternHexagons(
    properties: ComponentProps<typeof VisxPatternHexagons>
) {
    return <VisxPatternHexagons {...properties} />;
}
PatternHexagons.displayName = "PatternHexagons";
